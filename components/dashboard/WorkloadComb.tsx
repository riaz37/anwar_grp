import type { CSSProperties } from "react";

const TICKS = 20;
/** Capped so the per-row stagger never outlasts the page's entrance beat. */
const MAX_STAGGER = 12;

function ticks(ratio: number): boolean[] {
  const filled = Math.max(0, Math.min(TICKS, Math.round(ratio * TICKS)));
  return Array.from({ length: TICKS }, (_, i) => i < filled);
}

/**
 * Who is carrying the load, as a comb of ticks filled to how busy they are
 * relative to whoever is busiest — a comb can be counted, where a rounded
 * progress-bar widget reads as borrowed from someone else's design system.
 */
export function WorkloadComb({
  rows,
  emptyNote,
}: {
  rows: { userId: string; name: string; count: number }[];
  emptyNote: string;
}) {
  if (rows.length === 0) {
    return <p className="text-body-1 text-text-low">{emptyNote}</p>;
  }

  const ceiling = Math.max(1, ...rows.map((r) => r.count));
  const shown = rows.slice(0, 8);

  return (
    <ol className="flex flex-col gap-ds-5xl">
      {shown.map((row) => (
        <li key={row.userId} className="min-w-0">
          <div className="flex items-baseline justify-between gap-ds-md">
            <span className="truncate text-body-2 font-medium text-text-high">
              {row.name}
            </span>
            <span className="shrink-0 font-data text-caption-2 tabular-nums text-text-low">
              {row.count} active
            </span>
          </div>
          <div
            role="img"
            aria-label={`${row.name}: ${row.count} active projects`}
            className="mt-ds-xs flex h-3 items-end gap-px"
          >
            {ticks(row.count / ceiling).map((filled, i) => (
              <span
                key={i}
                style={
                  { "--i": Math.min(i, MAX_STAGGER) } as CSSProperties
                }
                className={`rise-in block min-w-[2px] flex-1 origin-bottom ${
                  filled ? "h-full bg-primary-med" : "h-1/2 bg-outline-low"
                }`}
              />
            ))}
          </div>
        </li>
      ))}
      {rows.length > shown.length && (
        <li className="text-caption-2 text-text-low">
          +{rows.length - shown.length} more
        </li>
      )}
    </ol>
  );
}
