import { formatDate } from "@/lib/format";
import { PanelEmpty } from "./Panel";

export type CompletionBucket = {
  /** `YYYY-MM-DD`. */
  date: string;
  onTime: number;
  late: number;
};

/**
 * Two plot shapes, picked by breakpoint rather than measured on the client.
 *
 * The SVG scales uniformly to its container, which means a single wide viewBox
 * would shrink its own axis labels to 4px on a phone. Rendering a second,
 * near-square plot for narrow viewports keeps the type legible at the size the
 * chart is actually drawn — cheap, because the markup is the same generator
 * twice and only one of the two is ever painted.
 */
const WIDE = { w: 720, h: 290, tickEvery: 3 };
const NARROW = { w: 360, h: 260, tickEvery: 4 };

const PAD = { top: 16, right: 12, bottom: 28, left: 30 };
/** Curve tension for the smoothing. 1 is a plain Catmull-Rom; below that the
 *  line stays closer to the data between points. */
const TENSION = 0.8;

/** Short axis tick: `2026-09-14` → `14 Sep`. Pinned to UTC for the same reason
 *  `lib/format` is: the portfolio is read from several machines. */
const TICK_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

type Point = { x: number; y: number };

/**
 * Smooth cubic through every point, with both control points clamped to the
 * y-range of their own segment. Clamping is what keeps a run of zero days from
 * bowing the curve below the baseline and inventing completions that never
 * happened.
 */
