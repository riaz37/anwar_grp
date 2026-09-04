import { ButtonLink } from "@/components/ui/Button";
import { PlusIcon } from "@/components/ui/icons";
import { STAGE_LABELS, STAGE_ORDER } from "@/components/projects/projectTone";

/**
 * First-run state. A portfolio with nothing in it doesn't need a filter bar
 * above an empty table — it needs to explain what a project *is* here: a
 * named initiative with one accountable owner that walks a gated,
 * ten-stage pipeline. The stage list below is the onboarding.
 */
export function PortfolioEmpty({ canCreate }: { canCreate: boolean }) {
  return (
    <section className="rounded-xl border border-outline-low bg-surface-0 p-ds-9xl">
      <div className="max-w-[56ch]">
        <p className="annotation">Nothing registered yet</p>
        <h2 className="mt-ds-md text-heading-1 font-semibold text-text-high">
          The portfolio starts with one initiative
        </h2>
        <p className="mt-ds-md text-para text-text-med">
          Every project enters at <strong className="font-semibold text-text-high">Idea</strong>{" "}
          with an accountable owner, a business unit, and an expected delivery
          date. From there it moves one gate at a time — a stage only closes
          once its checklist is cleared, so the pipeline below doubles as the
          audit trail.
          {!canCreate &&
            " Your role can read the portfolio but not register projects; ask your AI Team Lead to open the first one."}
        </p>

        {canCreate && (
          <ButtonLink href="/projects/new" variant="primary" className="mt-ds-5xl">
            <PlusIcon />
            Create the first project
          </ButtonLink>
        )}
      </div>

      <ol className="mt-ds-9xl flex flex-wrap gap-ds-xs border-t border-outline-base pt-ds-5xl">
        {STAGE_ORDER.map((stage, index) => (
          <li
            key={stage}
            className="inline-flex items-center gap-ds-sm rounded-pill bg-surface-2 py-ds-xs pl-ds-md pr-ds-xl"
          >
            <span className="font-data text-caption-1 tabular-nums text-text-low">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-caption-2 font-medium text-text-med">
              {STAGE_LABELS[stage]}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
