"use client";

import { EvaluationSummaryPanel } from "@/components/evaluations/EvaluationSummaryPanel";
import { Pill } from "@/components/ui/StatusPill";
import { ELIGIBILITY_TONE, panelFeedbackTone } from "@/components/ui/tone";
import { formatDate } from "@/lib/format";
import {
  ASSESSMENT_TYPE_LABELS,
  ELIGIBILITY_LABELS,
  OVERALL_RECOMMENDATION_LABELS,
  type InterviewEvaluationRound,
  type ScreeningAssessment,
} from "@/lib/types/domain";

/**
 * The PDF's "Decisions and Approvals" list, gathered in one place:
 * "Recruiters should see: panel recommendations, average score, missing
 * feedback, assessment results, key concerns, hiring-manager recommendation."
 *
 * Almost none of it is new. Panel recommendations, average score, missing
 * feedback, key concerns and the hiring-manager recommendation are exactly what
 * Phase 4's `EvaluationSummaryPanel` already renders, so this composes that
 * component once per interview round rather than re-deriving any of it — one
 * implementation of "what did the panel say", used on two tabs. Assessment
 * results already live on the Screening tab and are summarised to a line here
 * with a link across, for the reason Phase 4 recorded: a second copy is a
 * second thing to keep in sync.
 *
 * The constraint that shapes the whole view is the sentence immediately after
 * that list in the PDF — "The system may summarize information but must not
 * make the final hiring decision." So the summary at the top counts *facts*
 * (rounds held, feedback in, screening recorded) and never scores them: there
 * is no readiness percentage, no traffic light on the candidate, no "recommend
 * proceeding". A missing evaluation is called out because someone has to chase
 * it, not because it moves a needle.
 */