function smoothPath(points: readonly Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  const clamp = (value: number, a: number, b: number) =>
    Math.min(Math.max(value, Math.min(a, b)), Math.max(a, b));

  return points.slice(0, -1).reduce((d, _, i) => {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? points[i + 1];

    const c1x = p1.x + ((p2.x - p0.x) / 6) * TENSION;
    const c1y = clamp(p1.y + ((p2.y - p0.y) / 6) * TENSION, p1.y, p2.y);
    const c2x = p2.x - ((p3.x - p1.x) / 6) * TENSION;
    const c2y = clamp(p2.y - ((p3.y - p1.y) / 6) * TENSION, p1.y, p2.y);

    return `${d} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
}

/** Closes a line into a filled area by dropping to the baseline. */
function areaPath(points: readonly Point[], baseline: number): string {
  if (points.length === 0) return "";
  const last = points[points.length - 1];
  return `${smoothPath(points)} L ${last.x} ${baseline} L ${points[0].x} ${baseline} Z`;
}

/**
 * Milestone completions per day over the trailing window, stacked on-time
 * under late.
 *
 * Drawn as a stacked area rather than columns: fourteen daily counts are a
 * shape, not fourteen separate readings, and the question being asked ("are we
 * finishing work, and is it finishing on time?") is about the trend, not any
 * single Tuesday. The exact daily figures survive on the markers, which appear
 * only on days something actually closed.
 *
 * The accent lime is spent here because this is the one graphic on the page
 * reporting a good outcome; late work takes the warn amber above it, so the
 * thickness of the amber band is the whole story.
 */
export function CompletionTrend({
  buckets,
}: {
  buckets: readonly CompletionBucket[];
}) {
  const totalOnTime = buckets.reduce((sum, b) => sum + b.onTime, 0);
  const totalLate = buckets.reduce((sum, b) => sum + b.late, 0);
  const completed = totalOnTime + totalLate;

  if (completed === 0 || buckets.length < 2) {
    return (
      <PanelEmpty>
        No milestone has been completed in this window. Each completion adds a
        mark on the day it was closed, shaded by whether it beat its due date.
      </PanelEmpty>
    );
  }

  const onTimeShare = Math.round((totalOnTime / completed) * 100);
  const busiest = Math.max(...buckets.map((b) => b.onTime + b.late));
  const label = `${completed} milestones completed over ${buckets.length} days: ${totalOnTime} on time, ${totalLate} late. Busiest day: ${busiest} completed.`;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-ds-5xl gap-y-ds-2xl">
        <div>
          <p className="font-data text-metric font-semibold tabular-nums text-text-high">
            {completed}
          </p>
          <p className="mt-ds-xxs text-para text-text-low">
            completed in the window ·{" "}
            <span className="font-data tabular-nums text-text-med">
              {onTimeShare}%
            </span>{" "}
            on time
          </p>
        </div>

        <ul className="flex flex-wrap items-center gap-x-ds-5xl gap-y-ds-md text-body-1">
          <Legend swatch="bg-primary-med" label="On time" value={totalOnTime} />
          <Legend swatch="bg-warn-med" label="Late" value={totalLate} />
        </ul>
      </div>

      <TrendPlot
        buckets={buckets}
        shape={NARROW}
        ariaLabel={label}
        className="sm:hidden"
      />
      {/* Only one of the pair is ever displayed, and `display: none` takes the
          other out of the accessibility tree with it, so the series is
          announced once. */}
      <TrendPlot
        buckets={buckets}
        shape={WIDE}
        ariaLabel={label}
        className="hidden sm:block"
      />
    </div>
  );
}

function TrendPlot({
  buckets,
  shape,
  ariaLabel,
  className,
}: {
  buckets: readonly CompletionBucket[];
  shape: { w: number; h: number; tickEvery: number };
  ariaLabel: string;
  className: string;
}) {
  const { w, h, tickEvery } = shape;
  const plotW = w - PAD.left - PAD.right;
  const plotH = h - PAD.top - PAD.bottom;

  const yMax = Math.max(1, ...buckets.map((b) => b.onTime + b.late));
  const step = plotW / (buckets.length - 1);
  const baseline = PAD.top + plotH;
  const x = (i: number) => PAD.left + i * step;
  const y = (value: number) => baseline - (value / yMax) * plotH;

  const onTimePoints = buckets.map((b, i) => ({ x: x(i), y: y(b.onTime) }));
  const totalPoints = buckets.map((b, i) => ({
    x: x(i),
    y: y(b.onTime + b.late),
  }));
  const anyLate = buckets.some((b) => b.late > 0);
  const midTick = yMax >= 4 ? Math.round(yMax / 2) : null;

  // Dated ticks every few days, always including the last one — and dropping
  // the regular tick that would sit on top of it.
  const lastIndex = buckets.length - 1;
  const tickIndices = buckets
    .map((_, i) => i)
    .filter(
      (i) =>
        i === lastIndex || (i % tickEvery === 0 && lastIndex - i >= tickEvery),
    );

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`mt-ds-5xl w-full ${className}`}
      role="img"
      aria-label={ariaLabel}
    >
      {/* Weekends, so a flat stretch reads as "nobody was working" rather than
          "nothing shipped". */}
      {buckets.map((b, i) => {
        const weekday = new Date(`${b.date}T00:00:00Z`).getUTCDay();
        if (weekday !== 0 && weekday !== 6) return null;
        return (
          <rect
            key={`weekend-${b.date}`}
            x={x(i) - step / 2}
            y={PAD.top}
            width={step}
            height={plotH}
            className="fill-surface-2"
          />
        );
      })}

      {/* Grid: the ceiling and, when the range is tall enough to need it, one
          line between. */}
      {[yMax, ...(midTick ? [midTick] : [])].map((tick) => (
        <g key={`grid-${tick}`}>
          <line
            x1={PAD.left}
            x2={w - PAD.right}
            y1={y(tick)}
            y2={y(tick)}
            strokeDasharray="2 4"
            className="stroke-outline-med"
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={PAD.left - 8}
            y={y(tick) + 3}
            textAnchor="end"
            className="fill-text-low font-data text-[10px] tabular-nums"
          >
            {tick}
          </text>
        </g>
      ))}

      <line
        x1={PAD.left}
        x2={w - PAD.right}
        y1={baseline}
        y2={baseline}
        className="stroke-outline-high"
        vectorEffect="non-scaling-stroke"
      />
      <text
        x={PAD.left - 8}
        y={baseline + 3}
        textAnchor="end"
        className="fill-text-low font-data text-[10px] tabular-nums"
      >
        0
      </text>

      {anyLate && (
        <>
          <path
            d={areaPath(totalPoints, baseline)}
            className="fill-warn-med/20"
          />
          {/* Knocks the amber back out of the lower band, so the two areas
              stack cleanly instead of blending into a third colour. Matches the
              Panel surface this chart always sits on. */}
          <path
            d={areaPath(onTimePoints, baseline)}
            className="fill-surface-1"
          />
          <path
            d={smoothPath(totalPoints)}
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            className="stroke-warn-med"
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}

      <path
        d={areaPath(onTimePoints, baseline)}
        className="fill-primary-med/35"
      />
      <path
        d={smoothPath(onTimePoints)}
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        className="stroke-primary-med"
        vectorEffect="non-scaling-stroke"
      />

      {/* One marker per day that actually closed something. */}
      {buckets.map((b, i) => {
        const total = b.onTime + b.late;
        if (total === 0) return null;
        return (
          <circle
            key={`marker-${b.date}`}
            cx={x(i)}
            cy={y(total)}
            r={3.5}
            strokeWidth={2}
            className={`fill-surface-1 ${b.late > 0 ? "stroke-warn-med" : "stroke-primary-med"}`}
            vectorEffect="non-scaling-stroke"
          >
            <title>{`${formatDate(b.date)}: ${total} completed, ${b.late} late`}</title>
          </circle>
        );
      })}

      {tickIndices.map((i) => (
        <text
          key={`tick-${buckets[i].date}`}
          x={x(i)}
          y={h - 8}
          textAnchor={i === 0 ? "start" : i === lastIndex ? "end" : "middle"}
          className="fill-text-low font-data text-[10px] tabular-nums"
        >
          {TICK_FORMAT.format(new Date(`${buckets[i].date}T00:00:00Z`))}
        </text>
      ))}
    </svg>
  );
}

function Legend({
  swatch,
  label,
  value,
}: {
  swatch: string;
  label: string;
  value: number;
}) {
  return (
    <li className="flex items-center gap-ds-md">
      <span
        aria-hidden="true"
        className={`size-1.5 shrink-0 rounded-full ${swatch}`}
      />
      <span className="text-text-med">{label}</span>
      <span className="font-data font-semibold tabular-nums text-text-high">
        {value}
      </span>
    </li>
  );
}
