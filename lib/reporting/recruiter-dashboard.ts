import "server-only";
import { prisma } from "../prisma";
import { ApplicationStage } from "@prisma/client";

/**
 * Recruiter "My Tasks" dashboard query (BUILD_PLAN.md Sec 2.11 / Sec 5
 * "Home = My Tasks" decision, TODOS.md: LIVE indexed query, not a
 * precomputed rollup table — deliberate given MVP volume).
 *
 * Task shape mirrors components/tasks/types.ts `Task` as closely as
 * possible so the frontend's existing TaskQueue component needs minimal
 * changes — see the API route doc comment for the exact diff.
 */

/** Terminal/closed-out stages are never "open" tasks. */
const CLOSED_STAGES: ApplicationStage[] = [
  ApplicationStage.JOINED,
  ApplicationStage.REJECTED,
  ApplicationStage.WITHDRAWN,
  ApplicationStage.REDIRECTED,
  ApplicationStage.CLOSED,
];

export interface RecruiterTaskItem {
  id: string;
  candidateId: string;
  candidateName: string;
  requisitionRef: string;
  requisitionTitle: string;
  stage: ApplicationStage;
  nextAction: string;
  owner: string;
  /** ISO date, YYYY-MM-DD. */
  dueDate: string;
}

export interface StageCount {
  stage: ApplicationStage;
  count: number;
}

export interface RecruiterDashboardSummary {
  totalOpenTasks: number;
  overdueCount: number;
  dueTodayCount: number;
  byStage: StageCount[];
}

export interface RecruiterDashboardResult {
  tasks: RecruiterTaskItem[];
  summary: RecruiterDashboardSummary;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * A recruiter's "my tasks" queue: open applications whose next-action
 * owner is this user, with a due date set (an application with no
 * next-action/due-date has nothing actionable to surface here yet).
 *
 * Scoping decision: keyed on `nextActionOwnerId`, not
 * `assignedRecruiterId` — the frontend's Task type/TaskQueue models
 * "an application whose next action is assigned to the current user"
 * (see components/tasks/types.ts), which is a narrower, more useful
 * "what do I need to do today" view than "everything I'm the recruiter
 * on." A recruiter can still list everything they own via
 * GET /api/v1/applications?assignedRecruiterId=me.
 */
export async function getRecruiterDashboard(
  userId: string,
  now: Date = new Date(),
): Promise<RecruiterDashboardResult> {
  const applications = await prisma.application.findMany({
    where: {
      nextActionOwnerId: userId,
      nextActionDueDate: { not: null },
      currentStage: { notIn: CLOSED_STAGES },
    },
    include: {
      candidate: { select: { id: true, name: true } },
      requisition: { select: { id: true, position: true } },
      nextActionOwner: { select: { name: true } },
    },
    orderBy: { nextActionDueDate: "asc" },
  });

  const tasks: RecruiterTaskItem[] = applications.map((app) => ({
    id: app.id,
    candidateId: app.candidate.id,
    candidateName: app.candidate.name,
    requisitionRef: app.requisition.id,
    requisitionTitle: app.requisition.position,
    stage: app.currentStage,
    nextAction: app.nextAction ?? "",
    owner: app.nextActionOwner?.name ?? "",
    // nextActionDueDate is guaranteed non-null by the where clause above.
    dueDate: toIsoDate(app.nextActionDueDate as Date),
  }));

  const todayIso = toIsoDate(now);
  let overdueCount = 0;
  let dueTodayCount = 0;
  const stageCounts = new Map<ApplicationStage, number>();

  for (const task of tasks) {
    if (task.dueDate < todayIso) overdueCount += 1;
    else if (task.dueDate === todayIso) dueTodayCount += 1;

    stageCounts.set(task.stage, (stageCounts.get(task.stage) ?? 0) + 1);
  }

  const byStage: StageCount[] = [...stageCounts.entries()].map(
    ([stage, count]) => ({ stage, count }),
  );

  return {
    tasks,
    summary: {
      totalOpenTasks: tasks.length,
      overdueCount,
      dueTodayCount,
      byStage,
    },
  };
}
