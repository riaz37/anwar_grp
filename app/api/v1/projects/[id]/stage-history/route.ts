import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { requireProjectParticipant } from "@/lib/project-authz";
import { ok, handleRouteError } from "@/lib/api-response";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    await requireProjectParticipant(user, id);

    const history = await prisma.projectStageHistory.findMany({
      where: { projectId: id },
      include: { actor: { select: { id: true, name: true, role: true } } },
      orderBy: { changedAt: "desc" },
    });

    return ok(history);
  } catch (err) {
    return handleRouteError(err);
  }
}
