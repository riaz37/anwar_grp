import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/authz";
import { ok, handleRouteError } from "@/lib/api-response";
import { getOverdueFeedback } from "@/lib/reporting/overdue-feedback";

/**
 * GET /api/v1/reports/overdue-feedback — interviews more than
 * OVERDUE_FEEDBACK_THRESHOLD_HOURS (24h, see
 * lib/reporting/overdue-feedback.ts) past scheduledAt with at least one
 * assigned panelist who hasn't submitted an evaluation yet. One row per
 * (interview, missing panelist).
 *
 * Same consumer set as the evaluation-summary route (org-wide/
 * department-scoped roles that manage the hiring decision) — a bare
 * PANEL_MEMBER has no business seeing who else on a panel is behind,
 * only whether *they themselves* are (which they already know from
 * their own dashboard). Kept org-wide (no per-caller applicationScope
 * filter) deliberately: this is a small admin/ops report, not a list
 * endpoint a recruiter would page through for "their" interviews only —
 * matching how message-templates/evaluation-form-templates are read
 * org-wide by these same roles.
 */
const REPORT_ROLES: Role[] = [
  Role.TA_ADMIN,
  Role.RECRUITER,
  Role.DEPT_HEAD,
  Role.HIRING_MANAGER,
  Role.HR_LEADERSHIP,
  Role.AUDIT_USER,
  Role.TECH_ADMIN,
];

export async function GET(_req: NextRequest) {
  try {
    await requireRole(REPORT_ROLES);
    const items = await getOverdueFeedback();
    return ok(items, { meta: { total: items.length } });
  } catch (err) {
    return handleRouteError(err);
  }
}
