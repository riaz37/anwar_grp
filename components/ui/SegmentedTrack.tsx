/**
 * A progress track drawn as one bar per step.
 *
 * Extracted from `components/applications/StagePipeline.tsx` in Phase 5 so the
 * approval-chain progress view shares the pipeline's visual vocabulary instead
 * of inventing a second one two panels away from it. Both are answers to "how
 * far along an ordered process is this record", and DESIGN.md's register is
 * "typography and spacing do the work": a second, differently-shaped stepper
 * on the same screen would be decoration, not information.
 *
 * Deliberately bars rather than the numbered-circle stepper every ATS ships:
 * at nine stages, circles-and-connectors either wrap badly or shrink the labels
 * below legibility. `labelsFrom` exists because a four-step approval chain can
 * afford its labels from `sm` up, while the nine-stage pipeline cannot.
 *
 * Every segment carries an `sr-only` sentence regardless of whether its visible
 * label is rendered at the current breakpoint, so nothing is lost on mobile.
 */

const SEGMENT_BASE =
  "h-1.5 rounded-full transition-colors duration-200 ease-move";

/**
 * Static class strings, not interpolated: Tailwind only sees literals.
 */
const LABEL_VISIBILITY = {
  sm: "hidden truncate text-caption-2 sm:block",
  lg: "hidden truncate text-caption-2 lg:block",
  /* Phase 6: a joining checklist runs to thirteen items with labels like
     "Department notification", which truncate to two characters at any
     breakpoint. The track still carries every label to screen readers via the
     `sr-only` span below; this hides the visible labels only, and the list
     underneath is where a sighted reader gets them. */
  never: "hidden",
} as const;

export interface TrackSegment {
  key: string;
  label: string;
  /** Background utility class for the bar, e.g. `bg-primary-med`. */
  fill: string;
  /** Appended to the spoken label, e.g. "current stage" or "approved". */
  spokenState?: string;
  /** Renders the visible label in the primary text colour, semibold. */
  emphasised?: boolean;
}

export function SegmentedTrack({
  segments,
  ariaLabel,
  labelsFrom = "lg",
}: {
  segments: readonly TrackSegment[];
  ariaLabel: string;
  labelsFrom?: keyof typeof LABEL_VISIBILITY;
}) {
  // `repeat(0, …)` is invalid grid syntax and collapses the track into an
  // unstyled block; a process with no steps has nothing to draw anyway.
  if (segments.length === 0) return null;

  return (
    <ol
      aria-label={ariaLabel}
      className="grid gap-ds-xs"
      style={{
        // A CSS variable rather than a `grid-cols-N` class: the segment count is
        // data (nine stages, or however many roles a chain config lists), and
        // Tailwind cannot generate a class for a number it never sees.
        gridTemplateColumns: `repeat(${segments.length}, minmax(0, 1fr))`,
      }}
    >
      {segments.map((segment) => (
        <li key={segment.key} className="min-w-0">
          <div
            aria-hidden="true"
            className={`${SEGMENT_BASE} ${segment.fill}`}
          />
          <span
            className={`mt-ds-xs ${LABEL_VISIBILITY[labelsFrom]} ${
              segment.emphasised ? "font-semibold text-text-high" : "text-muted-foreground"
            }`}
          >
            {segment.label}
          </span>
          <span className="sr-only">
            {segment.label}
            {segment.spokenState ? `, ${segment.spokenState}` : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}
