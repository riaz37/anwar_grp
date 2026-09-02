import "server-only";
import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { getOverdueFeedback } from "./reporting/overdue-feedback";

/**
 * Overdue-evaluation-feedback reminder scaffolding (BUILD_PLAN.md Sec
 * 2.7: "background jobs" — reminders must happen on a schedule, not
 * only on-demand when someone opens the report).
 *
 * Same BullMQ + Redis infra as lib/queue.ts / lib/communication-worker.ts
 * (Phase 3), but a REPEATABLE job rather than an on-demand one: this
 * queue has no producer-side `.add()` call from a route — instead the
 * queue schedules itself to re-run "recompute" on a fixed cadence via
 * BullMQ's repeat option, started once at server boot from
 * instrumentation.ts (mirrors startCommunicationWorker()'s pattern).
 *
 * Cadence: every 15 minutes (documented, reasonable choice — not
 * specified in the PDF/BUILD_PLAN). Overdue feedback only flips state
 * once an interview crosses the 24h threshold (lib/reporting/
 * overdue-feedback.ts), so sub-minute freshness isn't needed; 15
 * minutes keeps the job cheap while still catching newly-overdue
 * interviews well within the same business day.
 *
 * SCOPE NOTE (explicitly out of scope per this phase's task, documented
 * follow-up): this job only *recomputes* the overdue list and logs it —
 * it does NOT push anything through the Phase 3 Communication pipeline
 * (email/WhatsApp) yet. Wiring an actual reminder message per overdue
 * panelist is a straightforward follow-up: for each
 * OverdueFeedbackItem, look up (or create) a MessageTemplate in the
 * EVALUATION_REMINDER-ish category and call the same
 * Communication-drafting path applications/:id/communications uses,
 * then enqueueCommunicationSend(). Left undone here because it requires
 * a product decision (which category, which template content, whether
 * DRAFTED communications need admin approval per-reminder or can
 * auto-send) that's out of this phase's explicit scope.
 */

export const REMINDER_QUEUE_NAME = "overdue-feedback-reminder";
const REMINDER_JOB_NAME = "recompute-overdue-feedback";
const REMINDER_REPEAT_EVERY_MS = 15 * 60 * 1000; // 15 minutes

const globalForReminder = globalThis as unknown as {
  reminderRedisConnection: IORedis | undefined;
  reminderQueue: Queue | undefined;
  reminderWorker: Worker | undefined;
};

function getRedisConnection(): IORedis {
  if (!globalForReminder.reminderRedisConnection) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error("Missing required env var: REDIS_URL");
    }
    globalForReminder.reminderRedisConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });
  }
  return globalForReminder.reminderRedisConnection;
}

function getReminderQueue(): Queue {
  if (!globalForReminder.reminderQueue) {
    globalForReminder.reminderQueue = new Queue(REMINDER_QUEUE_NAME, {
      connection: getRedisConnection(),
    });
  }
  return globalForReminder.reminderQueue;
}

async function handleRecompute(): Promise<void> {
  const overdue = await getOverdueFeedback();
  // Real-notification dispatch is the documented follow-up above; for
  // now this recompute makes the overdue-feedback view "live" (backed
  // by a scheduled recompute, not just an on-request query) and gives
  // an observable log line proving the repeatable job is actually
  // running in production.
  console.log(
    `[reminder-scheduler] overdue-feedback recompute: ${overdue.length} outstanding evaluation(s).`,
  );
}

/** Idempotent — safe to call more than once (e.g. hot reload in dev). */
export async function startReminderScheduler(): Promise<Worker> {
  const queue = getReminderQueue();

  // upsertJobScheduler (BullMQ's repeatable-job API) is itself
  // idempotent on the same schedulerId, so re-registering on every hot
  // reload/restart does not create duplicate repeating jobs.
  await queue.upsertJobScheduler(
    REMINDER_JOB_NAME,
    { every: REMINDER_REPEAT_EVERY_MS },
    { name: REMINDER_JOB_NAME },
  );

  if (globalForReminder.reminderWorker) {
    return globalForReminder.reminderWorker;
  }

  const worker = new Worker(
    REMINDER_QUEUE_NAME,
    async (_job: Job) => {
      await handleRecompute();
    },
    { connection: getRedisConnection() },
  );
  globalForReminder.reminderWorker = worker;
  return worker;
}
