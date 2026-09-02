import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { ok, fail, handleRouteError } from "@/lib/api-response";
import { applicationScopeWhere } from "@/lib/phase2-scoping";
import { getEvaluationSummary } from "@/lib/reporting/evaluation-summary";

/**
 * GET /api/v1/interviews/:id/evaluation-summary — consolidated
 * panel-recommendations/average-score/missing-feedback/key-concerns/
 * hiring-manager-recommendation view (lib/reporting/evaluation-summary.ts;
 * PDF "Decisions and Approvals").
 *
 * PANEL_MEMBER is EXCLUDED from allowed roles entirely — not just
 * filtered by blind-until-submit like the evaluations list route. This
 * mirrors the decision already documented in
 * lib/evaluation-visibility.ts's doc comment: the blind-until-submit
 * rule exists to stop a panel member seeing a PEER's individual
 * assessment before forming their own, but this route is the
 * consolidated, cross-panelist RESULT — panel members are not among the
 * PDF's listed consumers of that summary ("recruiters should see...").
 * A panel member gets the per-row, visibility-filtered evaluations list
 * (GET .../evaluations) instead, never this route.
 *
 * TECH_ADMIN is deliberately EXCLUDED: evaluation scores are the kind of
 * confidential field BUILD_PLAN.md Sec 2.5 says stays hidden even from
 * Technical Administrators without an explicit break-glass grant — and
 * break-glass (ConfidentialDataGrant) isn't wired into any read path
 * yet (Phase 8). Revisit once break-glass elevation actually gates a
 * route, rather than granting blanket access now and narrowing later.
 */
const SUMMARY_ROLES: Role[] = [
  Role.TA_ADMIN,
  Role.RECRUITER,
  Role.DEPT_HEAD,
  Role.HIRING_MANAGER,
  Role.HR_LEADERSHIP,
  Role.AUDIT_USER,
];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(SUMMARY_ROLES);
    const { id } = await params;

    const interview = await prisma.interview.findUnique({
      where: { id },
      select: { id: true, applicationId: true },
    });
    if (!interview) {
      return fail("NOT_FOUND", "Interview not found.", 404);
    }

    const inScope = await prisma.application.findFirst({
      where: { id: interview.applicationId, ...applicationScopeWhere(user) },
      select: { id: true },
    });
    if (!inScope) {
      return fail("NOT_FOUND", "Interview not found.", 404);
    }

    const summary = await getEvaluationSummary(id);
    if (!summary) {
      return fail("NOT_FOUND", "Interview not found.", 404);
    }

    return ok(summary);
  } catch (err) {
    return handleRouteError(err);
  }
}
