import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { fail, ok, handleRouteError } from "@/lib/api-response";
import { applicationScopeWhere } from "@/lib/phase2-scoping";
import { getJoiningReadiness } from "@/lib/reporting/joining-readiness";

const READ_ROLES: Role[] = [
  Role.TA_ADMIN,
  Role.RECRUITER,
  Role.DEPT_HEAD,
  Role.HIRING_MANAGER,
  Role.HR_LEADERSHIP,
  Role.AUDIT_USER,
  Role.TECH_ADMIN,
];

/**
 * GET /api/v1/applications/:id/joining-readiness — checklist-completion
 * aggregation for the application (PDF Scenario 5: "Show readiness for
 * joining"). See lib/reporting/joining-readiness.ts for the summary
 * shape and the "mechanical fact, not a decision" reasoning for why a
 * computed `isReady` boolean is fine here (unlike Phase 4's evaluation
 * summary, which deliberately avoids any decision-derivation).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(READ_ROLES);
    const { id } = await params;

    const application = await prisma.application.findFirst({
      where: { id, ...applicationScopeWhere(user) },
      select: { id: true },
    });
    if (!application) {
      return fail("NOT_FOUND", "Application not found.", 404);
    }

    const readiness = await getJoiningReadiness(id);
    if (!readiness) {
      return fail("NOT_FOUND", "Application not found.", 404);
    }

    return ok(readiness);
  } catch (err) {
    return handleRouteError(err);
  }
}
