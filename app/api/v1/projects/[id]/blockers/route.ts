import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { requireProjectPermission, requireProjectParticipant } from "@/lib/project-authz";
import { writeAudit } from "@/lib/audit";
import { recomputeProjectHealth } from "@/lib/project-health";
import { ok, fail, handleRouteError } from "@/lib/api-response";

const createBlockerSchema = z.object({
  description: z.string().trim().min(1),
  impact: z.string().trim().min(1),
  requiredAction: z.string().trim().max(2000).optional(),
  responsiblePersonId: z.string().min(1),
  dateIdentified: z.coerce.date().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    requireProjectPermission(user, "RECORD_BLOCKER");
    const { id } = await params;
    await requireProjectParticipant(user, id);
    const body = createBlockerSchema.parse(await req.json());

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return fail("NOT_FOUND", "Project not found.", 404);
    }

    const responsiblePerson = await prisma.user.findUnique({
      where: { id: body.responsiblePersonId },
    });
    if (!responsiblePerson) {
      return fail("NOT_FOUND", "Responsible person not found.", 404);
    }

    const blocker = await prisma.blocker.create({
      data: {
        projectId: id,
        description: body.description,
        impact: body.impact,
        requiredAction: body.requiredAction,
        responsiblePersonId: body.responsiblePersonId,
        dateIdentified: body.dateIdentified,
        raisedById: user.userId,
      },
    });

    await recomputeProjectHealth(id);

    await writeAudit({
      actorId: user.userId,
      action: "blocker.create",
      entityType: "Blocker",
      entityId: blocker.id,
      metadata: { projectId: id },
    });

    return ok(blocker, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    await requireProjectParticipant(user, id);

    const [unresolved, resolved] = await Promise.all([
      prisma.blocker.findMany({
        where: { projectId: id, resolvedAt: null },
        orderBy: { createdAt: "desc" },
      }),
      prisma.blocker.findMany({
        where: { projectId: id, resolvedAt: { not: null } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return ok([...unresolved, ...resolved]);
  } catch (err) {
    return handleRouteError(err);
  }
}
