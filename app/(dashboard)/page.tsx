import type { Metadata } from "next";
import { TaskQueue } from "@/components/tasks/TaskQueue";
import { urgencyOf } from "@/components/tasks/types";
import { getMockTasks } from "./_mock-tasks";

export const metadata: Metadata = {
  title: "My Tasks",
};

/**
 * Per-user and time-relative ("Today", "2 days overdue") — must never be
 * prerendered at build time or shared between recruiters.
 */
export const dynamic = "force-dynamic";

const TODAY_FORMAT = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default function HomePage() {
  // Placeholder data — see `_mock-tasks.ts` for the real-fetch swap.
  const tasks = getMockTasks();

  const overdue = tasks.filter((t) => urgencyOf(t.dueDate) === "overdue").length;
  const dueToday = tasks.filter((t) => urgencyOf(t.dueDate) === "today").length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-md border-b border-border pb-lg">
        <div>
          <h1 className="text-title text-text">My Tasks</h1>
          <p className="mt-2xs max-w-[62ch] text-body text-muted">
            Every application you own with an outstanding next action, soonest
            first.
          </p>
        </div>
        <p className="font-data text-body-sm tabular-nums text-muted">
          {TODAY_FORMAT.format(new Date())}
        </p>
      </div>

      {tasks.length > 0 && (
        <p className="mt-md flex flex-wrap items-center gap-x-md gap-y-2xs text-body-sm text-muted">
          <span className="font-data tabular-nums text-text">
            {tasks.length} open
          </span>
          <span className="flex items-center gap-xs">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-error" />
            <span className="font-data tabular-nums">{overdue}</span> overdue
          </span>
          <span className="flex items-center gap-xs">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-warning"
            />
            <span className="font-data tabular-nums">{dueToday}</span> due today
          </span>
        </p>
      )}

      <div className="mt-xl">
        <TaskQueue tasks={tasks} />
      </div>
    </>
  );
}
