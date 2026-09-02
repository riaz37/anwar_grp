"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { InterviewStatusPill, Pill } from "@/components/ui/StatusPill";
import {
  OWN_EVALUATION_STATE_TONE,
  panelFeedbackTone,
} from "@/components/ui/tone";
import { formatDate, formatTime } from "@/lib/format";
import {
  OWN_EVALUATION_STATE_LABELS,
  ownEvaluationState,
  type InterviewEvaluationRound,
  type Viewer,
} from "@/lib/types/domain";
import { EvaluationRoundPanel } from "./EvaluationRoundPanel";

/**
 * Evaluations for one application, one entry per interview round.
 *
 * A sibling of the Interviews tab rather than a page of its own: an evaluation
 * belongs to a round, a round belongs to an application, and the second-level
 * tab strip (BUILD_PLAN.md Phase 3) is already where "everything about this
 * application" lives. Rounds are listed oldest-first, matching the Interviews
 * tab, so round 2 is never above round 1.
 *
 * The list is deliberately thin — round, when, whose feedback is in, and where
 * you stand. Everything else is one click away in `EvaluationRoundPanel`,
 * because the panelist's own form is long and the recruiter's consolidated
 * view is longer, and neither is something you scan four of at once.
 */

export function EvaluationsSection({
  rounds,
  viewer,
  onChange,
  initialRoundId,
  onOpenScreening,
}: {
  rounds: InterviewEvaluationRound[];
  viewer: Viewer;
  /** Lifted to the application panel so the tab counts stay in step. */
  onChange: (rounds: InterviewEvaluationRound[]) => void;
  /** Set when the user arrived from a round's "Evaluations" button on the
   *  Interviews tab — opens straight into that round. */
  initialRoundId?: string | null;
  onOpenScreening?: () => void;
}) {
  const [openRoundId, setOpenRoundId] = useState<string | null>(
    initialRoundId ?? null,
  );

  const open = rounds.find((round) => round.interviewId === openRoundId) ?? null;

  if (open) {
    return (
      <EvaluationRoundPanel
        round={open}
        viewer={viewer}
        onBack={() => setOpenRoundId(null)}
        onOpenScreening={onOpenScreening}
        onRoundChanged={(next) =>
          onChange(
            rounds.map((round) =>
              round.interviewId === next.interviewId ? next : round,
            ),
          )
        }
      />
    );
  }

  if (rounds.length === 0) {
    return (
      <div className="max-w-[var(--container-form)] rounded-md border border-dashed border-border bg-surface px-lg py-xl">
        <h4 className="text-subhead text-text">No rounds to evaluate</h4>
        <p className="mt-sm max-w-[58ch] text-body-sm text-muted">
          Evaluations hang off interview rounds — schedule a round on the
          Interviews tab and assign it a form, and every panelist on it gets
          their own evaluation to fill in here.
        </p>
      </div>
    );
  }

  return (
    <ol className="flex max-w-[var(--container-form)] flex-col gap-md">
      {rounds.map((round) => {
        const ownState = ownEvaluationState(round.own);
        const owed = round.viewerIsPanelist && ownState !== "SUBMITTED";

        return (
          <li key={round.interviewId}>
            <article className="rounded-md border border-border bg-surface px-md py-md lg:px-lg lg:py-lg">
              <header className="flex flex-wrap items-start justify-between gap-md">
                <div className="min-w-0">
                  <p className="font-data text-caption tabular-nums uppercase tracking-[0.08em] text-muted">
                    Round {round.roundNumber}
                  </p>
                  <h4 className="mt-2xs text-subhead text-text">
                    {round.title}
                  </h4>
                  <p className="mt-2xs text-body-sm text-muted">
                    <span className="font-data tabular-nums">
                      {formatDate(round.scheduledDate)} ·{" "}
                      {formatTime(round.scheduledTime)}
                    </span>
                    {round.template ? (
                      <> · {round.template.name}</>
                    ) : (
                      <> · no evaluation form assigned</>
                    )}
                  </p>
                </div>
                <InterviewStatusPill status={round.status} size="md" />
              </header>

              <div className="mt-md flex flex-wrap items-center gap-sm border-t border-border pt-md">
                <Pill
                  tone={panelFeedbackTone(
                    round.submittedCount,
                    round.totalPanelists,
                  )}
                  label={`${round.submittedCount} of ${round.totalPanelists} panelists submitted`}
                  size="md"
                />
                {round.viewerIsPanelist && (
                  <Pill
                    tone={OWN_EVALUATION_STATE_TONE[ownState]}
                    label={`Yours: ${OWN_EVALUATION_STATE_LABELS[ownState].toLowerCase()}`}
                    size="md"
                  />
                )}
                <div className="ml-auto">
                  <Button
                    variant={owed ? "primary" : "secondary"}
                    onClick={() => setOpenRoundId(round.interviewId)}
                  >
                    {owed
                      ? "Fill in your evaluation"
                      : round.summary
                        ? "Open results"
                        : "Open round"}
                    <span className="sr-only"> for round {round.roundNumber}</span>
                  </Button>
                </div>
              </div>
            </article>
          </li>
        );
      })}
    </ol>
  );
}
