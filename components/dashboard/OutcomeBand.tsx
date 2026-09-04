import type { CSSProperties } from "react";

/**
 * The whole set as one proportional band — a rectangle compares lengths,
 * which people read accurately, where a donut compares angles, which they
 * don't — followed by each slice's own reading, set at headline size rather
 * than tucked into a legend chip: "6 blocked, 24%" is the fact management
 * actually needs, not a coloured dot with a number squeezed beside it.
 */
export function OutcomeBand({
  slices,
  total,
}: {
  slices: { key: string; label: string; count: number; className: string }[];
  total: number;
}) {
  if (total === 0) {
    return <div className="h-3 w-full rounded-full bg-outline-low" />;
  }

  return (
    <div>
      <div
        role="img"
        aria-label={slices
          .map((s) => `${s.label}: ${s.count} of ${total}`)
          .join("; ")}
        className="flex h-3 w-full gap-px overflow-hidden rounded-full bg-outline-low"
      >
        {slices
          .filter((s) => s.count > 0)
          .map((s, index) => (
            <div
              key={s.key}
              title={`${s.label} — ${s.count}`}
              style={
                { flexGrow: s.count, "--i": index } as CSSProperties
              }
              className={`rise-in h-full min-w-[3px] origin-left ${s.className}`}
            />
          ))}
      </div>

      <dl className="mt-ds-6xl grid grid-cols-2 gap-x-ds-2xl gap-y-ds-6xl sm:grid-cols-4">
        {slices.map((s) => {
          const share = Math.round((s.count / total) * 100);
          return (
            <div key={s.key} className="min-w-0 border-t border-outline-low pt-ds-md">
              <dt className="flex items-center gap-ds-xs text-caption-2 text-text-low">
                <span
                  aria-hidden="true"
                  className={`size-2 shrink-0 rounded-[1px] ${s.className}`}
                />
                <span className="truncate">{s.label}</span>
              </dt>
              <dd className="mt-ds-xs flex items-baseline gap-ds-xs font-data text-heading-1 font-semibold tabular-nums text-text-high">
                {s.count}
                <span className="text-caption-2 font-medium tabular-nums text-text-low">
                  {share}%
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
