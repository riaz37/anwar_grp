import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { computeChecklistReadiness } from "@/lib/checklist-engine";
import { ok, fail, handleRouteError } from "@/lib/api-response";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth();
    const { id } = await params;

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return fail("NOT_FOUND", "Project not found.", 404);
    }

    const [items, readiness] = await Promise.all([
      prisma.stageGateChecklistItem.findMany({
        where: { projectId: id, stage: project.currentStage },
        orderBy: { createdAt: "asc" },
      }),
      computeChecklistReadiness(id, project.currentStage),
    ]);

    return ok({ items, readiness });
  } catch (err) {
    return handleRouteError(err);
  }
}
