import { NextRequest } from "next/server";
import { z } from "zod";
import { DependencyItemType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { requireProjectPermission, requireProjectParticipant } from "@/lib/project-authz";
import { assertValidDependencyEdge, DependencyValidationError } from "@/lib/dependency-graph";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";

const createDependencySchema = z.object({
  dependentType: z.nativeEnum(DependencyItemType),
  dependentId: z.string().min(1),
  dependsOnType: z.nativeEnum(DependencyItemType),
  dependsOnId: z.string().min(1),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    await requireProjectParticipant(user, id);

    const dependencies = await prisma.itemDependency.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
    });

    return ok(dependencies);
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
    requireProjectPermission(user, "MANAGE_DEPENDENCIES");
    const { id } = await params;
    await requireProjectParticipant(user, id);
    const body = createDependencySchema.parse(await req.json());

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return fail("NOT_FOUND", "Project not found.", 404);
    }

    try {
      await assertValidDependencyEdge({ projectId: id, ...body });
    } catch (err) {
      if (err instanceof DependencyValidationError) {
        const status = err.code === "DEPENDENT_NOT_FOUND" || err.code === "DEPENDS_ON_NOT_FOUND"
          ? 404
          : 409;
        return fail(err.code, err.message, status);
      }
      throw err;
    }

    const dependency = await prisma.itemDependency.create({
      data: { projectId: id, ...body },
    });

    await writeAudit({
      actorId: user.userId,
      action: "dependency.create",
      entityType: "ItemDependency",
      entityId: dependency.id,
      metadata: { projectId: id, ...body },
    });

    return ok(dependency, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
