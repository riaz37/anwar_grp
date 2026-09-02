"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { InterviewStatusPill, Pill } from "@/components/ui/StatusPill";
import { panelFeedbackTone } from "@/components/ui/tone";
import {
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  UsersIcon,
  VideoIcon,
} from "@/components/ui/icons";
import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatTime,
} from "@/lib/format";
import type {
  InterviewEvaluationRound,
  InterviewRescheduleEntry,
  InterviewRound,
  PersonRef,
} from "@/lib/types/domain";
import { RescheduleForm } from "./RescheduleForm";

/**
 * One interview round, with its rescheduling history.
 *
 * The history is rendered as an always-visible timeline rather than something
 * behind a disclosure: spec Sec 6 lists "Rescheduling history" as a thing the
 * system must *support showing*, and a round that has been moved twice is
 * exactly the round whose story a recruiter needs at a glance. Rounds that
 * have never moved render no timeline at all, so the common case stays quiet.
 */

function MetaRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-sm">
      <span className="mt-2xs shrink-0 text-muted" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <span className="block text-caption font-medium uppercase tracking-[0.06em] text-muted">
          {label}
        </span>
        <span className="block text-body-sm text-text">{children}</span>
      </div>
    </div>
  );
}

export function InterviewCard({
  interview,
  currentUser,
  evaluation,
  onRescheduled,
  onEdit,
  onOpenEvaluations,
}: {
  interview: InterviewRound;
  currentUser: PersonRef;
  /** Phase 4 feedback status for this round, when the caller has it. */
  evaluation?: InterviewEvaluationRound;
  onOpenEvaluations?: () => void;
  onRescheduled: (change: {
    toDate: string;
    toTime: string;
    version: number;
    entry: InterviewRescheduleEntry;
  }) => void;
  onEdit: () => void;
}) {
  const [rescheduling, setRescheduling] = useState(false);
  const history = interview.rescheduleHistory;
  const movable =
    interview.status === "SCHEDULED" || interview.status === "RESCHEDULED";

  return (
    <article className="rounded-md border border-border bg-surface px-md py-md lg:px-lg lg:py-lg">
      <header className="flex flex-wrap items-start justify-between gap-md">
        <div className="min-w-0">
          <p className="font-data text-caption tabular-nums uppercase tracking-[0.08em] text-muted">
            Round {interview.roundNumber}
          </p>
          <h4 className="mt-2xs text-subhead text-text">{interview.title}</h4>
        </div>
        <InterviewStatusPill status={interview.status} size="md" />
      </header>

      <div className="mt-md grid grid-cols-1 gap-md sm:grid-cols-2">
        <MetaRow icon={<CalendarIcon />} label="Date">
          <span className="font-data tabular-nums">
            {formatDate(interview.scheduledDate)}
          </span>
        </MetaRow>
        <MetaRow icon={<ClockIcon />} label="Time">
          <span className="font-data tabular-nums">
            {formatTime(interview.scheduledTime)}
          </span>{" "}
          · {formatDuration(interview.durationMinutes)}
        </MetaRow>
        <MetaRow
          icon={interview.mode === "ONLINE" ? <VideoIcon /> : <MapPinIcon />}
          label={interview.mode === "ONLINE" ? "Online link" : "Location"}
        >
          {interview.mode === "ONLINE" && interview.onlineLink ? (
            <a
              href={interview.onlineLink}
              className="link break-all"
              rel="noreferrer noopener"
              target="_blank"
            >
              {interview.onlineLink}
            </a>
          ) : (
            (interview.location ?? "—")
          )}
        </MetaRow>
        <MetaRow icon={<UsersIcon />} label="Panel">
          {interview.panel.length === 0
            ? "Nobody assigned"
            : interview.panel.map((person) => person.name).join(", ")}
        </MetaRow>
      </div>

      {(interview.evaluationFormName || interview.candidateInstructions) && (
        <div className="mt-md flex flex-col gap-sm border-t border-border pt-md">
          {interview.evaluationFormName && (
            <div className="flex flex-wrap items-center gap-sm">
              <p className="text-body-sm text-muted">
                <span className="font-medium text-text">Evaluation form:</span>{" "}
                {interview.evaluationFormName}
              </p>
              {evaluation && (
                <Pill
                  tone={panelFeedbackTone(
                    evaluation.submittedCount,
                    evaluation.totalPanelists,
                  )}
                  label={`${evaluation.submittedCount} of ${evaluation.totalPanelists} panelists submitted`}
                />
              )}
              {onOpenEvaluations && (
                /* Ghost, not primary: on this tab the round's own actions
                   (reschedule, edit) are the point, and this is a jump
                   sideways to the Evaluations tab. */
                <Button variant="ghost" onClick={onOpenEvaluations}>
                  Open evaluations
                  <span className="sr-only">
                    {" "}
                    for round {interview.roundNumber}
                  </span>
                </Button>
              )}
            </div>
          )}
          {interview.candidateInstructions && (
            <p className="max-w-[62ch] text-body-sm text-muted">
              <span className="font-medium text-text">
                Candidate instructions:
              </span>{" "}
              {interview.candidateInstructions}
            </p>
          )}
        </div>
      )}

      {history.length > 0 && (
        <section
          aria-label={`Rescheduling history for round ${interview.roundNumber}`}
          className="mt-md border-t border-border pt-md"
        >
          <h5 className="text-body-sm font-semibold text-text">
            Rescheduling history
          </h5>
          <ol className="mt-sm flex flex-col gap-md">
            {[...history].reverse().map((entry) => (
              <li key={entry.id} className="relative flex gap-md pl-md">
                {/* One marker per move. The only decoration on the card, and it
                    earns its place: it is what makes three moves read as a
                    sequence rather than three unrelated notes. Warning-toned
                    because a reschedule is time slipping, which is exactly what
                    that tone means everywhere else in the product. */}
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-[9px] size-1.5 rounded-full bg-warning"
                />
                <div className="min-w-0">
                  <p className="font-data text-body-sm tabular-nums text-text">
                    {formatDate(entry.fromDate)} {formatTime(entry.fromTime)}
                    <span className="px-xs text-muted" aria-label="moved to">
                      →
                    </span>
                    {formatDate(entry.toDate)} {formatTime(entry.toTime)}
                  </p>
                  <p className="mt-2xs max-w-[62ch] text-body-sm text-muted">
                    {entry.reason}
                  </p>
                  <p className="mt-2xs text-caption text-muted">
                    {entry.changedBy.name} ·{" "}
                    <span className="font-data tabular-nums">
                      {formatDateTime(entry.changedAt)}
                    </span>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {rescheduling ? (
        <RescheduleForm
          interview={interview}
          currentUser={currentUser}
          onCancel={() => setRescheduling(false)}
          onRescheduled={(change) => {
            onRescheduled(change);
            setRescheduling(false);
          }}
        />
      ) : (
        <div className="mt-md flex flex-wrap items-center gap-sm border-t border-border pt-md">
          {movable && (
            <Button variant="secondary" onClick={() => setRescheduling(true)}>
              Reschedule
            </Button>
          )}
          <Button variant="ghost" onClick={onEdit}>
            Edit details
          </Button>
          {history.length > 0 && (
            <span className="ml-auto font-data text-caption tabular-nums text-muted">
              moved {history.length} time{history.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
      )}
    </article>
  );
}
