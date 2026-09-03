import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProjectStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isMilestoneAtRisk, isMilestoneOverdue } from "@/lib/project-health";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/StatusPill";
import { formatDate } from "@/lib/format";
import { HEALTH_LABELS, HEALTH_TONE, STAGE_LABELS, TASK_STATUS_LABELS, TASK_STATUS_TONE } from "@/components/projects/projectTone";

export const metadata: Metadata = { title: "My Work" };
export const dynamic = "force-dynamic";

export default async function MyWorkPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [projects, tasks, milestones] = await Promise.all([
    prisma.project.findMany({
      where: {
        currentStage: { not: ProjectStage.COMPLETED },
        OR: [{ ownerId: session.userId }, { analystId: session.userId }, { developerId: session.userId }],
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.projectTask.findMany({
      where: { ownerId: session.userId, status: { not: "DONE" } },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { deadline: "asc" },
    }),
    prisma.milestone.findMany({
      where: { ownerId: session.userId, status: { not: "DONE" } },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeader title="My Work" description="Your projects, open tasks, and milestones." />

      <div className="mt-lg grid grid-cols-1 gap-2xl lg:grid-cols-2">
        <section>
          <h2 className="text-body font-semibold text-text">Your projects</h2>
          {projects.length === 0 ? (
            <p className="mt-sm text-body-sm text-muted">You&rsquo;re not assigned to any active project.</p>
          ) : (
            <ul className="mt-md flex flex-col gap-sm">
              {projects.map((p) => (
                <li key={p.id} className="rounded-md border border-border p-md text-body-sm">
                  <div className="flex flex-wrap items-center gap-sm">
                    <Link href={`/projects/${p.id}`} className="font-medium text-text hover:text-accent-ink">
                      {p.name}
                    </Link>
                    <Pill tone={HEALTH_TONE[p.health]} label={HEALTH_LABELS[p.health]} />
                  </div>
                  <p className="mt-2xs text-muted">{STAGE_LABELS[p.currentStage]}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-2xl">
          <div>
            <h2 className="text-body font-semibold text-text">Open tasks</h2>
            {tasks.length === 0 ? (
              <p className="mt-sm text-body-sm text-muted">No open tasks.</p>
            ) : (
              <ul className="mt-md flex flex-col gap-2xs">
                {tasks.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-sm rounded-sm border border-border px-sm py-xs text-body-sm">
                    <span className="min-w-0 flex-1 text-text">
                      {t.action} <span className="text-muted">({t.project.name})</span>
                    </span>
                    <Pill tone={TASK_STATUS_TONE[t.status]} label={TASK_STATUS_LABELS[t.status]} />
                    <span className="font-data tabular-nums text-muted">
                      {t.deadline ? formatDate(t.deadline.toISOString().slice(0, 10)) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="text-body font-semibold text-text">Open milestones</h2>
            {milestones.length === 0 ? (
              <p className="mt-sm text-body-sm text-muted">No open milestones.</p>
            ) : (
              <ul className="mt-md flex flex-col gap-2xs">
                {milestones.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-sm rounded-sm border border-border px-sm py-xs text-body-sm">
                    <span className="min-w-0 flex-1 text-text">
                      {m.name} <span className="text-muted">({m.project.name})</span>
                    </span>
                    {isMilestoneOverdue(m) && <Pill tone="error" label="Overdue" />}
                    {!isMilestoneOverdue(m) && isMilestoneAtRisk(m) && <Pill tone="warning" label="At risk" />}
                    <span className="font-data tabular-nums text-muted">
                      {formatDate(m.dueDate.toISOString().slice(0, 10))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
