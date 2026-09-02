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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(READ_ROLES);
    const { id } = await params;

    const application = await prisma.application.findFirst({
      where: { id, ...applicationScopeWhere(user) },
      include: {
        candidate: true,
        requisition: true,
        assignedRecruiter: { select: { id: true, name: true, email: true } },
        nextActionOwner: { select: { id: true, name: true, email: true } },
      },
    });
    if (!application) {
      return fail("NOT_FOUND", "Application not found.", 404);
    }

    return ok(application);
  } catch (err) {
    return handleRouteError(err);
  }
}
