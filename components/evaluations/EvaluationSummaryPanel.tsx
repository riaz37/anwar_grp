import { Pill } from "@/components/ui/StatusPill";
import { TD_BASE, TH_BASE } from "@/components/ui/table";
import {
  OVERALL_RECOMMENDATION_TONE,
  panelFeedbackTone,
} from "@/components/ui/tone";
import { formatDate } from "@/lib/format";
import {
  OVERALL_RECOMMENDATION_LABELS,
  USER_ROLE_LABELS,
  type EvaluationSummaryView,
} from "@/lib/types/domain";

/**
 * Consolidated interview results for one round (spec Sec 6 > Decisions and
 * Approvals — "Recruiters should see: panel recommendations, average score,
 * missing feedback, assessment results, key concerns, hiring-manager
 * recommendation").
 *
 * The hard constraint on this panel is the sentence immediately after that
 * list: "The system may summarize information but must not make the final
 * hiring decision." So, concretely, this component:
 *
 *  - reports each panelist's own words and own recommendation, attributed;
 *  - shows the average as a plain number in a plain row, never as a headline
 *    figure with a colour that reads as a verdict;
 *  - applies semantic colour only to things a *human* said (a panelist's
 *    recommendation) and to process state (feedback missing), never to the
 *    aggregate;
 *  - carries no "recommended action", no ranking, no score threshold, no
 *    traffic light on the candidate;
 *  - ends by pointing at the place a human records the decision.
 *
 * Who sees it: every role except panel members and technical administrators —
 * see `SUMMARY_ROLES` in `_mock-evaluations.ts` for the reasoning, which
 * follows the role decision documented in `lib/evaluation-visibility.ts`. A
 * panel member gets their peers' individual evaluations after submitting, but
 * not the aggregate; the aggregate is the recruiter's instrument.
 */
