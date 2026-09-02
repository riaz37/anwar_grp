"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { LiveRegion } from "@/components/ui/InlineBanner";
import { InterviewStatusPill, Pill } from "@/components/ui/StatusPill";
import { ArrowLeftIcon, UnlockIcon } from "@/components/ui/icons";
import { panelFeedbackTone } from "@/components/ui/tone";
import { formatDate, formatTime } from "@/lib/format";
import {
  OWN_EVALUATION_STATE_LABELS,
  ownEvaluationState,
  type InterviewEvaluationRound,
  type Viewer,
} from "@/lib/types/domain";
import { EvaluationForm } from "./EvaluationForm";
import { EvaluationRecordCard } from "./EvaluationRecordCard";
import { EvaluationSummaryPanel } from "./EvaluationSummaryPanel";
import { PanelFeedback } from "./PanelFeedback";

/**
 * One interview round's evaluation surface, in the order the work happens:
 * your own evaluation first, then the panel's, then — for the roles that act
 * on it — the consolidated results.
 *
 * Ordering is the point. Putting "your evaluation" first is what makes the
 * blind gate read as a consequence of your own outstanding work rather than as
 * an arbitrary refusal, and it keeps the panelist's one job at the top of
 * their screen.
 */
export function EvaluationRoundPanel({
  round,
  viewer,
  onRoundChanged,
  onBack,
  onOpenScreening,
}: {
  round: InterviewEvaluationRound;
  viewer: Viewer;
  /** Draft saved or evaluation submitted — the server hands back a whole
   *  freshly-filtered round, including any peer feedback the submission just
   *  unlocked. The client never unblinds itself. */
  onRoundChanged: (round: InterviewEvaluationRound) => void;
  onBack: () => void;
  onOpenScreening?: () => void;
}) {
  const [announcement, setAnnouncement] = useState("");
  const ownState = ownEvaluationState(round.own);
  const submitted = ownState === "SUBMITTED";
  const scheduledInFuture =
    round.status === "SCHEDULED" || round.status === "RESCHEDULED";

  return (
    <div className="flex flex-col gap-xl">
      <div>
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeftIcon />
          All rounds
        </Button>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-md border-b border-border pb-lg">
        <div className="min-w-0">
          <p className="font-data text-caption tabular-nums uppercase tracking-[0.08em] text-muted">
            Round {round.roundNumber}
          </p>
          <h3 className="mt-2xs text-section text-text">{round.title}</h3>
          <p className="mt-2xs text-body-sm text-muted">
            <span className="font-data tabular-nums">
              {formatDate(round.scheduledDate)} · {formatTime(round.scheduledTime)}
            </span>
            {round.template && <> · {round.template.name}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-sm">
          <InterviewStatusPill status={round.status} size="md" />
          <Pill
            tone={panelFeedbackTone(round.submittedCount, round.totalPanelists)}
            label={`${round.submittedCount} of ${round.totalPanelists} submitted`}
            size="md"
          />
        </div>
      </header>

      <LiveRegion>
        {announcement && (
          <p className="flex items-start gap-sm rounded-sm border border-success-soft bg-success-soft px-md py-sm text-body-sm text-success-ink">
            <UnlockIcon className="mt-2xs shrink-0" />
            <span className="max-w-[62ch]">{announcement}</span>
          </p>
        )}
      </LiveRegion>

      {round.viewerIsPanelist && (
        <section
          aria-labelledby={`own-${round.interviewId}`}
          className="flex flex-col gap-md"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-md">
            <h4
              id={`own-${round.interviewId}`}
              className="text-subhead text-text"
            >
              Your evaluation
            </h4>
            <span className="text-body-sm text-muted">
              {OWN_EVALUATION_STATE_LABELS[ownState]}
            </span>
          </div>

          {submitted && round.own ? (
            <div className="max-w-[var(--container-form)]">
              <EvaluationRecordCard
                record={round.own}
                criteria={round.template?.criteria ?? []}
                variant="own-locked"
              />
            </div>
          ) : round.template ? (
            <>
              {scheduledInFuture && (
                <p className="max-w-[62ch] text-body-sm text-muted">
                  This round is still ahead of you — it is on{" "}
                  <span className="font-data tabular-nums">
                    {formatDate(round.scheduledDate)}
                  </span>
                  . You can start a draft now, but most panelists fill this in
                  straight after the interview.
                </p>
              )}
              <EvaluationForm
                round={round}
                template={round.template}
                own={round.own}
                viewerId={viewer.id}
                onSaved={onRoundChanged}
                onSubmitted={(next) => {
                  onRoundChanged(next);
                  setAnnouncement(
                    next.panelFeedback.state === "OPEN"
                      ? `Your evaluation for round ${next.roundNumber} is submitted and locked. The rest of the panel’s feedback is now shown below.`
                      : `Your evaluation for round ${next.roundNumber} is submitted and locked.`,
                  );
                }}
              />
            </>
          ) : (
            <p className="max-w-[62ch] rounded-md border border-warning-soft bg-warning-soft px-md py-sm text-body-sm text-warning-ink">
              This round was scheduled without an evaluation form, so there is
              nothing to fill in yet. A recruiter can assign one from the
              Interviews tab — the form decides which criteria you are asked to
              score.
            </p>
          )}
        </section>
      )}

      <section
        aria-labelledby={`panel-${round.interviewId}`}
        className="flex flex-col gap-md border-t border-border pt-lg"
      >
        <h4
          id={`panel-${round.interviewId}`}
          className="text-subhead text-text"
        >
          Panel feedback
        </h4>
        <PanelFeedback
          feedback={round.panelFeedback}
          criteria={round.template?.criteria ?? []}
          viewerIsPanelist={round.viewerIsPanelist}
        />
      </section>

      {round.summary && (
        <div className="border-t border-border pt-lg">
          <EvaluationSummaryPanel
            summary={round.summary}
            onOpenScreening={onOpenScreening}
          />
        </div>
      )}
    </div>
  );
}
