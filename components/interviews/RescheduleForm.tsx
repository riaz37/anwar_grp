"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextInputField, TextAreaField } from "@/components/ui/Field";
import { InlineBanner, LiveRegion } from "@/components/ui/InlineBanner";
import { ApiRequestError } from "@/lib/api-client";
import { formatDate, formatTime, todayIsoDate } from "@/lib/format";
import type { InterviewRescheduleEntry, InterviewRound } from "@/lib/types/domain";
import { TimeField } from "./InterviewForm";

/**
 * Move a booked interview (spec Sec 6 > Interview Scheduling, "Rescheduling
 * history").
 *
 * The reason is required, and the copy says why: the history entry this
 * creates is what a candidate's "you moved my interview twice" complaint gets
 * answered with three weeks later. A reschedule with an empty reason is the
 * exact gap the system exists to close, so it is a validation error, not a
 * nudge.
 */

/* ──────────────────────────────────────────────────────────────────────────
 * SWAP POINT — reschedule write
 *
 * TODO(backend): POST /api/v1/interviews/{id}/reschedule
 *   { toDate, toTime, reason, version } -> { interview, historyEntry }
 *
 * Its own endpoint rather than a PATCH of `scheduledDate`/`scheduledTime`: the
 * date change and the `InterviewRescheduleHistory` insert must be one
 * transaction, and the history table should be insert-only at the DB grant
 * level for the same reason `StageHistory` is (BUILD_PLAN.md Sec 2.3).
 *
 * The route should also flip `status` to `RESCHEDULED` and return the updated
 * round, so the client never has to infer that itself.
 * ────────────────────────────────────────────────────────────────────────── */
async function submitReschedule(input: {
  interviewId: string;
  toDate: string;
  toTime: string;
  reason: string;
  version: number;
}): Promise<{ historyEntryId: string; version: number }> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return {
    historyEntryId: `${input.interviewId}_rs_local_${Date.now()}`,
    version: input.version + 1,
  };
}

type Status =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "conflict" }
  | { phase: "error"; message: string };

export function RescheduleForm({
  interview,
  currentUser,
  onRescheduled,
  onCancel,
}: {
  interview: InterviewRound;
  currentUser: { id: string; name: string };
  onRescheduled: (change: {
    toDate: string;
    toTime: string;
    version: number;
    entry: InterviewRescheduleEntry;
  }) => void;
  onCancel: () => void;
}) {
  const prefix = useId();
  const [toDate, setToDate] = useState(interview.scheduledDate);
  const [toTime, setToTime] = useState(interview.scheduledTime);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>({ phase: "idle" });

  const submitting = status.phase === "submitting";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const found: Record<string, string> = {};
    if (!toDate) found.toDate = "Pick the new date.";
    if (!toTime) found.toTime = "Pick the new start time.";
    if (
      toDate === interview.scheduledDate &&
      toTime === interview.scheduledTime
    ) {
      found.toDate = "This is the time it is already booked for.";
    }
    if (reason.trim().length < 5) {
      found.reason =
        "Give the reason. It goes on this round’s permanent history, and it is what explains the change to the candidate and the panel later.";
    }
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setStatus({ phase: "idle" });
      return;
    }

    setStatus({ phase: "submitting" });
    try {
      const result = await submitReschedule({
        interviewId: interview.id,
        toDate,
        toTime,
        reason: reason.trim(),
        version: interview.version,
      });

      onRescheduled({
        toDate,
        toTime,
        version: result.version,
        entry: {
          id: result.historyEntryId,
          interviewId: interview.id,
          fromDate: interview.scheduledDate,
          fromTime: interview.scheduledTime,
          toDate,
          toTime,
          reason: reason.trim(),
          changedBy: currentUser,
          changedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 409) {
        setStatus({ phase: "conflict" });
        return;
      }
      setStatus({
        phase: "error",
        message:
          error instanceof Error
            ? error.message
            : "The reschedule wasn’t saved. Try again.",
      });
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-md flex flex-col gap-md rounded-md border border-border-strong bg-surface-sunken px-md py-md motion-safe:animate-[fade-in_200ms_var(--ease-enter)]"
    >
      <div>
        <h5 className="text-body font-semibold text-text">
          Move round {interview.roundNumber}
        </h5>
        <p className="mt-2xs text-body-sm text-muted">
          Currently{" "}
          <span className="font-data tabular-nums text-text">
            {formatDate(interview.scheduledDate)} at{" "}
            {formatTime(interview.scheduledTime)}
          </span>
          . The candidate is not told automatically — draft a rescheduling
          message on the Messages tab afterwards.
        </p>
      </div>

      <LiveRegion>
        {status.phase === "conflict" && (
          <InlineBanner
            tone="warning"
            title="Someone else moved this interview first"
            onDismiss={() => setStatus({ phase: "idle" })}
          >
            Nothing was overwritten. Reload the application to see where the
            round sits now.
          </InlineBanner>
        )}
        {status.phase === "error" && (
          <InlineBanner
            tone="error"
            title="That reschedule wasn’t saved"
            onDismiss={() => setStatus({ phase: "idle" })}
          >
            {status.message}
          </InlineBanner>
        )}
      </LiveRegion>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <TextInputField
          id={`${prefix}-to-date`}
          label="New date"
          type="date"
          required
          disabled={submitting}
          value={toDate}
          onChange={setToDate}
          error={errors.toDate}
          hint={`Today is ${todayIsoDate()}.`}
        />
        <TimeField
          id={`${prefix}-to-time`}
          label="New start time"
          value={toTime}
          onChange={setToTime}
          error={errors.toTime}
          disabled={submitting}
        />
      </div>

      <TextAreaField
        id={`${prefix}-reason`}
        label="Reason for the change"
        required
        rows={3}
        disabled={submitting}
        value={reason}
        onChange={setReason}
        error={errors.reason}
        hint="Kept on this round’s rescheduling history permanently."
      />

      <div className="flex flex-wrap items-center gap-md">
        <Button
          type="submit"
          variant="primary"
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? "Moving…" : "Move this interview"}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Keep the current time
        </Button>
      </div>
    </form>
  );
}
