/**
 * One actionable item on a recruiter's queue: an application whose next action
 * is assigned to the current user. Mirrors the `Application` fields the API
 * exposes (`current_stage`, `next_action`, `owner`, `due`) — see
 * BUILD_PLAN.md Sec 2.3.
 */
export type Task = {
  /** Application id — the task is the application's outstanding next action. */
  id: string;
  candidateId: string;
  candidateName: string;
  requisitionRef: string;
  requisitionTitle: string;
  stage: string;
  nextAction: string;
  owner: string;
  /** ISO date, `YYYY-MM-DD`. */
  dueDate: string;
};

export type Urgency = "overdue" | "today" | "upcoming";

export type TaskGroup = {
  urgency: Urgency;
  title: string;
  tasks: Task[];
};

const DAY_MS = 86_400_000;

function toUtcMidnight(isoDate: string): number {
  return Date.parse(`${isoDate}T00:00:00Z`);
}

/** Whole days between `dueDate` and today. Negative = overdue. */
export function daysUntilDue(dueDate: string, now = new Date()): number {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((toUtcMidnight(dueDate) - today) / DAY_MS);
}

export function urgencyOf(dueDate: string, now = new Date()): Urgency {
  const days = daysUntilDue(dueDate, now);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  return "upcoming";
}

const GROUP_TITLES: Record<Urgency, string> = {
  overdue: "Overdue",
  today: "Due today",
  upcoming: "Coming up",
};

const GROUP_ORDER: Urgency[] = ["overdue", "today", "upcoming"];

/** Groups by urgency, then sorts each group by soonest due date. */
export function groupTasks(tasks: Task[], now = new Date()): TaskGroup[] {
  return GROUP_ORDER.map((urgency) => ({
    urgency,
    title: GROUP_TITLES[urgency],
    tasks: tasks
      .filter((task) => urgencyOf(task.dueDate, now) === urgency)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
  })).filter((group) => group.tasks.length > 0);
}

/** Human due label: "4 days overdue", "Today", "Thu 4 Sep". */
export function dueLabel(dueDate: string, now = new Date()): string {
  const days = daysUntilDue(dueDate, now);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 0) {
    const overdue = Math.abs(days);
    return `${overdue} day${overdue === 1 ? "" : "s"} overdue`;
  }
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${dueDate}T00:00:00Z`));
}
