const VIEW_W = 320;
const VIEW_H = 128;

/** A straight-segment area path through `counts`, 0→VIEW_W / 0→VIEW_H, the
 *  baseline at the bottom — the shape of the pipeline, not a trend line. */
function buildPath(counts: number[], ceiling: number): string {
  if (counts.length < 2) return "";
  const step = VIEW_W / (counts.length - 1);
  const points = counts.map(
    (c, i): [number, number] => [
      i * step,
      VIEW_H - Math.min(1, c / ceiling) * VIEW_H,
    ],
  );
  const d = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");
  return `${d} L ${VIEW_W} ${VIEW_H} L 0 ${VIEW_H} Z`;
}

/**
 * The shape of the pipeline: how many active projects sit at each stage,
 * drawn as one filled area rather than a bar per stage — the eye reads a
 * ridge's rise and fall faster than it compares ten separate bar heights, and
 * it answers a different question than the "Needs attention" list below it:
 * not which project is stuck, but where the whole portfolio's weight sits.
 *
 * Hand-drawn inline SVG: one filled path plus one hairline stroke, stretched
 * with `preserveAspectRatio="none"` so it's responsive at any width with no
 * measurement and nothing to hydrate. `non-scaling-stroke` keeps the outline
 * from thickening under the horizontal distortion.
 */
export function StageRiver({
  stages,
}: {
  stages: { stage: string; label: string; count: number }[];
}) {
  const counts = stages.map((s) => s.count);
  const total = counts.reduce((a, b) => a + b, 0);
  const ceiling = Math.max(1, ...counts);
  const path = buildPath(counts, ceiling);
  const peak = stages.reduce<
    { stage: string; label: string; count: number } | null
  >((best, s) => (s.count > (best?.count ?? -1) ? s : best), null);

  if (total === 0) {
    return (
      <p className="text-body-1 leading-6 text-text-low">
        No active project yet, so the pipeline has no shape to draw. This
        fills in as soon as a project moves past Idea.
      </p>
    );
  }

  return (
    <figure className="m-0">
      <div className="relative">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Active projects by stage. Most sit at ${peak?.label ?? "no stage"} with ${peak?.count ?? 0}.`}
          className="rise-in block h-[clamp(140px,16vw,208px)] w-full"
        >
          {path && (
            <>
              <path d={path} className="fill-primary-wash" />
              <path
                d={path}
                fill="none"
                className="stroke-primary-med"
                strokeWidth="1.5"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>

        <div aria-hidden="true" className="h-px w-full bg-outline-low" />

        <div aria-hidden="true" className="mt-ds-md flex">
          {stages.map((s) => (
            <span
              key={s.stage}
              className="flex-1 truncate px-ds-xxs text-center text-[10px] uppercase tracking-[0.06em] tabular-nums text-text-low"
            >
              {s.label}
            </span>
          ))}
        </div>
      </div>

      <figcaption className="mt-ds-lg text-body-1 leading-6 text-text-low">
        Most active work sits at{" "}
        <span className="font-medium text-text-high">{peak?.label}</span>
        {" · "}
        <span className="font-data tabular-nums text-text-med">
          {peak?.count}
        </span>{" "}
        of <span className="font-data tabular-nums text-text-med">{total}</span>{" "}
        active projects
      </figcaption>

      <ul className="sr-only">
        {stages.map((s) => (
          <li key={s.stage}>
            {s.label}: {s.count}
          </li>
        ))}
      </ul>
    </figure>
  );
}
