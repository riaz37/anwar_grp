import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";
import { canReadOrgWide, requisitionScopeWhere } from "@/lib/phase2-scoping";

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

    const requisition = await prisma.requisition.findFirst({
      where: { id, ...requisitionScopeWhere(user) },
    });
    if (!requisition) {
      return fail("NOT_FOUND", "Requisition not found.", 404);
    }

    return ok(requisition);
  } catch (err) {
    return handleRouteError(err);
  }
}

const UPDATE_ROLES: Role[] = [Role.TA_ADMIN, Role.RECRUITER];

const patchSchema = z.object({
  version: z.number().int().min(1),
  position: z.string().trim().min(1).max(200).optional(),
  vacancyCount: z.number().int().min(1).optional(),
  positionLevel: z.string().trim().min(1).max(100).optional(),
  hiringManagerId: z.string().min(1).optional(),
  assignedRecruiterId: z.string().min(1).optional(),
  targetJoiningDate: z.coerce.date().optional(),
  erfRrfDocumentId: z.string().min(1).optional(),
});

/**
 * PATCH: field updates only, version-locked (BUILD_PLAN.md Sec 2.4).
 * approvalStatus is NOT updatable here — see
 * POST /api/v1/requisitions/:id/status for the guarded transition path.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(UPDATE_ROLES);
    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    const existing = await prisma.requisition.findFirst({
      where: { id, ...requisitionScopeWhere(user) },
    });
    if (!existing) {
      return fail("NOT_FOUND", "Requisition not found.", 404);
    }

    const { version, ...updates } = body;

    try {
      const updated = await prisma.requisition.update({
        where: { id, version },
        data: { ...updates, version: { increment: 1 } },
      });

      await writeAudit({
        actorId: user.userId,
        action: "REQUISITION_UPDATE",
        entityType: "Requisition",
        entityId: updated.id,
        metadata: { updates },
      });

      return ok(updated);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        return fail(
          "VERSION_CONFLICT",
          "This requisition was updated by someone else. Reload and try again.",
          409,
        );
      }
      throw err;
    }
  } catch (err) {
    return handleRouteError(err);
  }
}
