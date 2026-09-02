import {
  isBranchStage,
  PIPELINE_STAGES,
  STAGE_LABELS,
  type ApplicationStage,
  type PipelineStage,
} from "@/lib/types/domain";
import { SegmentedTrack, type TrackSegment } from "@/components/ui/SegmentedTrack";
import { StagePill } from "@/components/ui/StatusPill";

/**
 * The nine-stage pipeline from spec Sec 5, rendered as a segmented track.
 *
 * The track itself is `components/ui/SegmentedTrack` — shared with the
 * approval-chain progress view (Phase 5), which is the same kind of statement
 * about a different ordered process. Labels appear from `lg` up; below that the
 * sentence underneath carries the same information, so nothing is lost on
 * mobile.
 *
 * Branch states (`ON_HOLD`, `REJECTED`, `WITHDRAWN`, `REDIRECTED`, `CLOSED`)
 * are not points on the line. The track is shown muted up to the last pipeline
 * stage the application actually reached, and the branch state is called out
 * separately — the application left the line, it did not advance along it.
 */

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

  const segments: TrackSegment[] = PIPELINE_STAGES.map(
    (pipelineStage, index) => {
      const reached = index <= anchorIndex;
      const isCurrent = !branched && index === anchorIndex;
      return {
        key: pipelineStage,
        label: STAGE_LABELS[pipelineStage],
        fill: !reached
          ? "bg-border"
          : branched
            ? "bg-border-strong"
            : isCurrent
              ? "bg-accent"
              : "bg-accent/45",
        spokenState: isCurrent
          ? "current stage"
          : reached
            ? "completed"
            : undefined,
        emphasised: isCurrent,
      };
    },
  );

  return (
    <div>
      <SegmentedTrack
        segments={segments}
        ariaLabel="Recruitment pipeline progress"
      />

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
