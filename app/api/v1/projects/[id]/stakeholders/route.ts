import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { requireProjectPermission, requireProjectParticipant } from "@/lib/project-authz";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";

const createStakeholderSchema = z.object({
  userId: z.string().min(1),
  raciRole: z.enum(["CONSULTED", "INFORMED"]),
  note: z.string().trim().max(2000).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    await requireProjectParticipant(user, id);

    const stakeholders = await prisma.projectStakeholder.findMany({
      where: { projectId: id },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });

    return ok(
      stakeholders.map((s) => ({
        id: s.id,
        userId: s.userId,
        userName: s.user.name,
        userEmail: s.user.email,
        raciRole: s.raciRole,
        note: s.note,
        createdAt: s.createdAt,
      })),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    requireProjectPermission(user, "MANAGE_STAKEHOLDERS");
    const { id } = await params;
    await requireProjectParticipant(user, id);
    const body = createStakeholderSchema.parse(await req.json());

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return fail("NOT_FOUND", "Project not found.", 404);
    }

    const stakeholderUser = await prisma.user.findUnique({
      where: { id: body.userId },
    });
    if (!stakeholderUser) {
      return fail("NOT_FOUND", "User not found.", 404);
    }

    const existing = await prisma.projectStakeholder.findUnique({
      where: {
        projectId_userId_raciRole: {
          projectId: id,
          userId: body.userId,
          raciRole: body.raciRole,
        },
      },
    });
    if (existing) {
      return fail(
        "ALREADY_EXISTS",
        "This person already holds that RACI role on the project.",
        409,
      );
    }

    const stakeholder = await prisma.projectStakeholder.create({
      data: {
        projectId: id,
        userId: body.userId,
        raciRole: body.raciRole,
        note: body.note,
      },
    });

    await writeAudit({
      actorId: user.userId,
      action: "stakeholder.create",
      entityType: "ProjectStakeholder",
      entityId: stakeholder.id,
      metadata: { projectId: id, userId: body.userId, raciRole: body.raciRole },
    });

    return ok(stakeholder, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
