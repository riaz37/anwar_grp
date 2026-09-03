import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { requireProjectPermission } from "@/lib/project-authz";
import { writeAudit } from "@/lib/audit";
import { recomputeProjectHealth, isMilestoneOverdue, isMilestoneAtRisk, milestoneRequiresDelayReason } from "@/lib/project-health";
import { ok, fail, handleRouteError } from "@/lib/api-response";

const createMilestoneSchema = z.object({
  name: z.string().trim().min(1).max(200),
  ownerId: z.string().min(1),
  dueDate: z.coerce.date(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    requireProjectPermission(user, "MANAGE_MILESTONES");
    const { id } = await params;
    const body = createMilestoneSchema.parse(await req.json());

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return fail("NOT_FOUND", "Project not found.", 404);
    }

    const owner = await prisma.user.findUnique({ where: { id: body.ownerId } });
    if (!owner) {
      return fail("NOT_FOUND", "Owner not found.", 404);
    }

    const milestone = await prisma.milestone.create({
      data: {
        projectId: id,
        name: body.name,
        ownerId: body.ownerId,
        dueDate: body.dueDate,
      },
    });

    await recomputeProjectHealth(id);

    await writeAudit({
      actorId: user.userId,
      action: "milestone.create",
      entityType: "Milestone",
      entityId: milestone.id,
      metadata: { projectId: id, name: milestone.name },
    });

    return ok(milestone, { status: 201 });
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

    const milestones = await prisma.milestone.findMany({
      where: { projectId: id },
      orderBy: { dueDate: "asc" },
    });

    const annotated = await Promise.all(
      milestones.map(async (m) => ({
        ...m,
        overdue: isMilestoneOverdue(m),
        atRisk: isMilestoneAtRisk(m),
        delayReasonRequired: await milestoneRequiresDelayReason(m.id),
      })),
    );

    return ok(annotated);
  } catch (err) {
    return handleRouteError(err);
  }
}
