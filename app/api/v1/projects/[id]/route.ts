import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { requireProjectPermission, requireProjectParticipant } from "@/lib/project-authz";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";

const userSelect = { id: true, name: true, email: true, role: true } as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    await requireProjectParticipant(user, id);

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
    const { id } = await params;
    const body = updateProjectSchema.parse(await req.json());

    // Reassigning the owner/analyst/developer is "Assign resources" per
    // assignment Sec 9 — AI_TEAM_LEAD only, distinct from EDIT_REQUIREMENTS
    // (AI_ANALYST + AI_TEAM_LEAD), which covers the project's content
    // fields (name/businessProblem/expectedOutcome/expectedDeliveryDate).
    // A request can only touch one family at a time in the current UI, but
    // check both permissions independently so a mixed payload can't use
    // the weaker one to slip past the stronger one.
    const isPeopleChange =
      body.ownerId !== undefined ||
      body.analystId !== undefined ||
      body.developerId !== undefined;
    const isContentChange =
      body.name !== undefined ||
      body.businessProblem !== undefined ||
      body.expectedOutcome !== undefined ||
      body.expectedDeliveryDate !== undefined;
    if (isPeopleChange) {
      requireProjectPermission(user, "ASSIGN_RESOURCES");
    }
    if (isContentChange) {
      requireProjectPermission(user, "EDIT_REQUIREMENTS");
    }

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return fail("NOT_FOUND", "Project not found.", 404);
    }
    // EDIT_REQUIREMENTS includes AI_ANALYST, which is participant-scoped;
    // ASSIGN_RESOURCES is AI_TEAM_LEAD-only (always portfolio-wide), so
    // no participant check is needed for the people-change branch.
    if (isContentChange) {
      await requireProjectParticipant(user, id);
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
