"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextAreaField } from "@/components/ui/Field";
import { InlineBanner, LiveRegion } from "@/components/ui/InlineBanner";
import { daysSince } from "@/lib/format";
import type {
  ApprovalOutcome,
  ApprovalRequest,
  ApprovalStep,
} from "@/lib/types/approvals";
import { USER_ROLE_LABELS } from "@/lib/types/domain";

/**
 * Approve or reject the step the chain is currently waiting on.
 *
 * The ceremony is deliberately the one `components/communications/
 * CommunicationCard.tsx` uses for approving a candidate message: pick the
 * action, then confirm it in an inline block with an explicit acknowledgement,
 * rather than a bare button. Both are irreversible, both are the moment a
 * compliance-relevant record is written, and a recruiter who has learned the
 * gesture once should not have to learn a second one. Inline rather than a
 * modal, per DESIGN.md's calm register and the same reasoning that made the
 * conflict banner inline.
 *
 * Comments are REQUIRED on a rejection and optional on an approval. That
 * asymmetry is the point of the whole module: an approval with no comment is
 * still fully attributed ("Rowshan Ara approved this on 14 Sep"), whereas a
 * rejection with no reason is exactly the untraceable decision Anwar Group's
 * current email-and-WhatsApp process produces — and the one thing the next
 * person to look at this candidate will need.
 *
 * The comment is INTERNAL. It is written to the approval record and read on
 * this tab; it is structurally unable to reach a candidate-facing message
 * (`lib/communications/field-allowlist.ts` has no field it could occupy), and
 * the Selection/Rejection prompt below never passes it into a draft.
 */

type Status =
  | { phase: "idle" }
  | { phase: "confirming"; outcome: ApprovalOutcome }
  | { phase: "working"; outcome: ApprovalOutcome }
  | { phase: "error"; message: string };

export function ApprovalDecisionForm({
  request,
  step,
  onDecide,
}: {
  request: ApprovalRequest;
  step: ApprovalStep;
  /** Throws with a readable message on refusal; see `_approval-actions.ts`. */
  onDecide: (input: {
    stepId: string;
    outcome: ApprovalOutcome;
    comments: string;
    version: number;
  }) => Promise<void>;
}) {
  const prefix = useId();
  const [comments, setComments] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [commentError, setCommentError] = useState<string | undefined>();
  const [status, setStatus] = useState<Status>({ phase: "idle" });
  const confirmRef = useRef<HTMLDivElement>(null);

  const working = status.phase === "working";
  const confirming = status.phase === "confirming" ? status.outcome : null;
  const rejecting = confirming === "REJECTED";

  /* Move focus into the confirmation when it appears: a keyboard user who
     pressed "Reject" must land on the thing they now have to answer, not stay
     on a button that has been replaced. */
  useEffect(() => {
    if (status.phase === "confirming") confirmRef.current?.focus();
  }, [status.phase]);

  /* How long this step has been the blocker: since the previous step was
     decided, or since the chain started if this is the first one. */
  const lastDecidedAt = request.steps.reduce<string | null>(
    (latest, entry) => entry.decision?.decidedAt ?? latest,
    null,
  );
  const waitingDays = daysSince(lastDecidedAt ?? request.initiatedAt);

  function reset() {
    setComments("");
    setAcknowledged(false);
    setCommentError(undefined);
    setStatus({ phase: "idle" });
  }

  async function submit(outcome: ApprovalOutcome) {
    if (outcome === "REJECTED" && comments.trim().length === 0) {
      setCommentError(
        "Say why you are rejecting. It stays internal, and it is what the recruiter needs to act on.",
      );
      return;
    }
    setCommentError(undefined);
    setStatus({ phase: "working", outcome });
    try {
      await onDecide({
        stepId: step.id,
        outcome,
        comments: comments.trim(),
        version: request.version,
      });
      // Deliberately no success banner here: the chain redraws around this
      // form, the step's own row now reads "Approved by you", and the section
      // announces the change through its live region. A second confirmation
      // would be the same news twice.
      reset();
    } catch (error) {
      setStatus({
        phase: "error",
        message:
          error instanceof Error
            ? error.message
            : "That decision wasn’t recorded. Try again.",
      });
    }
  }

  return (
    <div className="rounded-md border border-warning-soft bg-warning-soft px-md py-md">
      <p className="text-body-sm font-semibold text-warning-ink">
        This step is yours to decide
      </p>
      <p className="mt-2xs max-w-[62ch] text-body-sm text-warning-ink">
        You hold the {USER_ROLE_LABELS[step.approverRole].toLowerCase()} role
        this chain is waiting on
        {waitingDays > 0
          ? `, and it has been waiting ${waitingDays} day${waitingDays === 1 ? "" : "s"}`
          : ""}
        . Nothing is sent to the candidate by this action — the recruiter tells
        them separately, in their own words.
      </p>

      <LiveRegion>
        {status.phase === "error" && (
          <div className="mt-md">
            <InlineBanner
              tone="error"
              title="That decision wasn’t recorded"
              onDismiss={() => setStatus({ phase: "idle" })}
            >
              {status.message}
            </InlineBanner>
          </div>
        )}
      </LiveRegion>

      {confirming ? (
        <div
          ref={confirmRef}
          tabIndex={-1}
          role="group"
          aria-label={
            rejecting ? "Confirm rejection" : "Confirm approval"
          }
          className="mt-md rounded-sm border border-border bg-surface px-md py-md motion-safe:animate-[fade-in_200ms_var(--ease-enter)]"
        >
          <p className="text-body-sm font-semibold text-text">
            {rejecting
              ? "Reject at this step?"
              : "Approve this step and pass it on?"}
          </p>
          <p className="mt-2xs max-w-[62ch] text-body-sm text-muted">
            {rejecting
              ? "A rejection ends the chain here. No later approver is asked, and the request cannot be reopened — a new one has to be started."
              : "Your name and the time are recorded against this step, and the next approver is asked. A recorded decision cannot be edited or withdrawn."}
          </p>

          <div className="mt-md">
            <TextAreaField
              id={`${prefix}-comments`}
              label={rejecting ? "Why are you rejecting?" : "Comments"}
              required={rejecting}
              rows={3}
              disabled={working}
              value={comments}
              onChange={setComments}
              error={commentError}
              hint="Kept on the permanent approval record. Internal only — never sent to the candidate, and never used to write one."
            />
          </div>

          <label className="mt-md flex min-h-11 items-start gap-sm text-body-sm text-text">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              className="mt-[5px] size-4 shrink-0 accent-[var(--accent)]"
            />
            {rejecting
              ? "I understand this ends the approval chain for this candidate."
              : "I have read the panel’s consolidated results above."}
          </label>

          <div className="mt-md flex flex-wrap items-center gap-sm">
            <Button
              variant="primary"
              disabled={!acknowledged || working}
              aria-busy={working}
              onClick={() => void submit(confirming)}
            >
              {working
                ? "Recording…"
                : rejecting
                  ? "Record rejection"
                  : "Record approval"}
            </Button>
            <Button variant="ghost" disabled={working} onClick={reset}>
              Not yet
            </Button>
            <span className="font-data text-caption tabular-nums text-muted">
              record version {request.version}
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-md flex flex-wrap items-center gap-sm">
          <Button
            variant="primary"
            onClick={() =>
              setStatus({ phase: "confirming", outcome: "APPROVED" })
            }
          >
            Approve…
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              setStatus({ phase: "confirming", outcome: "REJECTED" })
            }
          >
            Reject…
          </Button>
        </div>
      )}
    </div>
  );
}
