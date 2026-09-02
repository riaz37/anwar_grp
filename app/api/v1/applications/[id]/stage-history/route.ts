import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { ok, fail, handleRouteError } from "@/lib/api-response";
import { applicationScopeWhere } from "@/lib/phase2-scoping";

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
 * GET: the permanent history record, read-only — no write path is
 * exposed for StageHistory anywhere in this API (append-only per
 * BUILD_PLAN.md Sec 2.3).
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

    const history = await prisma.stageHistory.findMany({
      where: { applicationId: id },
      include: { changedBy: { select: { id: true, name: true } } },
      orderBy: { changedAt: "asc" },
    });

    return ok(history);
  } catch (err) {
    return handleRouteError(err);
  }
}
