import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma, Role, JoiningChecklistItemStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";
import { applicationScopeWhere } from "@/lib/phase2-scoping";

const WRITE_ROLES: Role[] = [
  Role.TA_ADMIN,
  Role.RECRUITER,
  Role.DEPT_HEAD,
  Role.HIRING_MANAGER,
];

const patchSchema = z
  .object({
    version: z.number().int().min(1),
    status: z.nativeEnum(JoiningChecklistItemStatus).optional(),
    ownerId: z.string().min(1).optional(),
    dueDate: z.coerce.date().nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine(
    (body) =>
      body.status !== undefined ||
      body.ownerId !== undefined ||
      body.dueDate !== undefined ||
      body.notes !== undefined,
    { message: "At least one field to update must be provided." },
  );

/**
 * PATCH /api/v1/joining-checklist-items/:id — updates status/owner/
 * due date/notes on one checklist item. Version-locked like every other
 * mutable resource in this API. Moving `status` to DONE sets
 * `completedAt` server-side (never trusted from the client); moving
 * away from DONE clears it. Every update writes an audit log entry —
 * status changes are the joining-coordination equivalent of a stage
 * transition, worth the same permanent record.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(WRITE_ROLES);
    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    const existing = await prisma.joiningChecklistItem.findFirst({
      where: { id, application: applicationScopeWhere(user) },
    });
    if (!existing) {
      return fail("NOT_FOUND", "Joining checklist item not found.", 404);
    }

    if (body.ownerId) {
      const owner = await prisma.user.findUnique({ where: { id: body.ownerId } });
      if (!owner) {
        return fail("NOT_FOUND", "Checklist item owner not found.", 404);
      }
    }

    const movingToDone =
      body.status === JoiningChecklistItemStatus.DONE &&
      existing.status !== JoiningChecklistItemStatus.DONE;
    const movingOffDone =
      body.status !== undefined &&
      body.status !== JoiningChecklistItemStatus.DONE &&
      existing.status === JoiningChecklistItemStatus.DONE;

    try {
      const updated = await prisma.joiningChecklistItem.update({
        where: { id, version: body.version },
        data: {
          version: { increment: 1 },
          ...(body.status !== undefined && { status: body.status }),
          ...(body.ownerId !== undefined && { ownerId: body.ownerId }),
          ...(body.dueDate !== undefined && { dueDate: body.dueDate }),
          ...(body.notes !== undefined && { notes: body.notes }),
          ...(movingToDone && { completedAt: new Date() }),
          ...(movingOffDone && { completedAt: null }),
        },
        include: {
          owner: { select: { id: true, name: true, role: true } },
          createdBy: { select: { id: true, name: true } },
        },
      });

      await writeAudit({
        actorId: user.userId,
        action: movingToDone
          ? "JOINING_CHECKLIST_ITEM_COMPLETE"
          : "JOINING_CHECKLIST_ITEM_UPDATE",
        entityType: "JoiningChecklistItem",
        entityId: updated.id,
        metadata: {
          applicationId: updated.applicationId,
          label: updated.label,
          previousStatus: existing.status,
          status: updated.status,
          ownerId: updated.ownerId,
          dueDate: updated.dueDate,
          completedAt: updated.completedAt,
        },
      });

      return ok(updated);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        return fail(
          "VERSION_CONFLICT",
          "This checklist item was updated by someone else. Reload and try again.",
          409,
        );
      }
      throw err;
    }
  } catch (err) {
    return handleRouteError(err);
  }
}
