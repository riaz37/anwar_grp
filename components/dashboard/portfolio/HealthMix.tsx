import type { ProjectHealth } from "@prisma/client";
import { TONE_DOT } from "@/components/ui/tone";
import {
  HEALTH_BAND_CLASS,
  HEALTH_LABELS,
  HEALTH_TONE,
} from "@/components/projects/projectTone";
import { PanelEmpty } from "./Panel";

export type HealthSlice = { health: ProjectHealth; count: number };

/**
 * Portfolio health as one proportional bar plus a readable legend.
 *
 * A bar alone can't be read precisely, and a list alone can't be read at a
 * glance, so both are shown: the band answers "is most of the portfolio fine?",
 * the rows answer "exactly how many are blocked?". Segment colours come from
 * `HEALTH_BAND_CLASS` (opaque fills, needed at 8px tall) while the legend dot
 * reuses the same tone map the status pills use, so the two never drift.
 */
export function HealthMix({ slices }: { slices: readonly HealthSlice[] }) {
  const total = slices.reduce((sum, s) => sum + s.count, 0);

  if (total === 0) {
    return (
      <PanelEmpty>
        No projects on record yet. Every project reports a health state from the
        moment it is created, and the split shows here.
      </PanelEmpty>
    );
  }

  const present = slices.filter((s) => s.count > 0);

  return (
    <div>
      <div
        className="flex h-2 gap-[2px] overflow-hidden rounded-pill"
        role="img"
        aria-label={present
          .map((s) => `${s.count} ${HEALTH_LABELS[s.health]}`)
          .join(", ")}
      >
        {present.map((s) => (
          <span
            key={s.health}
            className={HEALTH_BAND_CLASS[s.health]}
            style={{ width: `${(s.count / total) * 100}%` }}
          />
        ))}
      </div>

      <dl className="mt-ds-5xl flex flex-col">
        {slices.map((s) => (
          <div
            key={s.health}
            className="flex items-center gap-ds-md border-b border-outline-base py-ds-md last:border-b-0"
          >
            <span
              aria-hidden="true"
              className={`size-1.5 shrink-0 rounded-full ${TONE_DOT[HEALTH_TONE[s.health]]}`}
            />
            <dt className="min-w-0 flex-1 truncate text-body-1 text-text-med">
              {HEALTH_LABELS[s.health]}
            </dt>
            <dd className="flex items-baseline gap-ds-md">
              <span className="font-data text-caption-2 tabular-nums text-text-low">
                {Math.round((s.count / total) * 100)}%
              </span>
              <span className="w-6 text-right font-data text-body-1 font-semibold tabular-nums text-text-high">
                {s.count}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
