import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { requireProjectPermission, requireProjectParticipant } from "@/lib/project-authz";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; dependencyId: string }> },
) {
  try {
    const user = await requireAuth();
    requireProjectPermission(user, "MANAGE_DEPENDENCIES");
    const { id, dependencyId } = await params;
    await requireProjectParticipant(user, id);

    const dependency = await prisma.itemDependency.findUnique({
      where: { id: dependencyId },
    });
    if (!dependency || dependency.projectId !== id) {
      return fail("NOT_FOUND", "Dependency not found.", 404);
    }

    await prisma.itemDependency.delete({ where: { id: dependencyId } });

    await writeAudit({
      actorId: user.userId,
      action: "dependency.remove",
      entityType: "ItemDependency",
      entityId: dependencyId,
      metadata: { projectId: id },
    });

    return ok({ id: dependencyId });
  } catch (err) {
    return handleRouteError(err);
  }
}
