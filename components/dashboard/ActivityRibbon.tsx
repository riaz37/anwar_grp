"use client";

import { type CSSProperties, useMemo, useState } from "react";

type Bucket = { date: string; onTime: number; late: number };

function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function weekdayShort(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: "UTC",
  });
}

/**
 * One column per day, on-time share solid and late share hatched — hatch
 * rather than a paler tint so the split survives greyscale and colour-blind
 * viewing, since it's the whole point of the chart.
 *
 * Hovering a column moves the readout above the chart into a fixed place
 * instead of opening a floating tooltip, so there is nothing extra for a
 * keyboard user to tab through; the same numbers are also published as a
 * plain list for assistive tech.
 */
export function ActivityRibbon({
  buckets,
  onTimeLabel = "On time",
  lateLabel = "Late",
}: {
  buckets: Bucket[];
  onTimeLabel?: string;
  lateLabel?: string;
}) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const max = Math.max(1, ...buckets.map((b) => b.onTime + b.late));
  const totalOnTime = buckets.reduce((s, b) => s + b.onTime, 0);
  const totalLate = buckets.reduce((s, b) => s + b.late, 0);
  const today = buckets[buckets.length - 1] as Bucket | undefined;
  const active = useMemo(
    () => buckets.find((b) => b.date === hoveredDate) ?? today,
    [buckets, hoveredDate, today],
  );

  return (
    <figure className="m-0">
      <figcaption className="mb-ds-lg flex min-h-5 flex-wrap items-baseline justify-between gap-x-ds-2xl gap-y-ds-xxs text-caption-2 text-text-low">
        {active ? (
          <p>
            <span className="font-medium text-text-high">
              {dayLabel(active.date)}
            </span>
            {active.onTime + active.late === 0 ? (
              " · nothing completed"
            ) : (
              <>
                {" · "}
                <span className="font-data tabular-nums text-text-med">
                  {active.onTime}
                </span>{" "}
                on time
                {active.late > 0 && (
                  <>
                    {" · "}
                    <span className="font-data tabular-nums text-danger-high">
                      {active.late}
                    </span>{" "}
                    late
                  </>
                )}
              </>
            )}
          </p>
        ) : (
          <span />
        )}
        <span className="annotation">Peak {max}/day</span>
      </figcaption>

      <div className="relative" onMouseLeave={() => setHoveredDate(null)}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-outline-med"
        />
        <div aria-hidden="true" className="flex h-24 items-end gap-1.5 sm:gap-[3px]">
          {buckets.map((b, index) => {
            const total = b.onTime + b.late;
            const isActive = active?.date === b.date;
            return (
              <div
                key={b.date}
                onMouseEnter={() => setHoveredDate(b.date)}
                title={`${dayLabel(b.date)} — ${b.onTime} on time, ${b.late} late`}
                className="group flex h-full flex-1 cursor-default flex-col justify-end"
              >
                <div
                  className="rise-in flex origin-bottom flex-col justify-end"
                  style={
                    {
                      "--i": index,
                      height: `${(total / max) * 100}%`,
                    } as CSSProperties
                  }
                >
                  {b.late > 0 && (
                    <div
                      className="hatch w-full text-danger-med"
                      style={{ height: `${(b.late / Math.max(total, 1)) * 100}%` }}
                    />
                  )}
                  {b.onTime > 0 && (
                    <div
                      className="w-full transition-colors duration-150"
                      style={{
                        height: `${(b.onTime / Math.max(total, 1)) * 100}%`,
                        backgroundColor:
                          isActive && total
                            ? "var(--primary-high)"
                            : "var(--primary-med)",
                      }}
                    />
                  )}
                </div>
                {total === 0 && <div className="h-px w-full bg-outline-low" />}
              </div>
            );
          })}
        </div>

        <div aria-hidden="true" className="h-px w-full bg-outline-low" />

        <div aria-hidden="true" className="mt-ds-md flex gap-1.5 sm:gap-[3px]">
          {buckets.map((b) => (
            <span
              key={b.date}
              className={
                "flex-1 truncate text-center text-[10px] uppercase tracking-[0.08em] tabular-nums " +
                (b.date === today?.date
                  ? "font-semibold text-text-high"
                  : "text-text-low")
              }
            >
              {b.date === today?.date ? "Today" : weekdayShort(b.date).slice(0, 2)}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-ds-lg flex flex-wrap items-center gap-x-ds-2xl gap-y-ds-xs text-caption-2 text-text-low">
        <span className="flex items-center gap-ds-xs">
          <span aria-hidden="true" className="h-2.5 w-4 bg-primary-med" />
          {onTimeLabel} ({totalOnTime})
        </span>
        <span className="flex items-center gap-ds-xs">
          <span aria-hidden="true" className="hatch h-2.5 w-4 text-danger-med" />
          {lateLabel} ({totalLate})
        </span>
      </div>

      <ul className="sr-only">
        {buckets.map((b) => (
          <li key={b.date}>
            {dayLabel(b.date)}: {b.onTime} on time, {b.late} late.
          </li>
        ))}
      </ul>
    </figure>
  );
}
