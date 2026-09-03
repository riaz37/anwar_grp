import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { requireProjectPermission } from "@/lib/project-authz";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";

const createTaskSchema = z.object({
  action: z.string().trim().min(1).max(500),
  ownerId: z.string().min(1),
  deadline: z.coerce.date().optional(),
  relatedMilestoneId: z.string().min(1).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    requireProjectPermission(user, "UPDATE_TASK");
    const { id } = await params;
    const body = createTaskSchema.parse(await req.json());

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return fail("NOT_FOUND", "Project not found.", 404);
    }

    const owner = await prisma.user.findUnique({ where: { id: body.ownerId } });
    if (!owner) {
      return fail("NOT_FOUND", "Owner not found.", 404);
    }

    if (body.relatedMilestoneId) {
      const milestone = await prisma.milestone.findUnique({
        where: { id: body.relatedMilestoneId },
      });
      if (!milestone || milestone.projectId !== id) {
        return fail("NOT_FOUND", "Related milestone not found in this project.", 404);
      }
    }

    const task = await prisma.projectTask.create({
      data: {
        projectId: id,
        action: body.action,
        ownerId: body.ownerId,
        deadline: body.deadline,
        relatedMilestoneId: body.relatedMilestoneId,
      },
    });

    await writeAudit({
      actorId: user.userId,
      action: "task.create",
      entityType: "ProjectTask",
      entityId: task.id,
      metadata: { projectId: id, action: task.action },
    });

    return ok(task, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth();
    const { id } = await params;

    const tasks = await prisma.projectTask.findMany({
      where: { projectId: id },
      orderBy: [{ deadline: { sort: "asc", nulls: "last" } }],
    });

    return ok(tasks);
  } catch (err) {
    return handleRouteError(err);
  }
}
