import type { CSSProperties, ReactNode } from "react";

export type SkylineMark = {
  id: string;
  value: number;
  label: string;
  flagged?: boolean;
};

/** Enough marks to read as texture, capped so the stagger never outlasts the
 *  page reveal. */
const STAGGER_SPAN = 18;

/**
 * The page's opening figure: one big number sharing a baseline with a
 * "skyline" of individual marks, oldest/first on the left, each scaled
 * against the tallest value in the set. It answers a question a list of rows
 * can't — not just how many, but the shape of the whole set at a glance, and
 * which ones are flagged.
 *
 * A flagged mark (overdue) is drawn hatched rather than merely a different
 * fill, so the distinction survives greyscale and every kind of colour
 * blindness — it is the one thing on the page this graphic exists to surface.
 * An optional `readings` row doubles as the skyline's legend, set in small
 * type under the hairline rather than as four boxed stat tiles.
 */
export function Masthead({
  count,
  countLabel,
  marks,
  emptyNote,
  readings,
}: {
  count: number;
  countLabel: string;
  /** Oldest/first left. Height is relative to the tallest mark in the set. */
  marks: SkylineMark[];
  /** Shown in place of the skyline when there are no marks. */
  emptyNote?: string;
  /** Small readout row under the hairline, e.g. a breakdown of `count`. */
  readings?: { key: string; value: ReactNode; label: string }[];
}) {
  const max = Math.max(1, ...marks.map((m) => m.value));

  return (
    <div>
      <div className="flex flex-col gap-ds-2xl sm:flex-row sm:items-end sm:gap-ds-7xl">
        <div className="shrink-0">
          <p className="font-data text-display-1 font-semibold tabular-nums text-text-high">
            {count}
          </p>
          <p className="mt-ds-xxs annotation">{countLabel}</p>
        </div>

        <div className="min-w-0 flex-1">
          {marks.length === 0 ? (
            <p className="pb-ds-xs text-body-1 text-text-low">{emptyNote}</p>
          ) : (
            <div
              role="img"
              aria-label={`${countLabel}: ${marks.length} shown, tallest ${max}`}
              className="flex h-16 items-end gap-px overflow-hidden sm:h-20 sm:gap-[3px]"
            >
              {marks.map((m, index) => (
                <span
                  key={m.id}
                  title={`${m.label} — ${m.value}`}
                  style={
                    {
                      "--i": Math.round(
                        (index / Math.max(marks.length - 1, 1)) *
                          STAGGER_SPAN,
                      ),
                      height: `${Math.max(6, (m.value / max) * 100)}%`,
                    } as CSSProperties
                  }
                  className={
                    "rise-in block min-w-px flex-1 origin-bottom cursor-default sm:min-w-[2px] " +
                    (m.flagged
                      ? "hatch text-danger-med"
                      : "bg-primary-wash hover:bg-primary-med")
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div aria-hidden="true" className="mt-ds-2xl h-px w-full bg-outline-low" />

      {readings && readings.length > 0 && (
        <dl className="mt-ds-lg flex flex-wrap items-baseline gap-x-ds-6xl gap-y-ds-xs">
          {readings.map((r) => (
            <div key={r.key} className="flex items-baseline gap-ds-xs">
              <dd className="font-data text-body-2 font-semibold tabular-nums text-text-high">
                {r.value}
              </dd>
              <dt className="text-caption-2 text-text-low">{r.label}</dt>
            </div>
          ))}
        </dl>
      )}

      {marks.length > 0 && (
        <ul className="sr-only">
          {marks.map((m) => (
            <li key={m.id}>
              {m.label}: {m.value}
              {m.flagged ? " (flagged)" : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
