import { NextRequest } from "next/server";
import { z } from "zod";
import { MilestoneStatus, DelayReasonCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { requireProjectPermission, requireProjectParticipant } from "@/lib/project-authz";
import { writeAudit } from "@/lib/audit";
import { recomputeProjectHealth, milestoneRequiresDelayReason } from "@/lib/project-health";
import { ok, fail, handleRouteError } from "@/lib/api-response";

const updateMilestoneSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  ownerId: z.string().min(1).optional(),
  dueDate: z.coerce.date().optional(),
  status: z.nativeEnum(MilestoneStatus).optional(),
  delayReasonCategory: z.nativeEnum(DelayReasonCategory).optional(),
  delayReasonNote: z.string().trim().max(2000).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> },
) {
  try {
    const user = await requireAuth();
    requireProjectPermission(user, "MANAGE_MILESTONES");
    const { id, milestoneId } = await params;
    await requireProjectParticipant(user, id);
    const body = updateMilestoneSchema.parse(await req.json());

    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
    });
    if (!milestone || milestone.projectId !== id) {
      return fail("NOT_FOUND", "Milestone not found.", 404);
    }

    if (body.ownerId) {
      const owner = await prisma.user.findUnique({ where: { id: body.ownerId } });
      if (!owner) {
        return fail("NOT_FOUND", "Owner not found.", 404);
      }
    }

    const requiresDelayReason = await milestoneRequiresDelayReason(milestoneId);
    if (requiresDelayReason && !body.delayReasonCategory) {
      return fail(
        "DELAY_REASON_REQUIRED",
        "This milestone is overdue and requires a delay reason before it can be updated.",
        422,
      );
    }

    const [updated] = await prisma.$transaction([
      prisma.milestone.update({
        where: { id: milestoneId },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.ownerId !== undefined && { ownerId: body.ownerId }),
          ...(body.dueDate !== undefined && { dueDate: body.dueDate }),
          ...(body.status !== undefined && { status: body.status }),
          ...(body.status === MilestoneStatus.DONE && { completedAt: new Date() }),
        },
      }),
      ...(body.delayReasonCategory
        ? [
            prisma.delayReason.create({
              data: {
                projectId: id,
                milestoneId,
                category: body.delayReasonCategory,
                note: body.delayReasonNote,
                recordedById: user.userId,
              },
            }),
          ]
        : []),
    ]);

    await recomputeProjectHealth(id);

    await writeAudit({
      actorId: user.userId,
      action: "milestone.update",
      entityType: "Milestone",
      entityId: milestoneId,
      metadata: { projectId: id },
    });

    return ok(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
