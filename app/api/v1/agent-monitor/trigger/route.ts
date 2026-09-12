import { requireAuth } from "@/lib/authz";
import { hasProjectPermission } from "@/lib/project-permissions";
import { runAgentMonitor } from "@/app/api/internal/agent-monitor/route";
import { ok, fail, handleRouteError } from "@/lib/api-response";

/** Matches the internal cron route's budget — a manual run sweeps the same
 * full portfolio and can trigger the same LLM narration + email calls. */
export const maxDuration = 300;

/**
 * Lets Management and Team Leads run the monitoring sweep on demand from
 * the dashboard, instead of waiting up to 15 minutes for the next cron
 * tick — e.g. to demo the flag-and-email flow live. Gated by the same
 * VIEW_MANAGEMENT_DASHBOARD permission as the dashboard page itself,
 * since anyone who can see the ownership queue is someone the agent
 * would otherwise email anyway.
 */
export async function POST() {
  try {
    const user = await requireAuth();
    if (!hasProjectPermission(user.role, "VIEW_MANAGEMENT_DASHBOARD")) {
      return fail("FORBIDDEN", "You don't have permission to run the agent monitor.", 403);
    }

    const summary = await runAgentMonitor();
    return ok(summary);
  } catch (err) {
    return handleRouteError(err);
  }
}
