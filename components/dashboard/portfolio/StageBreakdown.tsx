import type { ProjectStage } from "@prisma/client";
import { STAGE_LABELS } from "@/components/projects/projectTone";
import { PanelEmpty } from "./Panel";

export type StageCount = { stage: ProjectStage; count: number };

/**
 * Active projects per pipeline stage, in pipeline order.
 *
 * Ordered by stage, never by size: the shape of the pipeline is the
 * information — a bulge at Approval means something different from the same
 * bulge at Development. Bars are neutral by default and the heaviest stage is
 * the only one set at full ink, so the eye finds the bottleneck without the
 * row order changing under it week to week.
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
    <ol className="flex flex-col gap-ds-xl">
      {stages.map((s) => {
        const leading = s.count === max;
        return (
          <li key={s.stage} className="flex items-center gap-ds-2xl">
            <span className="w-[13ch] shrink-0 truncate text-body-1 text-text-med sm:w-[19ch]">
              {STAGE_LABELS[s.stage]}
            </span>
            <span
              aria-hidden="true"
              className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-pill bg-surface-2"
            >
              <span
                className={`block h-full rounded-pill ${leading ? "bg-text-high" : "bg-text-low"}`}
                style={{
                  width:
                    s.count === 0
                      ? "0%"
                      : `${Math.max(3, (s.count / max) * 100)}%`,
                }}
              />
            </span>
            <span
              className={`w-6 shrink-0 text-right font-data text-body-1 tabular-nums ${
                leading ? "font-semibold text-text-high" : "text-text-med"
              }`}
            >
              {s.count}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