export function DecisionSupport({
  rounds,
  screening,
  onOpenScreening,
  onOpenEvaluations,
}: {
  rounds: readonly InterviewEvaluationRound[];
  screening: ScreeningAssessment | null;
  onOpenScreening: () => void;
  onOpenEvaluations: (interviewId: string) => void;
}) {
  /* Paired rather than filtered-and-asserted: `summary` is null for roles that
     do not receive the consolidated view (panel members, technical admins —
     see `SUMMARY_ROLES` in `_mock-evaluations.ts`), and narrowing it once here
     keeps every use below honest without a non-null assertion. */
  const summarised = rounds.flatMap((round) =>
    round.summary ? [{ round, summary: round.summary }] : [],
  );
  const totalPanelists = summarised.reduce(
    (sum, entry) => sum + entry.round.totalPanelists,
    0,
  );
  const submitted = summarised.reduce(
    (sum, entry) => sum + entry.round.submittedCount,
    0,
  );
  const hiringManager = summarised
    .map((entry) => entry.summary.hiringManagerRecommendation)
    .find((entry) => entry !== null);

  return (
    <div className="flex max-w-[var(--container-form)] flex-col gap-xl">
      <section aria-labelledby="decision-support-heading">
        <h3 id="decision-support-heading" className="text-subhead text-text">
          What is on record
        </h3>
        <p className="mt-2xs max-w-[62ch] text-body-sm text-muted">
          Everything the panel, the screener and the hiring manager have
          recorded, gathered here so the decision is made against the whole
          record rather than the last conversation. TalentFlow does not weigh
          any of it or suggest an outcome — the decision is yours, and the chain
          below is where it gets signed off.
        </p>

        <dl className="mt-lg grid grid-cols-1 gap-md sm:grid-cols-3">
          <div>
            <dt className="text-caption font-medium uppercase tracking-[0.06em] text-muted">
              Interview rounds
            </dt>
            <dd className="mt-2xs font-data text-body tabular-nums text-text">
              {rounds.length}
            </dd>
          </div>
          <div>
            <dt className="text-caption font-medium uppercase tracking-[0.06em] text-muted">
              Panel feedback
            </dt>
            <dd className="mt-2xs">
              {totalPanelists === 0 ? (
                <span className="text-body-sm text-muted">
                  No panel assigned yet
                </span>
              ) : (
                <Pill
                  tone={panelFeedbackTone(submitted, totalPanelists)}
                  label={`${submitted} of ${totalPanelists} submitted`}
                  size="md"
                />
              )}
            </dd>
          </div>
          <div>
            <dt className="text-caption font-medium uppercase tracking-[0.06em] text-muted">
              Hiring-manager recommendation
            </dt>
            <dd className="mt-2xs text-body-sm">
              {hiringManager ? (
                <span className="text-text">
                  {OVERALL_RECOMMENDATION_LABELS[hiringManager.recommendation]}
                  <span className="text-muted">
                    {" · "}
                    {hiringManager.panelist.name}
                  </span>
                </span>
              ) : (
                <span className="text-warning-ink">
                  Not recorded on any round
                </span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <ScreeningLine screening={screening} onOpenScreening={onOpenScreening} />

      <section aria-labelledby="decision-panel-heading">
        <h3 id="decision-panel-heading" className="text-subhead text-text">
          Panel results by round
        </h3>
        {summarised.length === 0 ? (
          <p className="mt-sm max-w-[62ch] text-body-sm text-muted">
            {rounds.length === 0
              ? "No interview rounds have been scheduled on this application, so there is no panel feedback to read."
              : "Consolidated panel results are not shown for your role. Individual evaluations are on the Evaluations tab."}
          </p>
        ) : (
          <div className="mt-lg flex flex-col gap-xl">
            {summarised.map(({ round, summary }) => (
              <div
                key={round.interviewId}
                className="border-t border-border pt-lg first:border-t-0 first:pt-0"
              >
                <EvaluationSummaryPanel
                  summary={summary}
                  idPrefix={`decision-summary-${round.interviewId}`}
                  heading={`Round ${round.roundNumber} — ${round.title}`}
                  variant="composed"
                />
                <button
                  type="button"
                  onClick={() => onOpenEvaluations(round.interviewId)}
                  className="mt-md inline-flex min-h-11 items-center rounded-sm text-body-sm font-medium text-accent-ink underline decoration-transparent underline-offset-2 transition-colors duration-100 ease-move hover:decoration-current"
                >
                  Read the individual evaluations for round {round.roundNumber}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * The spec's "assessment results", as one line rather than a second copy of the
 * screening record. Deliberately the three fields that bear on a hiring
 * decision — eligibility, what the assessment was, and what it scored — with
 * everything else a click away.
 */
function ScreeningLine({
  screening,
  onOpenScreening,
}: {
  screening: ScreeningAssessment | null;
  onOpenScreening: () => void;
}) {
  return (
    <section aria-labelledby="decision-assessment-heading">
      <h3 id="decision-assessment-heading" className="text-subhead text-text">
        Screening and assessment
      </h3>
      {screening === null ? (
        <p className="mt-sm max-w-[62ch] text-body-sm text-muted">
          Nothing recorded on the Screening tab for this application.
        </p>
      ) : (
        <>
          <p className="mt-sm flex flex-wrap items-center gap-sm text-body-sm text-text">
            <Pill
              tone={ELIGIBILITY_TONE[screening.eligibility]}
              label={ELIGIBILITY_LABELS[screening.eligibility]}
              size="md"
            />
            <span className="text-muted">
              {ASSESSMENT_TYPE_LABELS[screening.assessmentType]}
            </span>
            {screening.assessmentScore !== null && (
              <span className="font-data tabular-nums">
                {screening.assessmentScore}
                <span className="text-muted">
                  {" / "}
                  {screening.assessmentMaxScore}
                </span>
              </span>
            )}
            <span className="text-muted">
              recorded {formatDate(screening.recordedAt.slice(0, 10))} by{" "}
              {screening.recordedBy.name}
            </span>
          </p>
          <button
            type="button"
            onClick={onOpenScreening}
            className="mt-sm inline-flex min-h-11 items-center rounded-sm text-body-sm font-medium text-accent-ink underline decoration-transparent underline-offset-2 transition-colors duration-100 ease-move hover:decoration-current"
          >
            Open the Screening tab
          </button>
        </>
      )}
    </section>
  );
}
