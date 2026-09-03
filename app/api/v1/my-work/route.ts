import { ProjectStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { isMilestoneOverdue, isMilestoneAtRisk } from "@/lib/project-health";
import { ok, handleRouteError } from "@/lib/api-response";

export async function GET() {
  try {
    const user = await requireAuth();

    const [projects, tasks, milestones] = await Promise.all([
      prisma.project.findMany({
        where: {
          currentStage: { not: ProjectStage.COMPLETED },
          OR: [
            { ownerId: user.userId },
            { analystId: user.userId },
            { developerId: user.userId },
          ],
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.projectTask.findMany({
        where: { ownerId: user.userId, status: { not: "DONE" } },
        orderBy: { deadline: "asc" },
      }),
      prisma.milestone.findMany({
        where: { ownerId: user.userId, status: { not: "DONE" } },
        orderBy: { dueDate: "asc" },
      }),
    ]);

    const annotatedMilestones = milestones.map((m) => ({
      ...m,
      overdue: isMilestoneOverdue(m),
      atRisk: isMilestoneAtRisk(m),
    }));

    return ok({ projects, tasks, milestones: annotatedMilestones });
  } catch (err) {
    return handleRouteError(err);
  }
}
