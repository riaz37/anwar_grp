/**
 * Next.js instrumentation hook — runs once per server process at boot,
 * before any request is handled. Used here to wire up module-owned
 * registrations that must exist before routes execute:
 *  - Phase 2's document-download authz checkers
 *    (lib/phase2-document-authz.ts), since lib/documents.ts fails
 *    closed for any DocumentOwnerType with no checker registered.
 *  - Phase 3's SCREENING_ASSESSMENT checker (lib/phase3-document-authz.ts),
 *    same fail-closed reasoning.
 *  - Phase 6's JOINING_CHECKLIST_ITEM checker (lib/phase6-document-authz.ts),
 *    same fail-closed reasoning.
 *  - Phase 3's async communication-send worker
 *    (lib/communication-worker.ts) — started in-process here rather than
 *    as a separate deployable (documented tradeoff in that file's doc
 *    comment; BUILD_PLAN.md Sec 2.11 calls for a standalone worker
 *    process in production).
 *  - Phase 4's overdue-evaluation-feedback reminder scheduler
 *    (lib/reminder-scheduler.ts) — a BullMQ repeatable job, same
 *    in-process-for-now tradeoff as the communication worker above.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerPhase2DocumentAuthzCheckers } = await import(
      "./lib/phase2-document-authz"
    );
    registerPhase2DocumentAuthzCheckers();

    const { registerPhase3DocumentAuthzCheckers } = await import(
      "./lib/phase3-document-authz"
    );
    registerPhase3DocumentAuthzCheckers();

    const { registerPhase6DocumentAuthzCheckers } = await import(
      "./lib/phase6-document-authz"
    );
    registerPhase6DocumentAuthzCheckers();

    const { startCommunicationWorker } = await import(
      "./lib/communication-worker"
    );
    startCommunicationWorker();

    const { startReminderScheduler } = await import(
      "./lib/reminder-scheduler"
    );
    await startReminderScheduler();
  }
}
