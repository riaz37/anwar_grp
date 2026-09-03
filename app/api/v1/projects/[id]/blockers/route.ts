import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { requireProjectPermission } from "@/lib/project-authz";
import { writeAudit } from "@/lib/audit";
import { recomputeProjectHealth } from "@/lib/project-health";
import { ok, fail, handleRouteError } from "@/lib/api-response";

const createBlockerSchema = z.object({
  description: z.string().trim().min(1),
  impact: z.string().trim().min(1),
  requiredAction: z.string().trim().max(2000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    requireProjectPermission(user, "RECORD_BLOCKER");
    const { id } = await params;
    const body = createBlockerSchema.parse(await req.json());

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return fail("NOT_FOUND", "Project not found.", 404);
    }

    const blocker = await prisma.blocker.create({
      data: {
        projectId: id,
        description: body.description,
        impact: body.impact,
        requiredAction: body.requiredAction,
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
    await requireAuth();
    const { id } = await params;

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
