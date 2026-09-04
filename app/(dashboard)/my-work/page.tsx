import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProjectStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isMilestoneAtRisk, isMilestoneOverdue } from "@/lib/project-health";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import {
  HEALTH_LABELS,
  HEALTH_TONE,
  MILESTONE_STATUS_LABELS,
  MILESTONE_STATUS_TONE,
  STAGE_LABELS,
  STAGE_ORDER,
  TASK_STATUS_LABELS,
  TASK_STATUS_TONE,
} from "@/components/projects/projectTone";
import { QueueSummary } from "@/components/dashboard/my-work/QueueSummary";
import { WorkQueue } from "@/components/dashboard/my-work/WorkQueue";
import { AssignedProjects } from "@/components/dashboard/my-work/AssignedProjects";
import type {
  AssignedProject,
  QueueBucket,
  QueueItem,
} from "@/components/dashboard/my-work/types";

export const metadata: Metadata = { title: "My Work" };
export const dynamic = "force-dynamic";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Whole days between today and `date`, both truncated to UTC midnight.
 *
 * UTC, not local: `lib/format` renders every date in this app in UTC so the
 * same record reads identically on every machine, and a delta computed in
 * local time would eventually disagree with the date printed beside it.
 */
function dayDelta(date: Date, todayUtcMs: number): number {
  const due = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  return Math.round((due - todayUtcMs) / MS_PER_DAY);
}

function bucketFor(days: number | null, overdue: boolean): QueueBucket {
  if (overdue) return "overdue";
  if (days === null) return "undated";
  if (days <= 0) return "today";
  if (days <= 7) return "week";
  return "later";
}

/**
 * My Work — the personal queue.
 *
 * The organising idea is time, not record type: one list of everything you
 * owe, grouped by how soon it is due, with the projects you are named on as a
 * reference rail beside it. Tasks and milestones are separate tables in the
 * schema but the same obligation to the person reading this page, so they are
 * merged into a single stream and only split again on demand, via the filter.
 */
export default async function MyWorkPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const now = new Date();
  const todayUtcMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );

  const [projects, tasks, milestones] = await Promise.all([
    prisma.project.findMany({
      where: {
        currentStage: { not: ProjectStage.COMPLETED },
        OR: [
          { ownerId: session.userId },
          { analystId: session.userId },
          { developerId: session.userId },
        ],
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

  const taskItems: QueueItem[] = tasks.map((task) => {
    const overdue =
      task.deadline !== null && task.deadline.getTime() < now.getTime();
    const days = task.deadline ? dayDelta(task.deadline, todayUtcMs) : null;
    return {
      id: `task-${task.id}`,
      kind: "task",
      title: task.action,
      projectId: task.project.id,
      projectName: task.project.name,
      dueIso: task.deadline ? task.deadline.toISOString().slice(0, 10) : null,
      daysUntilDue: days,
      bucket: bucketFor(days, overdue),
      overdue,
      statusLabel: overdue ? "Overdue" : TASK_STATUS_LABELS[task.status],
      statusTone: overdue ? "error" : TASK_STATUS_TONE[task.status],
    };
  });

  const milestoneItems: QueueItem[] = milestones.map((milestone) => {
    const overdue = isMilestoneOverdue(milestone);
    const atRisk = !overdue && isMilestoneAtRisk(milestone);
    const days = dayDelta(milestone.dueDate, todayUtcMs);
    return {
      id: `milestone-${milestone.id}`,
      kind: "milestone",
      title: milestone.name,
      projectId: milestone.project.id,
      projectName: milestone.project.name,
      dueIso: milestone.dueDate.toISOString().slice(0, 10),
      daysUntilDue: days,
      bucket: bucketFor(days, overdue),
      overdue,
      statusLabel: overdue
        ? "Overdue"
        : atRisk
          ? "At risk"
          : MILESTONE_STATUS_LABELS[milestone.status],
      statusTone: overdue
        ? "error"
        : atRisk
          ? "warning"
          : MILESTONE_STATUS_TONE[milestone.status],
    };
  });

  // Soonest first, most overdue at the very top; anything without a date sorts
  // to the end rather than pretending to be urgent.
  const queue = [...taskItems, ...milestoneItems].sort((a, b) => {
    if (a.daysUntilDue === null) return b.daysUntilDue === null ? 0 : 1;
    if (b.daysUntilDue === null) return -1;
    return a.daysUntilDue - b.daysUntilDue;
  });

  const counts = {
    overdue: queue.filter((item) => item.bucket === "overdue").length,
    today: queue.filter((item) => item.bucket === "today").length,
    week: queue.filter((item) => item.bucket === "week").length,
    later: queue.filter((item) => item.bucket === "later").length,
    undated: queue.filter((item) => item.bucket === "undated").length,
  };

  const assigned: AssignedProject[] = projects.map((project) => ({
    id: project.id,
    name: project.name,
    healthLabel: HEALTH_LABELS[project.health],
    healthTone: HEALTH_TONE[project.health],
    stageLabel: STAGE_LABELS[project.currentStage],
    stageStep: STAGE_ORDER.indexOf(project.currentStage) + 1,
    stageCount: STAGE_ORDER.length,
    dueIso: project.expectedDeliveryDate.toISOString().slice(0, 10),
  }));

  return (
    <>
      <PageHeader
        title="My Work"
        description="One queue for everything you owe — the tasks and milestones you own, ordered by how soon they are due."
        meta={
          <span className="font-data text-caption-2 tabular-nums text-text-low">
            {queue.length} open
            {counts.overdue > 0 && (
              <>
                {" · "}
                <span className="text-danger-high">
                  {counts.overdue} past due
                </span>
              </>
            )}
          </span>
        }
        actions={
          <ButtonLink href="/projects" variant="secondary">
            Browse the portfolio
          </ButtonLink>
        }
      />

      <div className="mt-ds-7xl rise-in" style={{ "--i": 0 } as CSSProperties}>
        <QueueSummary counts={counts} />
      </div>

      <div className="mt-ds-5xl grid grid-cols-1 items-start gap-ds-5xl lg:grid-cols-12">
        <div
          className="rise-in lg:col-span-8"
          style={{ "--i": 1 } as CSSProperties}
        >
          <WorkQueue items={queue} />
        </div>

        {/* Reference, not a second worklist — so it takes the narrow column and
            sticks in place while the queue scrolls past it. */}
        <div
          className="rise-in lg:sticky lg:top-ds-5xl lg:col-span-4"
          style={{ "--i": 2 } as CSSProperties}
        >
          <AssignedProjects projects={assigned} />
        </div>
      </div>
    </>
  );
}
