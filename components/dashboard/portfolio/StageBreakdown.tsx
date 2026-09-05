import type { ProjectStage } from "@prisma/client";
import { STAGE_LABELS } from "@/components/projects/projectTone";
import { PanelEmpty } from "./Panel";
import { BarRow } from "./BarRow";

export type StageCount = { stage: ProjectStage; count: number };

/**
 * Active projects per pipeline stage, in pipeline order.
 *
 * Ordered by stage, never by size: the shape of the pipeline is the
 * information — a bulge at Approval means something different from the same
 * bulge at Development. Every stage keeps its track even at zero, so the gaps
 * in the pipeline are as visible as the pile-ups, and the fullest stage is the
 * only one at solid accent so the bottleneck is found before a label is read.
 */
export function StageBreakdown({ stages }: { stages: readonly StageCount[] }) {
  const max = Math.max(...stages.map((s) => s.count), 0);

  if (max === 0) {
    return (
      <PanelEmpty>
        No active projects. Each project counts against the stage it currently
        sits in, and leaves this list when it reaches Completed.
      </PanelEmpty>
    );
  }

  return (
    <ol className="flex flex-col gap-ds-md">
      {stages.map((s) => (
        <BarRow
          key={s.stage}
          label={STAGE_LABELS[s.stage]}
          value={s.count}
          max={max}
          leading={s.count === max}
          labelWidth="w-[12ch] sm:w-[20ch]"
        />
      ))}
    </ol>
  );
}
