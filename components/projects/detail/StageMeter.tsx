import type { ProjectStage } from "@prisma/client";
import { cn } from "@/lib/utils";
import { STAGE_LABELS, STAGE_ORDER } from "../projectTone";

/**
 * Rail labels. Ten labels across one row leaves roughly 100px each, and
 * "Requirements & Design" or "Business Testing (UAT)" truncate to nothing
 * useful at that width — so the meter carries a short form and the full name
 * stays on the `title` attribute and in the sentence below.
 */
const SHORT_LABELS: Record<ProjectStage, string> = {
  IDEA: "Idea",
  DISCOVERY: "Discovery",
  REQUIREMENTS_DESIGN: "Requirements",
  APPROVAL: "Approval",
  DEVELOPMENT: "Development",
  INTERNAL_TESTING: "Internal QA",
  BUSINESS_TESTING_UAT: "UAT",
  DEPLOYMENT: "Deployment",
  STABILIZATION: "Stabilization",
  COMPLETED: "Completed",
};

/**
 * The ten-stage pipeline, drawn as a run of notches.
 *
 * Deliberately not a percentage bar: the stages are named checkpoints, not a
 * continuous quantity, and a single filled bar would imply "60% done" when it
 * actually means "at Internal Testing". Cleared stages read at half height in
 * the success tone, the current stage stands proud in the one accent, and
 * everything ahead stays a hairline.
 *
 * The graphic is `aria-hidden`; the same fact is given to assistive tech as a
 * sentence, because a screen reader hearing ten unlabelled list items learns
 * nothing.
 */
export function StageMeter({
  current,
  className,
}: {
  current: ProjectStage;
  className?: string;
}) {
  const currentIndex = STAGE_ORDER.indexOf(current);

  return (
    <div className={className}>
      <ol aria-hidden="true" className="flex items-end gap-[3px]">
        {STAGE_ORDER.map((stage, index) => {
          const cleared = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li key={stage} className="min-w-0 flex-1">
              <span
                className={cn(
                  "block rounded-[2px]",
                  cleared && "h-1 bg-success-med/60",
                  active && "h-2 bg-primary-med shadow-e1",
                  !cleared && !active && "h-1 bg-outline-med",
                )}
              />
              <span
                className={cn(
                  "mt-ds-lg hidden truncate pr-ds-md text-caption-1 lg:block",
                  active
                    ? "font-semibold text-primary-high"
                    : cleared
                      ? "text-text-med"
                      : "text-text-low",
                )}
                title={STAGE_LABELS[stage]}
              >
                {SHORT_LABELS[stage]}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-ds-lg text-body-1 text-muted-foreground lg:sr-only">
        Stage{" "}
        <span className="font-data tabular-nums text-text-high">
          {currentIndex + 1}
        </span>{" "}
        of <span className="font-data tabular-nums">{STAGE_ORDER.length}</span>
        {" · "}
        <span className="font-medium text-text-high">
          {STAGE_LABELS[current]}
        </span>
      </p>
    </div>
  );
}
