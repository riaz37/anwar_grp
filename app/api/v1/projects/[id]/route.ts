import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { requireProjectPermission } from "@/lib/project-authz";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";

const userSelect = { id: true, name: true, email: true, role: true } as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth();
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        owner: { select: userSelect },
        analyst: { select: userSelect },
        developer: { select: userSelect },
        businessUnit: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        milestones: { orderBy: { dueDate: "asc" } },
        tasks: { orderBy: { deadline: "asc" } },
        blockers: { orderBy: { createdAt: "desc" } },
        scopeChanges: { orderBy: { createdAt: "desc" } },
        delayReasons: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!project) {
      return fail("NOT_FOUND", "Project not found.", 404);
    }

    const gateChecklistItems = await prisma.stageGateChecklistItem.findMany({
      where: { projectId: project.id, stage: project.currentStage },
      orderBy: { createdAt: "asc" },
    });

    return ok({ ...project, gateChecklistItems });
  } catch (err) {
    return handleRouteError(err);
  }
}

const updateProjectSchema = z.object({
  version: z.number().int().min(1),
  name: z.string().trim().min(1).max(200).optional(),
  businessProblem: z.string().trim().min(1).optional(),
  expectedOutcome: z.string().trim().min(1).optional(),
  ownerId: z.string().min(1).optional(),
  analystId: z.string().min(1).nullable().optional(),
  developerId: z.string().min(1).nullable().optional(),
  expectedDeliveryDate: z.coerce.date().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    requireProjectPermission(user, "EDIT_REQUIREMENTS");
    const { id } = await params;
    const body = updateProjectSchema.parse(await req.json());

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return fail("NOT_FOUND", "Project not found.", 404);
    }
    if (project.version !== body.version) {
      return fail(
        "CONFLICT",
        "This project has been modified since you last loaded it. Refresh and try again.",
        409,
      );
    }

    const [owner, analyst, developer] = await Promise.all([
      body.ownerId
        ? prisma.user.findUnique({ where: { id: body.ownerId } })
        : Promise.resolve(undefined),
      body.analystId
        ? prisma.user.findUnique({ where: { id: body.analystId } })
        : Promise.resolve(undefined),
      body.developerId
        ? prisma.user.findUnique({ where: { id: body.developerId } })
        : Promise.resolve(undefined),
    ]);

    if (body.ownerId && !owner) {
      return fail("NOT_FOUND", "Owner not found.", 404);
    }
    if (body.analystId && !analyst) {
      return fail("NOT_FOUND", "Analyst not found.", 404);
    }
    if (body.developerId && !developer) {
      return fail("NOT_FOUND", "Developer not found.", 404);
    }

    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.businessProblem !== undefined && {
          businessProblem: body.businessProblem,
        }),
        ...(body.expectedOutcome !== undefined && {
          expectedOutcome: body.expectedOutcome,
        }),
        ...(body.ownerId !== undefined && { ownerId: body.ownerId }),
        ...(body.analystId !== undefined && { analystId: body.analystId }),
        ...(body.developerId !== undefined && { developerId: body.developerId }),
        ...(body.expectedDeliveryDate !== undefined && {
          expectedDeliveryDate: body.expectedDeliveryDate,
        }),
        version: { increment: 1 },
      },
    });

    await writeAudit({
      actorId: user.userId,
      action: "project.update",
      entityType: "Project",
      entityId: updated.id,
      metadata: { fields: Object.keys(body).filter((k) => k !== "version") },
    });

    return ok(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
