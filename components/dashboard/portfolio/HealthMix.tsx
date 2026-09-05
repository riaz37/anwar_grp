import { ProjectHealth } from "@prisma/client";
import { HEALTH_LABELS } from "@/components/projects/projectTone";
import { PanelEmpty } from "./Panel";

export type HealthSlice = { health: ProjectHealth; count: number };

/** Ring geometry, in viewBox units. */
const SIZE = 200;
const STROKE = 26;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Arc gap, in the same units — enough to separate two adjacent slices
 *  without eating a one-project slice. */
const GAP = 5;

/**
 * Stroke per health state for the ring.
 *
 * Deliberately not `HEALTH_BAND_CLASS`: that map paints BLOCKED with
 * `outline-high` (white at 12%), which reads as "neutral" inside an 8px band
 * but disappears entirely as a 26px arc on the panel surface. The ring is the
 * dominant graphic on this panel, so BLOCKED takes a solid neutral ink that
 * holds in both themes while still refusing to borrow the "late" red —
 * a blocker is a someone-must-act state, not a schedule slip.
 */
const HEALTH_ARC: Record<ProjectHealth, string> = {
  ON_TRACK: "stroke-success-med",
  AT_RISK: "stroke-warn-med",
  DELAYED: "stroke-danger-med",
  BLOCKED: "stroke-text-med",
};

/** Legend dot, mirroring `HEALTH_ARC` one-for-one so the key and the ring can
 *  never drift apart. */
const HEALTH_LEGEND_DOT: Record<ProjectHealth, string> = {
  ON_TRACK: "bg-success-med",
  AT_RISK: "bg-warn-med",
  DELAYED: "bg-danger-med",
  BLOCKED: "bg-text-med",
};

/**
 * Portfolio health as a ring: one closed shape whose largest arc answers
 * "is most of the portfolio fine?" before any label is read.
 *
 * A ring rather than a bar because the total belongs in the middle of it —
 * the share and the denominator are read in one fixation. The legend below is
 * secondary by design: it exists only to turn a wedge into an exact number.
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
  const gap = present.length > 1 ? GAP : 0;

  const arcs = present.map((s, i) => {
    const before = present
      .slice(0, i)
      .reduce((sum, prior) => sum + prior.count, 0);
    const length = (s.count / total) * CIRCUMFERENCE;
    return {
      health: s.health,
      dash: Math.max(length - gap, 1),
      offset: (before / total) * CIRCUMFERENCE,
    };
  });

  const onTrack =
    slices.find((s) => s.health === ProjectHealth.ON_TRACK)?.count ?? 0;
  const onTrackPct = Math.round((onTrack / total) * 100);

  return (
    <div>
      <div className="relative mx-auto w-full max-w-[220px]">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="w-full"
          role="img"
          aria-label={`${total} projects: ${present
            .map((s) => `${s.count} ${HEALTH_LABELS[s.health].toLowerCase()}`)
            .join(", ")}.`}
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-surface-3"
          />
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            {arcs.map((a) => (
              <circle
                key={a.health}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                strokeWidth={STROKE}
                strokeDasharray={`${a.dash} ${CIRCUMFERENCE - a.dash}`}
                strokeDashoffset={-a.offset}
                className={HEALTH_ARC[a.health]}
              />
            ))}
          </g>
        </svg>

        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-data text-metric font-semibold tabular-nums text-text-high">
              {onTrackPct}
              <span className="text-body-2 font-semibold">%</span>
            </p>
            <p className="annotation mt-ds-xxs">On track</p>
            <p className="mt-ds-md font-data text-caption-2 tabular-nums text-text-low">
              {total} project{total === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </div>

      <dl className="mt-ds-5xl flex flex-col">
        {slices.map((s) => (
          <div
            key={s.health}
            className="flex items-center gap-ds-md border-b border-outline-base py-ds-md last:border-b-0"
          >
            <span
              aria-hidden="true"
              className={`size-1.5 shrink-0 rounded-full ${HEALTH_LEGEND_DOT[s.health]}`}
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
