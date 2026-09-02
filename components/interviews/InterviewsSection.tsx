"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { LiveRegion } from "@/components/ui/InlineBanner";
import { PlusIcon } from "@/components/ui/icons";
import { formatDate, formatTime } from "@/lib/format";
import type {
  EvaluationFormRef,
  InterviewRound,
  PersonRef,
} from "@/lib/types/domain";
import { InterviewCard } from "./InterviewCard";
import { InterviewForm } from "./InterviewForm";

/**
 * Every interview round on one application (spec Sec 6 > Interview Scheduling,
 * "Multiple interview rounds").
 *
 * Rounds are listed newest-round-last, matching the order they happen in — a
 * reverse-chronological list would put "round 3" above "round 1" and make the
 * sequence, which is the whole point of numbered rounds, harder to read than
 * it needs to be.
 */

type Mode =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; interviewId: string };

export function InterviewsSection({
  applicationId,
  interviews: rounds,
  onChange,
  panelMembers,
  evaluationForms,
  currentUser,
}: {
  applicationId: string;
  interviews: InterviewRound[];
  /** Lifted to the application panel so the Messages tab sees new rounds. */
  onChange: (rounds: InterviewRound[]) => void;
  panelMembers: readonly (PersonRef & { role: string })[];
  evaluationForms: readonly EvaluationFormRef[];
  currentUser: PersonRef;
}) {
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [announcement, setAnnouncement] = useState("");

  const nextRoundNumber =
    rounds.reduce((highest, round) => Math.max(highest, round.roundNumber), 0) +
    1;

  /**
   * Optimistic local update. With the real API this stays as is — the POST /
   * PATCH response supplies the id, round number and version, and the mock
   * `submitInterview` already returns that shape.
   */
  function handleSaved(saved: InterviewRound) {
    const exists = rounds.some((round) => round.id === saved.id);
    const next = exists
      ? rounds.map((round) => (round.id === saved.id ? saved : round))
      : [...rounds, saved];
    onChange([...next].sort((a, b) => a.roundNumber - b.roundNumber));
    setMode({ kind: "list" });
    setAnnouncement(
      `Round ${saved.roundNumber}, ${saved.title}, saved for ${formatDate(saved.scheduledDate)} at ${formatTime(saved.scheduledTime)}.`,
    );
  }

  function handleRescheduled(
    interviewId: string,
    change: Parameters<
      React.ComponentProps<typeof InterviewCard>["onRescheduled"]
    >[0],
  ) {
    onChange(
      rounds.map((round) =>
        round.id === interviewId
          ? {
              ...round,
              scheduledDate: change.toDate,
              scheduledTime: change.toTime,
              status: "RESCHEDULED" as const,
              rescheduleHistory: [...round.rescheduleHistory, change.entry],
              updatedAt: change.entry.changedAt,
              version: change.version,
            }
          : round,
      ),
    );
    setAnnouncement(
      `Interview moved to ${formatDate(change.toDate)} at ${formatTime(change.toTime)}. The reason is recorded in this round’s rescheduling history.`,
    );
  }

  if (mode.kind !== "list") {
    const existing =
      mode.kind === "edit"
        ? (rounds.find((round) => round.id === mode.interviewId) ?? null)
        : null;

    return (
      <InterviewForm
        applicationId={applicationId}
        existing={existing}
        nextRoundNumber={nextRoundNumber}
        panelMembers={panelMembers}
        evaluationForms={evaluationForms}
        onSaved={handleSaved}
        onCancel={() => setMode({ kind: "list" })}
      />
    );
  }

  return (
    <div className="flex max-w-[var(--container-form)] flex-col gap-lg">
      {/* Status changes are announced, not just shown (DESIGN.md >
          Accessibility). */}
      <LiveRegion>
        {announcement && (
          <p className="rounded-sm border border-success-soft bg-success-soft px-md py-sm text-body-sm text-success-ink">
            {announcement}
          </p>
        )}
      </LiveRegion>

      {rounds.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-surface px-lg py-xl">
          <h4 className="text-subhead text-text">No rounds scheduled</h4>
          <p className="mt-sm max-w-[58ch] text-body-sm text-muted">
            An application can carry as many rounds as the role needs. Each one
            holds its own date, panel, evaluation form and candidate
            instructions — and its own record of every time it moved.
          </p>
          <div className="mt-lg">
            <Button variant="primary" onClick={() => setMode({ kind: "create" })}>
              <PlusIcon />
              Schedule round 1
            </Button>
          </div>
        </div>
      ) : (
        <>
          <ol className="flex flex-col gap-md">
            {rounds.map((round) => (
              <li key={round.id}>
                <InterviewCard
                  interview={round}
                  currentUser={currentUser}
                  onEdit={() =>
                    setMode({ kind: "edit", interviewId: round.id })
                  }
                  onRescheduled={(change) => handleRescheduled(round.id, change)}
                />
              </li>
            ))}
          </ol>

          <div>
            <Button variant="secondary" onClick={() => setMode({ kind: "create" })}>
              <PlusIcon />
              Schedule round {nextRoundNumber}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