export function EvaluationSummaryPanel({
  summary,
  onOpenScreening,
}: {
  summary: EvaluationSummaryView;
  /** Switches the application to its Screening tab — the spec's "assessment
   *  results" already live there and are not duplicated here. */
  onOpenScreening?: () => void;
}) {
  const complete = summary.missingFeedback.length === 0;

  return (
    <section
      aria-labelledby="evaluation-summary-heading"
      className="flex max-w-[var(--container-form)] flex-col gap-lg"
    >
      <div>
        <h4 id="evaluation-summary-heading" className="text-subhead text-text">
          Consolidated results
        </h4>
        <p className="mt-2xs max-w-[62ch] text-body-sm text-muted">
          Everything the panel recorded for this round, in one place. This is a
          summary for you to read — TalentFlow does not weigh it, rank it, or
          recommend an outcome. The decision is yours and the hiring
          manager&rsquo;s, and it is recorded by moving the application on the
          Pipeline tab.
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-md sm:grid-cols-3">
        <div>
          <dt className="text-caption font-medium uppercase tracking-[0.06em] text-muted">
            Average score
          </dt>
          <dd className="mt-2xs font-data text-body tabular-nums text-text">
            {summary.averageScore === null ? (
              <span className="text-muted">No submitted scores yet</span>
            ) : (
              <>
                {summary.averageScore.toFixed(1)}
                {summary.scoreMax !== null && (
                  <span className="text-muted"> / {summary.scoreMax}</span>
                )}
              </>
            )}
          </dd>
          <p className="mt-2xs text-caption text-muted">
            Across every scored criterion on the {summary.submittedCount}{" "}
            submitted evaluation
            {summary.submittedCount === 1 ? "" : "s"}.
          </p>
        </div>

        <div>
          <dt className="text-caption font-medium uppercase tracking-[0.06em] text-muted">
            Feedback received
          </dt>
          <dd className="mt-2xs">
            <Pill
              tone={panelFeedbackTone(
                summary.submittedCount,
                summary.totalPanelists,
              )}
              label={`${summary.submittedCount} of ${summary.totalPanelists} submitted`}
              size="md"
            />
          </dd>
        </div>

        <div>
          <dt className="text-caption font-medium uppercase tracking-[0.06em] text-muted">
            Missing feedback
          </dt>
          <dd
            className={`mt-2xs text-body-sm ${complete ? "text-muted" : "text-warning-ink"}`}
          >
            {complete
              ? "None — every panelist has submitted."
              : summary.missingFeedback
                  .map((person) => person.name)
                  .join(", ")}
          </dd>
        </div>
      </dl>

      <div>
        <h5 className="text-body font-semibold text-text">
          Panel recommendations
        </h5>
        <div className="mt-sm overflow-x-auto">
          <table className="w-full border-collapse">
            <caption className="sr-only">
              Each assigned panelist&rsquo;s overall recommendation and average
              score for this round
            </caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className={TH_BASE}>
                  Panelist
                </th>
                <th scope="col" className={TH_BASE}>
                  Recommendation
                </th>
                <th scope="col" className={`${TH_BASE} text-right`}>
                  Average
                </th>
                <th scope="col" className={`${TH_BASE} text-right`}>
                  Submitted
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.panelRecommendations.map((entry) => (
                <tr
                  key={entry.panelist.id}
                  className="border-b border-border last:border-b-0"
                >
                  <th scope="row" className={`${TD_BASE} font-medium text-text`}>
                    {entry.panelist.name}
                    <span className="block text-caption font-normal text-muted">
                      {USER_ROLE_LABELS[entry.panelistRole]}
                    </span>
                  </th>
                  <td className={TD_BASE}>
                    {entry.overallRecommendation ? (
                      <Pill
                        tone={
                          OVERALL_RECOMMENDATION_TONE[
                            entry.overallRecommendation
                          ]
                        }
                        label={
                          OVERALL_RECOMMENDATION_LABELS[
                            entry.overallRecommendation
                          ]
                        }
                      />
                    ) : (
                      <span className="text-warning-ink">Not submitted</span>
                    )}
                  </td>
                  <td
                    className={`${TD_BASE} text-right font-data tabular-nums`}
                  >
                    {entry.averageScore === null ? (
                      <span className="text-muted">—</span>
                    ) : (
                      entry.averageScore.toFixed(1)
                    )}
                  </td>
                  <td
                    className={`${TD_BASE} text-right font-data tabular-nums text-muted`}
                  >
                    {entry.submittedAt
                      ? formatDate(entry.submittedAt.slice(0, 10))
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border-t border-border pt-lg">
        <h5 className="text-body font-semibold text-text">
          Hiring-manager recommendation
        </h5>
        {summary.hiringManagerRecommendation ? (
          <p className="mt-sm flex flex-wrap items-center gap-sm text-body-sm text-text">
            <span>{summary.hiringManagerRecommendation.panelist.name}</span>
            <Pill
              tone={
                OVERALL_RECOMMENDATION_TONE[
                  summary.hiringManagerRecommendation.recommendation
                ]
              }
              label={
                OVERALL_RECOMMENDATION_LABELS[
                  summary.hiringManagerRecommendation.recommendation
                ]
              }
              size="md"
            />
          </p>
        ) : (
          <p className="mt-sm max-w-[62ch] text-body-sm text-muted">
            No hiring manager on this panel has submitted an evaluation. The
            approval step later in the pipeline expects one — it is the same
            person&rsquo;s row in the table above, called out here because the
            decision leans on it.
          </p>
        )}
      </div>

      <div className="border-t border-border pt-lg">
        <h5 className="text-body font-semibold text-text">Key concerns</h5>
        {summary.keyConcerns.length === 0 ? (
          <p className="mt-sm max-w-[62ch] text-body-sm text-muted">
            No panelist recorded a concern
            {summary.submittedCount === 0
              ? " — though nobody has submitted yet."
              : "."}
          </p>
        ) : (
          <ul className="mt-sm flex flex-col gap-md">
            {summary.keyConcerns.map((entry) => (
              <li key={entry.panelist.id} className="flex gap-md pl-md">
                {/* One marker per concern, warning-toned: the same device the
                    reschedule timeline uses, for the same reason — it makes
                    three separate concerns read as a list of distinct issues
                    rather than one block of prose. */}
                <span
                  aria-hidden="true"
                  className="relative -ml-md mt-[9px] size-1.5 shrink-0 rounded-full bg-warning"
                />
                <div className="min-w-0">
                  <p className="max-w-[62ch] whitespace-pre-line text-body-sm text-text">
                    {entry.concerns}
                  </p>
                  <p className="mt-2xs text-caption text-muted">
                    {entry.panelist.name}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-border pt-lg">
        <h5 className="text-body font-semibold text-text">
          Assessment results
        </h5>
        <p className="mt-sm max-w-[62ch] text-body-sm text-muted">
          The screening call and any paper or practical assessment are recorded
          on this application&rsquo;s Screening tab, and are not copied here —
          one record, one place to correct it.
        </p>
        {onOpenScreening && (
          <button
            type="button"
            onClick={onOpenScreening}
            className="mt-sm inline-flex min-h-11 items-center rounded-sm text-body-sm font-medium text-accent-ink underline decoration-transparent underline-offset-2 transition-colors duration-100 ease-move hover:decoration-current"
          >
            Open the Screening tab
          </button>
        )}
      </div>
    </section>
  );
}
