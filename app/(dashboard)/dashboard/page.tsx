import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProjectHealth, ProjectStage } from "@prisma/client";
import {
  AlarmClock,
  CalendarClock,
  FolderKanban,
  TriangleAlert,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { hasProjectPermission } from "@/lib/project-authz";
import {
  isMilestoneOverdue,
  milestoneRequiresDelayReason,
} from "@/lib/project-health";
import { daysSince } from "@/lib/format";
import { alias } from "@/components/shell/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { HEALTH_LABELS, STAGE_ORDER } from "@/components/projects/projectTone";
import { Panel } from "@/components/dashboard/portfolio/Panel";
import { StatTile } from "@/components/dashboard/portfolio/StatTile";
import { AttentionList } from "@/components/dashboard/portfolio/AttentionList";
import { HealthMix } from "@/components/dashboard/portfolio/HealthMix";
import { CompletionTrend } from "@/components/dashboard/portfolio/CompletionTrend";
import { StageBreakdown } from "@/components/dashboard/portfolio/StageBreakdown";
import { MilestoneList } from "@/components/dashboard/portfolio/MilestoneList";
import { DeliveryList } from "@/components/dashboard/portfolio/DeliveryList";
import { WorkloadList } from "@/components/dashboard/portfolio/WorkloadList";

export const metadata: Metadata = { title: "Management Dashboard" };
export const dynamic = "force-dynamic";

/** Rows fetched per milestone list. Anything beyond this is reported as a
 *  count rather than silently dropped. */
const MILESTONE_LIST_LIMIT = 8;
/** Projects shown in the decision queue before it becomes a scroll. */
const ATTENTION_LIST_LIMIT = 25;
/** Window for the completion trend chart. */
const TREND_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const ActiveIcon = alias(FolderKanban);
const AttentionIcon = alias(TriangleAlert);
const OverdueIcon = alias(AlarmClock);
const UpcomingIcon = alias(CalendarClock);

export default async function ManagementDashboardPage() {
  const session = await getSession();
  if (!session || !hasProjectPermission(session.role, "VIEW_MANAGEMENT_DASHBOARD")) {
    redirect("/home");
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const sevenDaysOut = new Date(now.getTime() + 7 * DAY_MS);
  const trendStart = new Date(now.getTime() - (TREND_DAYS - 1) * DAY_MS);

  const overdueWhere = {
    status: { not: "DONE" as const },
    dueDate: { lt: now },
  };
  const upcomingWhere = {
    status: { not: "DONE" as const },
    dueDate: { gte: now, lte: sevenDaysOut },
  };

  const [
    totalActiveProjects,
    stageCounts,
    healthCounts,
    expectedThisMonth,
    upcomingMilestones,
    upcomingMilestoneTotal,
    overdueMilestones,
    overdueMilestoneTotal,
    analystGroups,
    developerGroups,
    attentionProjects,
    oldestActiveProject,
    recentlyCompletedMilestones,
  ] = await Promise.all([
    prisma.project.count({
      where: { currentStage: { not: ProjectStage.COMPLETED } },
    }),
    prisma.project.groupBy({ by: ["currentStage"], _count: { _all: true } }),
    prisma.project.groupBy({ by: ["health"], _count: { _all: true } }),
    prisma.project.findMany({
      where: { expectedDeliveryDate: { gte: startOfMonth, lt: startOfNextMonth } },
      select: {
        id: true,
        name: true,
        currentStage: true,
        expectedDeliveryDate: true,
      },
      orderBy: { expectedDeliveryDate: "asc" },
    }),
    prisma.milestone.findMany({
      where: upcomingWhere,
      select: {
        id: true,
        name: true,
        dueDate: true,
        project: { select: { id: true, name: true } },
        owner: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: MILESTONE_LIST_LIMIT,
    }),
    prisma.milestone.count({ where: upcomingWhere }),
    prisma.milestone.findMany({
      where: overdueWhere,
      select: {
        id: true,
        name: true,
        dueDate: true,
        project: { select: { id: true, name: true } },
        owner: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: MILESTONE_LIST_LIMIT,
    }),
    prisma.milestone.count({ where: overdueWhere }),
    prisma.project.groupBy({
      by: ["analystId"],
      where: {
        analystId: { not: null },
        currentStage: { not: ProjectStage.COMPLETED },
      },
      _count: { _all: true },
    }),
    prisma.project.groupBy({
      by: ["developerId"],
      where: {
        developerId: { not: null },
        currentStage: { not: ProjectStage.COMPLETED },
      },
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
          select: { id: true, name: true, dueDate: true, status: true },
        },
      },
    }),
    // Longest-running open project — the one figure the stage breakdown can't
    // show: which work has been in flight longest without reaching COMPLETED.
    prisma.project.findFirst({
      where: { currentStage: { not: ProjectStage.COMPLETED } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.milestone.findMany({
      where: { completedAt: { gte: trendStart } },
      select: { completedAt: true, dueDate: true },
    }),
  ]);

  const countForStage = (stage: ProjectStage) =>
    stageCounts.find((s) => s.currentStage === stage)?._count._all ?? 0;

  // COMPLETED is split out of the stage list: the portfolio figure counts
  // active projects, so folding finished work into the same column would make
  // the rows fail to add up to the number in the header.
  const activeByStage = STAGE_ORDER.filter(
    (stage) => stage !== ProjectStage.COMPLETED,
  ).map((stage) => ({ stage, count: countForStage(stage) }));
  const completedCount = countForStage(ProjectStage.COMPLETED);

  const byHealth = (Object.keys(HEALTH_LABELS) as ProjectHealth[]).map(
    (health) => ({
      health,
      count: healthCounts.find((h) => h.health === health)?._count._all ?? 0,
    }),
  );
  const needsDecisionCount = byHealth
    .filter(
      (h) =>
        h.health === ProjectHealth.BLOCKED || h.health === ProjectHealth.DELAYED,
    )
    .reduce((sum, h) => sum + h.count, 0);

  const oldestActiveDays = oldestActiveProject
    ? daysSince(oldestActiveProject.createdAt.toISOString(), now)
    : null;

  // Completions per day over the trailing window, split into on-time
  // (completed at or before its due date) and late.
  const trendBuckets = Array.from({ length: TREND_DAYS }, (_, i) => {
    const date = new Date(trendStart.getTime() + i * DAY_MS);
    return { date: date.toISOString().slice(0, 10), onTime: 0, late: 0 };
  });
  for (const m of recentlyCompletedMilestones) {
    if (!m.completedAt) continue;
    const key = m.completedAt.toISOString().slice(0, 10);
    const bucket = trendBuckets.find((b) => b.date === key);
    if (!bucket) continue;
    if (m.completedAt.getTime() <= m.dueDate.getTime()) bucket.onTime += 1;
    else bucket.late += 1;
  }

  const userIds = [
    ...new Set(
      [
        ...analystGroups.map((g) => g.analystId),
        ...developerGroups.map((g) => g.developerId),
      ].filter((v): v is string => v !== null),
    ),
  ];
  const workUsers = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameById = new Map(workUsers.map((u) => [u.id, u.name]));

  const toWorkload = (
    groups: { key: string | null; count: number }[],
  ): { userId: string; name: string; count: number }[] =>
    groups
      .filter((g): g is { key: string; count: number } => g.key !== null)
      .map((g) => ({
        userId: g.key,
        name: nameById.get(g.key) ?? "Unknown",
        count: g.count,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const analystWorkload = toWorkload(
    analystGroups.map((g) => ({ key: g.analystId, count: g._count._all })),
  );
  const developerWorkload = toWorkload(
    developerGroups.map((g) => ({ key: g.developerId, count: g._count._all })),
  );

  const attentionItems = (
    await Promise.all(
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
    )
  )
    .sort((a, b) =>
      a.health === b.health ? 0 : a.health === ProjectHealth.BLOCKED ? -1 : 1,
    )
    .slice(0, ATTENTION_LIST_LIMIT);

  const listMeta = (shown: number, total: number, noun: string) => {
    if (total === 0) return undefined;
    if (total > shown) return `${shown} of ${total}`;
    return `${total} ${noun}${total === 1 ? "" : "s"}`;
  };

  return (
    <>
      <PageHeader
        title="Management Dashboard"
        description="Which projects need a decision today: what is stuck, what is late, and who is carrying the load."
        actions={
          <ButtonLink href="/projects" variant="primary">
            Open the portfolio
          </ButtonLink>
        }
      />

      {/* Portfolio figures. Four counts read against each other, so they share
          one row and one type treatment; only a count that needs acting on
          takes colour. */}
      <div className="mt-ds-7xl grid grid-cols-1 gap-ds-2xl sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          index={0}
          label="Active projects"
          value={totalActiveProjects}
          hint={
            oldestActiveDays === null
              ? `${completedCount} completed to date`
              : `Oldest running ${oldestActiveDays}d · ${completedCount} completed`
          }
          icon={ActiveIcon}
          href="/projects"
        />
        <StatTile
          index={1}
          label="Needs a decision"
          value={needsDecisionCount}
          hint="Blocked or delayed right now"
          icon={AttentionIcon}
          tone="warning"
        />
        <StatTile
          index={2}
          label="Overdue milestones"
          value={overdueMilestoneTotal}
          hint="Past their due date, still open"
          icon={OverdueIcon}
          tone="error"
        />
        <StatTile
          index={3}
          label="Due within 7 days"
          value={upcomingMilestoneTotal}
          hint="Open milestones landing this week"
          icon={UpcomingIcon}
        />
      </div>

      <div className="mt-ds-5xl grid grid-cols-1 gap-ds-2xl lg:grid-cols-12">
        <Panel
          className="rise-in lg:col-span-8"
          title="Needs attention"
          description="Blocked and delayed projects, with the reason on the row."
          meta={listMeta(
            attentionItems.length,
            needsDecisionCount,
            "project",
          )}
          padded={false}
        >
          <AttentionList items={attentionItems} />
        </Panel>

        <div className="flex flex-col gap-ds-2xl lg:col-span-4">
          <Panel className="rise-in" title="Portfolio health">
            <HealthMix slices={byHealth} />
          </Panel>

          <Panel
            className="rise-in"
            title="Expected this month"
            meta={
              expectedThisMonth.length > 0
                ? `${expectedThisMonth.length} project${expectedThisMonth.length === 1 ? "" : "s"}`
                : undefined
            }
            padded={false}
          >
            <DeliveryList projects={expectedThisMonth} />
          </Panel>
        </div>
      </div>

      <div className="mt-ds-2xl grid grid-cols-1 gap-ds-2xl lg:grid-cols-12">
        <Panel
          className="rise-in lg:col-span-7"
          title="Milestones completed"
          description={`Per day over the last ${TREND_DAYS} days`}
        >
          <CompletionTrend buckets={trendBuckets} />
        </Panel>

        <Panel
          className="rise-in lg:col-span-5"
          title="Pipeline by stage"
          description="Active projects only"
          meta={`${completedCount} completed excluded`}
        >
          <StageBreakdown stages={activeByStage} />
        </Panel>
      </div>

      <div className="mt-ds-2xl grid grid-cols-1 gap-ds-2xl lg:grid-cols-2">
        <Panel
          className="rise-in"
          title="Overdue milestones"
          meta={listMeta(
            overdueMilestones.length,
            overdueMilestoneTotal,
            "milestone",
          )}
          padded={false}
        >
          <MilestoneList
            milestones={overdueMilestones}
            variant="overdue"
            now={now}
            emptyNote="Every open milestone is still inside its due date."
          />
        </Panel>

        <Panel
          className="rise-in"
          title="Due in the next 7 days"
          meta={listMeta(
            upcomingMilestones.length,
            upcomingMilestoneTotal,
            "milestone",
          )}
          padded={false}
        >
          <MilestoneList
            milestones={upcomingMilestones}
            variant="upcoming"
            now={now}
            emptyNote="No milestone falls due in the next seven days."
          />
        </Panel>
      </div>

      <Panel
        className="mt-ds-2xl rise-in"
        title="Workload"
        description="Active projects carried per person, heaviest first."
      >
        <div className="grid grid-cols-1 gap-x-ds-9xl gap-y-ds-7xl sm:grid-cols-2">
          <WorkloadList
            heading="AI analysts"
            rows={analystWorkload}
            emptyNote="Nobody is assigned to an active project as an AI analyst yet."
          />
          <WorkloadList
            heading="Developers"
            rows={developerWorkload}
            emptyNote="Nobody is assigned to an active project as a developer yet."
          />
        </div>
      </Panel>
    </>
  );
}
