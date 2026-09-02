import "server-only";
import { Queue } from "bullmq";
import IORedis from "ioredis";

/**
 * BullMQ + Redis setup for the async communication pipeline
 * (BUILD_PLAN.md Sec 2.7/2.8). `REDIS_URL` reuses the native Redis
 * instance on localhost:6379 per the Phase 1 notes — no separate
 * container.
 *
 * Dev-mode singleton pattern (same rationale as lib/prisma.ts): without
 * this, every hot reload would open a new Redis connection and a new
 * Queue instance.
 */

export const COMMUNICATION_QUEUE_NAME = "communication-send";

export interface CommunicationSendJobData {
  communicationId: string;
}

const globalForQueue = globalThis as unknown as {
  redisConnection: IORedis | undefined;
  communicationQueue: Queue<CommunicationSendJobData> | undefined;
};

function getRedisConnection(): IORedis {
  if (!globalForQueue.redisConnection) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error("Missing required env var: REDIS_URL");
    }
    globalForQueue.redisConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null, // required by BullMQ workers/queues
    });
  }
  return globalForQueue.redisConnection;
}

export function getCommunicationQueue(): Queue<CommunicationSendJobData> {
  if (!globalForQueue.communicationQueue) {
    globalForQueue.communicationQueue = new Queue<CommunicationSendJobData>(
      COMMUNICATION_QUEUE_NAME,
      {
        connection: getRedisConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: { age: 3600, count: 1000 },
          removeOnFail: { age: 24 * 3600 },
        },
      },
    );
  }
  return globalForQueue.communicationQueue;
}

/**
 * Enqueues a send job for a Communication that has just transitioned to
 * APPROVED. Called from the API route (communications/:id/approve), not
 * from the worker — per BUILD_PLAN.md Sec 2.8's locked pipeline diagram.
 */
export async function enqueueCommunicationSend(
  communicationId: string,
): Promise<void> {
  await getCommunicationQueue().add(
    "send",
    { communicationId },
    { jobId: `communication-send-${communicationId}` },
  );
}
