import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/** Bar fills wider than this carry their value inside the fill; anything
 *  shorter would push the label off the end of the track. */
const LABEL_INSIDE_AT = 0.8;

/**
 * One row of a horizontal bar chart: a fixed label gutter, a full-height
 * track, and the value set against the end of the bar rather than in a third
 * text column.
 *
 * Shared by the pipeline and workload charts so the two read as the same
 * instrument at different scales. The bar is the row — 24px of track, not a
 * hairline — because these panels are meant to be read as shapes first and
 * numbers second. The heaviest row in a chart takes the solid accent; every
 * other row is the same accent held back, so a bottleneck is visible before a
 * single label is read. The value is printed on every row regardless — the
 * accent is pale by design in light theme, so the bar is never the only thing
 * carrying the reading.
 */
export function BarRow({
  label,
  value,
  max,
  leading,
  labelWidth = "w-[13ch] sm:w-[18ch]",
}: {
  label: string;
  value: number;
  /** Largest value in this chart; bars are drawn against it, never a global. */
  max: number;
  leading: boolean;
  labelWidth?: string;
}) {
  const ratio = max > 0 ? value / max : 0;
  const inside = ratio >= LABEL_INSIDE_AT;

  return (
    <li className="flex items-center gap-ds-2xl">
      <span
        className={cn(
          "shrink-0 truncate text-body-1",
          labelWidth,
          leading ? "font-semibold text-text-high" : "text-text-med",
        )}
      >
        {label}
      </span>

      <span className="relative h-6 min-w-0 flex-1 overflow-hidden rounded-md bg-surface-2">
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-y-0 left-0 rounded-md",
            leading ? "bg-primary-med" : "bg-primary-med/40",
          )}
          style={{ width: `${ratio * 100}%` }}
        />
        <span
          className={cn(
            "absolute top-1/2 -translate-y-1/2 font-data text-caption-2 font-semibold tabular-nums",
            inside
              ? "text-primary-onaccent"
              : value === 0
                ? "text-text-low"
                : "text-text-high",
          )}
          style={
            inside
              ? ({ right: "8px" } as CSSProperties)
              : ({ left: `calc(${ratio * 100}% + 8px)` } as CSSProperties)
          }
        >
          {value}
        </span>
      </span>
    </li>
  );
}
