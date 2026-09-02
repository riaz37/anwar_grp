import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma, RequisitionApprovalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";
import { requisitionScopeWhere } from "@/lib/phase2-scoping";
import {
  isValidRequisitionStatusTransition,
  rolesAllowedForTransition,
} from "@/lib/requisition-status";

const statusSchema = z.object({
  status: z.nativeEnum(RequisitionApprovalStatus),
  version: z.number().int().min(1),
});

/**
 * POST /api/v1/requisitions/:id/status
 *
 * Guarded approvalStatus transition (see lib/requisition-status.ts for
 * the allowed graph + which role may drive each transition). Version-
 * locked like PATCH; writes an audit log entry (no StageHistory
 * equivalent needed for requisitions per the task spec).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = statusSchema.parse(await req.json());

    const existing = await prisma.requisition.findFirst({
      where: { id, ...requisitionScopeWhere(user) },
    });
    if (!existing) {
      return fail("NOT_FOUND", "Requisition not found.", 404);
    }

    if (!isValidRequisitionStatusTransition(existing.approvalStatus, body.status)) {
      return fail(
        "INVALID_TRANSITION",
        `Cannot move a requisition from ${existing.approvalStatus} to ${body.status}.`,
        400,
      );
    }

    const allowedRoles = rolesAllowedForTransition(body.status);
    if (!allowedRoles.includes(user.role)) {
      return fail(
        "FORBIDDEN",
        "You do not have permission to make this status change.",
        403,
      );
    }

    try {
      const updated = await prisma.requisition.update({
        where: { id, version: body.version },
        data: { approvalStatus: body.status, version: { increment: 1 } },
      });

      await writeAudit({
        actorId: user.userId,
        action: "REQUISITION_STATUS_CHANGE",
        entityType: "Requisition",
        entityId: updated.id,
        metadata: { from: existing.approvalStatus, to: body.status },
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
