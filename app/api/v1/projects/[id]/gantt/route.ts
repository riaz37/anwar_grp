import { requireAuth } from "@/lib/authz";
import { requireProjectParticipant } from "@/lib/project-authz";
import { getCriticalPath } from "@/lib/critical-path";
import { ok, handleRouteError } from "@/lib/api-response";

/**
 * Backs the project Gantt tab (AGENTIC_DASHBOARD_PLAN.md Group F):
 * milestones + tasks for one project, each flagged `isCriticalPath` by
 * `lib/critical-path.ts`. Read-only, participant-scoped the same way as
 * every other project sub-resource GET (see `blockers/route.ts`) — no
 * extra permission beyond being on the project.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    await requireProjectParticipant(user, id);

    const criticalPath = await getCriticalPath(id);

    return ok(criticalPath);
  } catch (err) {
    return handleRouteError(err);
  }
}
