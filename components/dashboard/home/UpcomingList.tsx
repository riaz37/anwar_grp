import Link from "next/link";
import { cn } from "@/lib/utils";
import { HOME_ROW_CLASS, HomeCardList } from "./HomeCard";

export type UpcomingItem = {
  id: string;
  kind: "task" | "milestone";
  label: string;
  projectId: string;
  projectName: string;
  dueDate: Date;
  overdue: boolean;
};

const KIND_LABELS: Record<UpcomingItem["kind"], string> = {
  task: "Task",
  milestone: "Milestone",
};

/* Locale/zone pinned to match `lib/format` — the same record must read
   identically for every reader comparing a shared portfolio. */
const DAY_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  timeZone: "UTC",
});
const MONTH_FORMAT = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  timeZone: "UTC",
});

const DAY_MS = 86_400_000;

function utcMidnight(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Whole calendar days from `now` to `due`; negative once the date has passed. */
function calendarDaysUntil(due: Date, now: Date): number {
  return Math.round((utcMidnight(due) - utcMidnight(now)) / DAY_MS);
}

function dueLabel(days: number, overdue: boolean): string {
  if (overdue) return days < 0 ? `${Math.abs(days)}d late` : "Late today";
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `in ${days}d`;
}

/**
 * The dated calendar tile is the row's anchor: a reader scanning this panel is
 * looking for *when*, so the date leads and the description follows, rather
 * than the date sitting as trailing metadata. Overdue tiles repaint to the
 * danger recipe (wash + outline + high) so lateness is visible in the scan
 * column itself, not only in the pill at the end of the row.
 */
function DateTile({ date, overdue }: { date: Date; overdue: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-10 shrink-0 flex-col items-center justify-center rounded-md border font-data tabular-nums",
        overdue
          ? "border-danger-outline bg-danger-wash text-danger-high"
          : "border-outline-low bg-surface-2 text-text-med",
      )}
    >
      <span className="text-body-1 font-semibold leading-none">
        {DAY_FORMAT.format(date)}
      </span>
      <span className="mt-[3px] text-[10px] uppercase leading-none tracking-[0.06em] text-text-low">
        {MONTH_FORMAT.format(date)}
      </span>
    </span>
  );
}

export function UpcomingList({
  items,
  now,
}: {
  items: readonly UpcomingItem[];
  now: Date;
}) {
  return (
    <HomeCardList>
      {items.map((item) => {
        const days = calendarDaysUntil(item.dueDate, now);
        const iso = item.dueDate.toISOString().slice(0, 10);
        return (
          <li key={`${item.kind}-${item.id}`} className={HOME_ROW_CLASS}>
            <DateTile date={item.dueDate} overdue={item.overdue} />

            <div className="min-w-0 flex-1">
              <p className="truncate text-body-2 font-semibold text-text-high">
                {item.label}
              </p>
              <p className="mt-ds-xxs flex min-w-0 items-center gap-ds-sm text-caption-2 text-text-low">
                <span className="shrink-0">{KIND_LABELS[item.kind]}</span>
                <span aria-hidden="true" className="shrink-0">
                  ·
                </span>
                <Link
                  href={`/projects/${item.projectId}`}
                  className="truncate underline-offset-2 hover:text-primary-high hover:underline"
                >
                  {item.projectName}
                </Link>
              </p>
            </div>

            <time
              dateTime={iso}
              className={cn(
                "shrink-0 rounded-pill border px-ds-md py-ds-xxs font-data text-caption-2 tabular-nums",
                item.overdue
                  ? "border-danger-outline bg-danger-wash text-danger-high"
                  : "border-outline-low text-text-med",
              )}
            >
              {dueLabel(days, item.overdue)}
            </time>
          </li>
        );
      })}
    </HomeCardList>
  );
}
