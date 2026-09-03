import { ProjectStage, ProjectHealth } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { requireProjectPermission } from "@/lib/project-authz";
import { isMilestoneOverdue, milestoneRequiresDelayReason } from "@/lib/project-health";
import { ok, handleRouteError } from "@/lib/api-response";

const ALL_STAGES = Object.values(ProjectStage);
const ALL_HEALTHS = Object.values(ProjectHealth);

export async function GET() {
  try {
    const user = await requireAuth();
    requireProjectPermission(user, "VIEW_MANAGEMENT_DASHBOARD");

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      totalActiveProjects,
      stageCounts,
      healthCounts,
      expectedThisMonth,
      upcomingMilestonesRaw,
      overdueMilestonesRaw,
      analystGroups,
      developerGroups,
      attentionProjects,
    ] = await Promise.all([
      prisma.project.count({ where: { currentStage: { not: ProjectStage.COMPLETED } } }),
      prisma.project.groupBy({ by: ["currentStage"], _count: { _all: true } }),
      prisma.project.groupBy({ by: ["health"], _count: { _all: true } }),
      prisma.project.findMany({
        where: {
          expectedDeliveryDate: { gte: startOfMonth, lt: startOfNextMonth },
        },
        select: { id: true, name: true, currentStage: true, expectedDeliveryDate: true },
      }),
      prisma.milestone.findMany({
        where: {
          status: { not: "DONE" },
          dueDate: { gte: now, lte: sevenDaysOut },
        },
        include: {
          project: { select: { id: true, name: true } },
          owner: { select: { id: true, name: true } },
        },
        orderBy: { dueDate: "asc" },
        take: 20,
      }),
      prisma.milestone.findMany({
        where: {
          status: { not: "DONE" },
          dueDate: { lt: now },
        },
        include: {
          project: { select: { id: true, name: true } },
          owner: { select: { id: true, name: true } },
        },
        orderBy: { dueDate: "asc" },
        take: 20,
      }),
      prisma.project.groupBy({
        by: ["analystId"],
        where: { analystId: { not: null }, currentStage: { not: ProjectStage.COMPLETED } },
        _count: { _all: true },
      }),
      prisma.project.groupBy({
        by: ["developerId"],
        where: { developerId: { not: null }, currentStage: { not: ProjectStage.COMPLETED } },
        _count: { _all: true },
      }),
      prisma.project.findMany({
        where: { health: { in: [ProjectHealth.BLOCKED, ProjectHealth.DELAYED] } },
        select: {
          id: true,
          name: true,
          health: true,
          currentStage: true,
          blockers: {
            where: { resolvedAt: null },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { description: true },
          },
          milestones: {
            where: { status: { not: "DONE" } },
            orderBy: { dueDate: "asc" },
            select: { name: true, dueDate: true, status: true, id: true },
          },
        },
      }),
    ]);

    const byStage = ALL_STAGES.map((stage) => ({
      stage,
      count: stageCounts.find((s) => s.currentStage === stage)?._count._all ?? 0,
    }));

    const byHealth = ALL_HEALTHS.map((health) => ({
      health,
      count: healthCounts.find((h) => h.health === health)?._count._all ?? 0,
    }));

    const upcomingMilestones = upcomingMilestonesRaw.map((m) => ({
      id: m.id,
      name: m.name,
      dueDate: m.dueDate,
      projectId: m.project.id,
      projectName: m.project.name,
      ownerId: m.owner.id,
      ownerName: m.owner.name,
    }));

    const overdueMilestones = overdueMilestonesRaw.map((m) => ({
      id: m.id,
      name: m.name,
      dueDate: m.dueDate,
      projectId: m.project.id,
      projectName: m.project.name,
      ownerId: m.owner.id,
      ownerName: m.owner.name,
    }));

    const userIds = [
      ...new Set(
        [
          ...analystGroups.map((g) => g.analystId),
          ...developerGroups.map((g) => g.developerId),
        ].filter((v): v is string => v !== null),
      ),
    ];
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : [];
    const userNameById = new Map(users.map((u) => [u.id, u.name]));

    const analystWorkload = analystGroups
      .filter((g) => g.analystId !== null)
      .map((g) => ({
        userId: g.analystId as string,
        name: userNameById.get(g.analystId as string) ?? "Unknown",
        activeProjectCount: g._count._all,
      }));

    const developerWorkload = developerGroups
      .filter((g) => g.developerId !== null)
      .map((g) => ({
        userId: g.developerId as string,
        name: userNameById.get(g.developerId as string) ?? "Unknown",
        activeProjectCount: g._count._all,
      }));

    const attentionItemsRaw = await Promise.all(
      attentionProjects.map(async (p) => {
        let reason: string | null = null;
        let needsDelayReason = false;

        if (p.health === ProjectHealth.BLOCKED) {
          reason = p.blockers[0]?.description ?? null;
        } else if (p.health === ProjectHealth.DELAYED) {
          const overdue = p.milestones
            .filter((m) => isMilestoneOverdue(m))
            .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
          reason = overdue[0]?.name ?? null;
          if (overdue[0]) {
            needsDelayReason = await milestoneRequiresDelayReason(overdue[0].id);
          }
        }

        return {
          id: p.id,
          name: p.name,
          health: p.health,
          currentStage: p.currentStage,
          reason,
          needsDelayReason,
        };
      }),
    );

    const attentionItems = attentionItemsRaw
      .sort((a, b) => {
        if (a.health === b.health) return 0;
        return a.health === ProjectHealth.BLOCKED ? -1 : 1;
      })
      .slice(0, 25);

    return ok({
      totalActiveProjects,
      byStage,
      byHealth,
      expectedThisMonth,
      upcomingMilestones,
      overdueMilestones,
      analystWorkload,
      developerWorkload,
      attentionItems,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
