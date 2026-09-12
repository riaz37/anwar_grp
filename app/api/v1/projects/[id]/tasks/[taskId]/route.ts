import { NextRequest } from "next/server";
import { z } from "zod";
import { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { requireProjectPermission, requireProjectParticipant } from "@/lib/project-authz";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";

const updateTaskSchema = z.object({
  action: z.string().trim().min(1).max(500).optional(),
  ownerId: z.string().min(1).optional(),
  deadline: z.coerce.date().nullable().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  progressPercent: z.number().int().min(0).max(100).optional(),
  relatedMilestoneId: z.string().min(1).nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  try {
    const user = await requireAuth();
    requireProjectPermission(user, "UPDATE_TASK");
    const { id, taskId } = await params;
    await requireProjectParticipant(user, id);
    const body = updateTaskSchema.parse(await req.json());

    const task = await prisma.projectTask.findUnique({ where: { id: taskId } });
    if (!task || task.projectId !== id) {
      return fail("NOT_FOUND", "Task not found.", 404);
    }

    if (body.ownerId) {
      const owner = await prisma.user.findUnique({ where: { id: body.ownerId } });
      if (!owner) {
        return fail("NOT_FOUND", "Owner not found.", 404);
      }
    }

    if (body.relatedMilestoneId) {
      const milestone = await prisma.milestone.findUnique({
        where: { id: body.relatedMilestoneId },
      });
      if (!milestone || milestone.projectId !== id) {
        return fail("NOT_FOUND", "Related milestone not found in this project.", 404);
      }
    }

    const updated = await prisma.projectTask.update({
      where: { id: taskId },
      data: {
        ...(body.action !== undefined && { action: body.action }),
        ...(body.ownerId !== undefined && { ownerId: body.ownerId }),
        ...(body.deadline !== undefined && { deadline: body.deadline }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.progressPercent !== undefined && { progressPercent: body.progressPercent }),
        ...(body.relatedMilestoneId !== undefined && {
          relatedMilestoneId: body.relatedMilestoneId,
        }),
      },
    });

    await writeAudit({
      actorId: user.userId,
      action: "task.update",
      entityType: "ProjectTask",
      entityId: taskId,
      metadata: { projectId: id },
    });

    return ok(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
