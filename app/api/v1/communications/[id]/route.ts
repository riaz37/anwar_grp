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
 * GET /api/v1/communications/:id — status detail, useful for polling
 * Drafted -> Awaiting Approval -> Approved -> Sent -> Delivered/Failed
 * from the client without re-fetching the whole application's list.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(READ_ROLES);
    const { id } = await params;

    const communication = await prisma.communication.findFirst({
      where: { id, application: applicationScopeWhere(user) },
      include: {
        template: { select: { id: true, name: true, category: true, channel: true } },
        draftedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });
    if (!communication) {
      return fail("NOT_FOUND", "Communication not found.", 404);
    }

    return ok(communication);
  } catch (err) {
    return handleRouteError(err);
  }
}
