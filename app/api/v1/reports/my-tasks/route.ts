import { requireAuth } from "@/lib/authz";
import { ok, handleRouteError } from "@/lib/api-response";
import { getRecruiterDashboard } from "@/lib/reporting/recruiter-dashboard";

/**
 * GET /api/v1/reports/my-tasks
 *
 * Powers the "Home = My Tasks" frontend view (BUILD_PLAN.md Sec 5,
 * currently mock data in components/tasks/*). LIVE indexed query, not a
 * precomputed rollup (BUILD_PLAN.md Sec 2.11 / TODOS.md).
 *
 * Any authenticated user may call this — it's inherently self-scoped
 * (nextActionOwnerId = the caller), so there's no separate "can you see
 * this" question the way there is for the requisitions/candidates/
 * applications list endpoints.
 *
 * Response shape (see lib/reporting/recruiter-dashboard.ts):
 *   data: {
 *     tasks: Array<{ id, candidateId, candidateName, requisitionRef,
 *       requisitionTitle, stage, nextAction, owner, dueDate }>,
 *     summary: { totalOpenTasks, overdueCount, dueTodayCount,
 *       byStage: Array<{ stage, count }> }
 *   }
 *
 * Diff vs. components/tasks/types.ts `Task`:
 *   - `stage` here is the raw ApplicationStage enum value (e.g.
 *     "FEEDBACK_PENDING"), not the human label the mock data used
 *     (e.g. "Feedback Pending"). The frontend will need to title-case /
 *     map this, or ask the API to send a display label instead.
 *   - `data.tasks` is nested one level under `data` (alongside
 *     `summary`), not `data` itself — the frontend's existing
 *     `groupTasks(tasks)` call needs `res.data.tasks`, not `res.data`.
 *   - Everything else (candidateId, candidateName, requisitionRef,
 *     requisitionTitle, nextAction, owner, dueDate as YYYY-MM-DD) matches
 *     the mock `Task` shape field-for-field.
 */
export async function GET() {
  try {
    const user = await requireAuth();
    const dashboard = await getRecruiterDashboard(user.userId);
    return ok(dashboard);
  } catch (err) {
    return handleRouteError(err);
  }
}
