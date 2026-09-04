import Link from "next/link";
import { daysSince, formatDate } from "@/lib/format";
import { ListEmpty, LIST_ROW } from "./Panel";

export type MilestoneRow = {
  id: string;
  name: string;
  dueDate: Date;
  project: { id: string; name: string };
  owner: { name: string };
};

/**
 * Milestone rows for the two schedule panels (overdue / due soon).
 *
 * One shape serves both, differing only in the trailing figure: an overdue row
 * reports lateness in days (a duration, the thing being escalated), an upcoming
 * row reports the date itself (a commitment, the thing being planned around).
 * Both are set in the data face with tabular figures so a column of them
 * aligns.
 */
export function MilestoneList({
  milestones,
  variant,
  now,
  emptyNote,
}: {
  milestones: readonly MilestoneRow[];
  variant: "overdue" | "upcoming";
  /** Passed in so the server render and its rehydration agree. */
  now: Date;
  emptyNote: string;
}) {
  if (milestones.length === 0) {
    return <ListEmpty>{emptyNote}</ListEmpty>;
  }

  return (
    <ul>
      {milestones.map((m) => {
        const day = m.dueDate.toISOString().slice(0, 10);
        const lateDays = daysSince(m.dueDate.toISOString(), now);
        return (
          <li key={m.id} className={LIST_ROW}>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body-1 text-text-high">
                {m.name}
              </span>
              <span className="mt-ds-xxs flex items-center gap-ds-md text-caption-2 text-text-low">
                <Link
                  href={`/projects/${m.project.id}`}
                  className="truncate underline-offset-2 hover:text-primary-high hover:underline"
                >
                  {m.project.name}
                </Link>
                <span aria-hidden="true">·</span>
                <span className="truncate">{m.owner.name}</span>
              </span>
            </span>

            {variant === "overdue" ? (
              <time
                dateTime={day}
                className="shrink-0 font-data text-caption-2 tabular-nums text-danger-high"
              >
                {lateDays}d late
              </time>
            ) : (
              <time
                dateTime={day}
                className="shrink-0 font-data text-caption-2 tabular-nums text-text-med"
              >
                {formatDate(day)}
              </time>
            )}
          </li>
        );
      })}
    </ul>
  );
}
