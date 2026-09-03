import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ProjectHealth, ProjectStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { hasProjectPermission } from "@/lib/project-authz";
import { isMilestoneOverdue, milestoneRequiresDelayReason } from "@/lib/project-health";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/StatusPill";
import { formatDate } from "@/lib/format";
import { HEALTH_LABELS, HEALTH_TONE, STAGE_LABELS, STAGE_ORDER } from "@/components/projects/projectTone";

export const metadata: Metadata = { title: "Management Dashboard" };
export const dynamic = "force-dynamic";

export default async function ManagementDashboardPage() {
  const session = await getSession();
  if (!session || !hasProjectPermission(session.role, "VIEW_MANAGEMENT_DASHBOARD")) {
    redirect("/");
  }

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
      where: { expectedDeliveryDate: { gte: startOfMonth, lt: startOfNextMonth } },
      select: { id: true, name: true, currentStage: true, expectedDeliveryDate: true },
      orderBy: { expectedDeliveryDate: "asc" },
    }),
    prisma.milestone.findMany({
      where: { status: { not: "DONE" }, dueDate: { gte: now, lte: sevenDaysOut } },
      include: { project: { select: { id: true, name: true } }, owner: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
    prisma.milestone.findMany({
      where: { status: { not: "DONE" }, dueDate: { lt: now } },
      include: { project: { select: { id: true, name: true } }, owner: { select: { name: true } } },
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
          select: { id: true, name: true, dueDate: true, status: true },
        },
      },
    }),
  ]);

  const byStage = STAGE_ORDER.map((stage) => ({
    stage,
    count: stageCounts.find((s) => s.currentStage === stage)?._count._all ?? 0,
  }));
  const byHealth = (Object.keys(HEALTH_LABELS) as ProjectHealth[]).map((health) => ({
    health,
    count: healthCounts.find((h) => h.health === health)?._count._all ?? 0,
  }));

  const userIds = [
    ...new Set(
      [...analystGroups.map((g) => g.analystId), ...developerGroups.map((g) => g.developerId)].filter(
        (v): v is string => v !== null,
      ),
    ),
  ];
  const workUsers = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(workUsers.map((u) => [u.id, u.name]));

  const analystWorkload = analystGroups
    .filter((g) => g.analystId !== null)
    .map((g) => ({ userId: g.analystId as string, name: nameById.get(g.analystId as string) ?? "Unknown", count: g._count._all }));
  const developerWorkload = developerGroups
    .filter((g) => g.developerId !== null)
    .map((g) => ({ userId: g.developerId as string, name: nameById.get(g.developerId as string) ?? "Unknown", count: g._count._all }));

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
          if (overdue[0]) needsDelayReason = await milestoneRequiresDelayReason(overdue[0].id);
        }
        return { id: p.id, name: p.name, health: p.health, currentStage: p.currentStage, reason, needsDelayReason };
      }),
    )
  )
    .sort((a, b) => (a.health === b.health ? 0 : a.health === ProjectHealth.BLOCKED ? -1 : 1))
    .slice(0, 25);

  return (
    <>
      <PageHeader
        title="Management Dashboard"
        description="Which projects need your attention today — and why."
      />

      <section className="mt-lg">
        <h2 className="text-body font-semibold text-text">Needs attention</h2>
        {attentionItems.length === 0 ? (
          <p className="mt-sm text-body-sm text-muted">
            Nothing blocked or delayed right now — the portfolio is healthy.
          </p>
        ) : (
          <ul className="mt-md flex flex-col gap-sm">
            {attentionItems.map((item) => (
              <li key={item.id} className="rounded-md border border-border p-md text-body-sm">
                <div className="flex flex-wrap items-center gap-sm">
                  <Pill tone={HEALTH_TONE[item.health]} label={HEALTH_LABELS[item.health]} />
                  <Link href={`/projects/${item.id}`} className="font-medium text-text hover:text-accent-ink">
                    {item.name}
                  </Link>
                  <span className="text-muted">— {STAGE_LABELS[item.currentStage]}</span>
                  {item.needsDelayReason && <Pill tone="warning" label="Delay reason needed" />}
                </div>
                {item.reason && <p className="mt-2xs text-muted">{item.reason}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-2xl grid grid-cols-1 gap-lg lg:grid-cols-2">
        <section>
          <h2 className="text-body font-semibold text-text">
            Portfolio — <span className="font-data tabular-nums">{totalActiveProjects}</span> active projects
          </h2>
          <ul className="mt-md flex flex-col gap-2xs">
            {byStage.map((s) => (
              <li key={s.stage} className="flex items-center justify-between text-body-sm">
                <span className="text-text">{STAGE_LABELS[s.stage]}</span>
                <span className="font-data tabular-nums text-muted">{s.count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-body font-semibold text-text">Health</h2>
          <ul className="mt-md flex flex-col gap-2xs">
            {byHealth.map((h) => (
              <li key={h.health} className="flex items-center justify-between text-body-sm">
                <Pill tone={HEALTH_TONE[h.health]} label={HEALTH_LABELS[h.health]} />
                <span className="font-data tabular-nums text-muted">{h.count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-body font-semibold text-text">Expected this month</h2>
          {expectedThisMonth.length === 0 ? (
            <p className="mt-sm text-body-sm text-muted">Nothing due this month.</p>
          ) : (
            <ul className="mt-md flex flex-col gap-2xs">
              {expectedThisMonth.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-body-sm">
                  <Link href={`/projects/${p.id}`} className="text-text hover:text-accent-ink">
                    {p.name}
                  </Link>
                  <span className="font-data tabular-nums text-muted">
                    {formatDate(p.expectedDeliveryDate.toISOString().slice(0, 10))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-body font-semibold text-text">Overdue milestones</h2>
          {overdueMilestonesRaw.length === 0 ? (
            <p className="mt-sm text-body-sm text-muted">None overdue.</p>
          ) : (
            <ul className="mt-md flex flex-col gap-2xs">
              {overdueMilestonesRaw.map((m) => (
                <li key={m.id} className="flex items-center justify-between text-body-sm">
                  <span className="text-text">
                    {m.name} <span className="text-muted">({m.project.name})</span>
                  </span>
                  <span className="text-muted">{m.owner.name}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-body font-semibold text-text">Upcoming milestones (7 days)</h2>
          {upcomingMilestonesRaw.length === 0 ? (
            <p className="mt-sm text-body-sm text-muted">Nothing due in the next 7 days.</p>
          ) : (
            <ul className="mt-md flex flex-col gap-2xs">
              {upcomingMilestonesRaw.map((m) => (
                <li key={m.id} className="flex items-center justify-between text-body-sm">
                  <span className="text-text">
                    {m.name} <span className="text-muted">({m.project.name})</span>
                  </span>
                  <span className="text-muted">{m.owner.name}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-body font-semibold text-text">Workload</h2>
          <div className="mt-md grid grid-cols-2 gap-md">
            <div>
              <h3 className="text-caption font-medium uppercase tracking-[0.06em] text-muted">AI analysts</h3>
              <ul className="mt-xs flex flex-col gap-2xs">
                {analystWorkload.map((w) => (
                  <li key={w.userId} className="flex items-center justify-between text-body-sm">
                    <span className="text-text">{w.name}</span>
                    <span className="font-data tabular-nums text-muted">{w.count}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-caption font-medium uppercase tracking-[0.06em] text-muted">Developers</h3>
              <ul className="mt-xs flex flex-col gap-2xs">
                {developerWorkload.map((w) => (
                  <li key={w.userId} className="flex items-center justify-between text-body-sm">
                    <span className="text-text">{w.name}</span>
                    <span className="font-data tabular-nums text-muted">{w.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
