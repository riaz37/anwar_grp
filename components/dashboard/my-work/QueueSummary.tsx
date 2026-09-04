import { cn } from "@/lib/utils";

export interface QueueSummaryCounts {
  overdue: number;
  today: number;
  week: number;
  later: number;
  undated: number;
}

/** Cells in reading order: what's late, what lands next, what's queued behind. */
const CELLS = [
  {
    key: "overdue",
    label: "Past due",
    hint: "already missed its date",
    alarming: true,
  },
  {
    key: "today",
    label: "Due today",
    hint: "lands before the day is out",
    alarming: false,
  },
  {
    key: "week",
    label: "Next 7 days",
    hint: "this week's commitments",
    alarming: false,
  },
  {
    key: "rest",
    label: "Further out",
    hint: "scheduled later or undated",
    alarming: false,
  },
] as const;

/**
 * The page's opening reading: how the personal queue is distributed in time.
 *
 * One strip rather than four floating cards — these figures describe a single
 * workload, and separate boxes would read as four unrelated widgets. The rule
 * along the top is the same four numbers drawn to proportion, so the shape of
 * the week is legible before any figure is actually read. Figures are set in
 * the data face with tabular figures (DESIGN.md §2).
 */
export function QueueSummary({ counts }: { counts: QueueSummaryCounts }) {
  const rest = counts.later + counts.undated;
  const values: Record<(typeof CELLS)[number]["key"], number> = {
    overdue: counts.overdue,
    today: counts.today,
    week: counts.week,
    rest,
  };

  const total = counts.overdue + counts.today + counts.week + rest;

  const bands = [
    { key: "overdue", value: counts.overdue, fill: "bg-danger-med" },
    { key: "today", value: counts.today, fill: "bg-warn-med" },
    { key: "week", value: counts.week, fill: "bg-primary-med" },
    { key: "rest", value: rest, fill: "bg-outline-high" },
  ].filter((band) => band.value > 0);

  return (
    <section
      aria-label="Queue by due date"
      className="overflow-hidden rounded-xl border border-outline-low bg-surface-0 shadow-e1"
    >
      {/* Proportion rule. Purely a redraw of the figures below, so it is
          hidden from assistive tech rather than duplicated in words. */}
      <div aria-hidden="true" className="flex h-[3px] w-full bg-surface-2">
        {bands.map((band) => (
          <span
            key={band.key}
            className={band.fill}
            style={{ width: `${(band.value / Math.max(1, total)) * 100}%` }}
          />
        ))}
      </div>

      <dl className="grid grid-cols-2 lg:grid-cols-4">
        {CELLS.map((cell, i) => {
          const value = values[cell.key];
          const alarming = cell.alarming && value > 0;
          return (
            <div
              key={cell.key}
              className={cn(
                "px-ds-5xl py-ds-4xl",
                i % 2 === 0 && "border-r border-outline-low",
                i < 2 && "border-b border-outline-low",
                "lg:border-b-0",
                i === CELLS.length - 1 ? "lg:border-r-0" : "lg:border-r",
              )}
            >
              <dt className="annotation">{cell.label}</dt>
              <dd
                className={cn(
                  "mt-ds-md font-data text-heading-1 font-semibold tabular-nums",
                  alarming ? "text-danger-high" : "text-text-high",
                )}
              >
                {value}
              </dd>
              <p className="mt-ds-xxs text-pretty text-caption-2 text-text-low">
                {cell.hint}
              </p>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
