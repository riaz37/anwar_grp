import {
  isBranchStage,
  PIPELINE_STAGES,
  STAGE_LABELS,
  type ApplicationStage,
  type PipelineStage,
} from "@/lib/types/domain";
import { StagePill } from "@/components/ui/StatusPill";

/**
 * The nine-stage pipeline from spec Sec 5, rendered as a segmented track.
 *
 * Deliberately a track of bars rather than the numbered-circle stepper every
 * ATS ships: at nine stages, circles-and-connectors either wrap badly or shrink
 * the labels below legibility, and DESIGN.md's register is "typography and
 * spacing do the work". Labels appear from `lg` up; below that the sentence
 * underneath carries the same information, so nothing is lost on mobile.
 *
 * Branch states (`ON_HOLD`, `REJECTED`, `WITHDRAWN`, `REDIRECTED`, `CLOSED`)
 * are not points on the line. The track is shown muted up to the last pipeline
 * stage the application actually reached, and the branch state is called out
 * separately — the application left the line, it did not advance along it.
 */

const SEGMENT_BASE = "h-1.5 rounded-full transition-colors duration-200 ease-move";

export function StagePipeline({
  stage,
  lastPipelineStage,
  stageChangedLabel,
}: {
  stage: ApplicationStage;
  /**
   * The furthest pipeline stage reached before branching. Required to render a
   * meaningful track for a branch state; ignored otherwise.
   */
  lastPipelineStage?: PipelineStage;
  /** e.g. "9 days in this stage" — rendered as supporting text. */
  stageChangedLabel?: string;
}) {
  const branched = isBranchStage(stage);
  const anchor: PipelineStage = branched
    ? (lastPipelineStage ?? "NEW")
    : (stage as PipelineStage);
  const anchorIndex = PIPELINE_STAGES.indexOf(anchor);

  return (
    <div>
      <ol
        className="grid grid-cols-9 gap-xs"
        aria-label="Recruitment pipeline progress"
      >
        {PIPELINE_STAGES.map((pipelineStage, index) => {
          const reached = index <= anchorIndex;
          const isCurrent = !branched && index === anchorIndex;

          const fill = !reached
            ? "bg-border"
            : branched
              ? "bg-border-strong"
              : isCurrent
                ? "bg-accent"
                : "bg-accent/45";

          return (
            <li key={pipelineStage} className="min-w-0">
              <div
                className={`${SEGMENT_BASE} ${fill}`}
                aria-hidden="true"
              />
              <span
                className={`mt-xs hidden truncate text-caption lg:block ${
                  isCurrent ? "font-semibold text-text" : "text-muted"
                }`}
              >
                {STAGE_LABELS[pipelineStage]}
              </span>
              {/* Announced regardless of the label's breakpoint visibility. */}
              <span className="sr-only">
                {STAGE_LABELS[pipelineStage]}
                {isCurrent ? " — current stage" : reached ? " — completed" : ""}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-sm flex flex-wrap items-center gap-x-sm gap-y-2xs text-body-sm text-muted">
        <StagePill stage={stage} size="md" />
        {branched ? (
          <span>
            Left the pipeline at{" "}
            <span className="text-text">{STAGE_LABELS[anchor]}</span> (step{" "}
            <span className="font-data tabular-nums">{anchorIndex + 1}</span> of{" "}
            <span className="font-data tabular-nums">
              {PIPELINE_STAGES.length}
            </span>
            )
          </span>
        ) : (
          <span>
            Step{" "}
            <span className="font-data tabular-nums text-text">
              {anchorIndex + 1}
            </span>{" "}
            of{" "}
            <span className="font-data tabular-nums">
              {PIPELINE_STAGES.length}
            </span>
          </span>
        )}
        {stageChangedLabel && (
          <>
            <span aria-hidden="true">·</span>
            <span>{stageChangedLabel}</span>
          </>
        )}
      </p>
    </div>
  );
}

/** Furthest pipeline stage present in an application's history. */
export function lastPipelineStageOf(
  stages: readonly ApplicationStage[],
): PipelineStage | undefined {
  let furthest: PipelineStage | undefined;
  let furthestIndex = -1;
  for (const stage of stages) {
    const index = PIPELINE_STAGES.indexOf(stage as PipelineStage);
    if (index > furthestIndex) {
      furthestIndex = index;
      furthest = PIPELINE_STAGES[index];
    }
  }
  return furthest;
}
