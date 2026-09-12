import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { requireProjectPermission, requireProjectParticipant } from "@/lib/project-authz";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; stakeholderId: string }> },
) {
  try {
    const user = await requireAuth();
    requireProjectPermission(user, "MANAGE_STAKEHOLDERS");
    const { id, stakeholderId } = await params;
    await requireProjectParticipant(user, id);

    const stakeholder = await prisma.projectStakeholder.findUnique({
      where: { id: stakeholderId },
    });
    if (!stakeholder || stakeholder.projectId !== id) {
      return fail("NOT_FOUND", "Stakeholder not found.", 404);
    }

    await prisma.projectStakeholder.delete({ where: { id: stakeholderId } });

    await writeAudit({
      actorId: user.userId,
      action: "stakeholder.remove",
      entityType: "ProjectStakeholder",
      entityId: stakeholderId,
      metadata: { projectId: id },
    });

    return ok({ id: stakeholderId });
  } catch (err) {
    return handleRouteError(err);
  }
}
