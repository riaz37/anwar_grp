"use client";

import type { ReactNode } from "react";
import { ApprovalStatusPill, ApprovalStepPill } from "@/components/ui/StatusPill";
import { SegmentedTrack, type TrackSegment } from "@/components/ui/SegmentedTrack";
import { APPROVAL_STEP_STATE_TONE, TONE_DOT } from "@/components/ui/tone";
import { formatDateTime } from "@/lib/format";
import {
  APPROVAL_REQUEST_STATUS_MEANING,
  approvedStepCount,
  awaitingStep,
  rejectingStep,
  type ApprovalRequest,
  type ApprovalStep,
} from "@/lib/types/approvals";
import { USER_ROLE_LABELS } from "@/lib/types/domain";

/**
 * The approval chain for one application, as a track plus a timeline.
 *
 * The track at the top is the same component the nine-stage pipeline uses
 * (`components/ui/SegmentedTrack`) — an approval chain is another ordered
 * process with a position along it, and giving it a second, differently-shaped
 * stepper on the same screen would be decoration rather than information. The
 * timeline below is where a chain differs from the pipeline: each step carries
 * a person, a decision, a reason and a timestamp, and none of that fits in a
 * bar.
 *
 * The property this component exists to make obvious is that **a single
 * rejection ends the chain**. A rejected chain's later steps are rendered as
 * "Never asked", struck through, with an explicit sentence naming the step the
 * chain stopped at — never as "pending", which would imply the chain might
 * still move.
 */

const SEGMENT_FILL = {
  APPROVED: "bg-success",
  REJECTED: "bg-error",
  AWAITING: "bg-warning",
  NOT_REACHED: "bg-border",
  HALTED: "bg-border",
} as const;

const SPOKEN_STATE = {
  APPROVED: "approved",
  REJECTED: "rejected — the chain ended here",
  AWAITING: "waiting on this approver now",
  NOT_REACHED: "not reached yet",
  HALTED: "never asked",
} as const;

export function ApprovalChainProgress({
  request,
  /** Rendered inside the step the chain is waiting on, when the viewer may act. */
  decisionAction,
}: {
  request: ApprovalRequest;
  decisionAction?: ReactNode;
}) {
  const current = awaitingStep(request);
  const stopped = rejectingStep(request);
  const approved = approvedStepCount(request);

  const segments: TrackSegment[] = request.steps.map((step) => ({
    key: step.id,
    label: USER_ROLE_LABELS[step.approverRole],
    fill: SEGMENT_FILL[step.state],
    spokenState: SPOKEN_STATE[step.state],
    emphasised: step.state === "AWAITING" || step.state === "REJECTED",
  }));

  return (
    <section
      aria-labelledby="approval-chain-heading"
      className="flex flex-col gap-lg"
    >
      <div>
        <h4 id="approval-chain-heading" className="text-subhead text-text">
          Approval chain
        </h4>
        <p className="mt-2xs max-w-[62ch] text-body-sm text-muted">
          {APPROVAL_REQUEST_STATUS_MEANING[request.status]}
        </p>
      </div>

      <div>
        <SegmentedTrack
          segments={segments}
          ariaLabel="Approval chain progress"
          labelsFrom="sm"
        />
        <p className="mt-sm flex flex-wrap items-center gap-x-sm gap-y-2xs text-body-sm text-muted">
          <ApprovalStatusPill status={request.status} />
          <span>
            <span className="font-data tabular-nums text-text">{approved}</span>{" "}
            of{" "}
            <span className="font-data tabular-nums">
              {request.steps.length}
            </span>{" "}
            {request.steps.length === 1 ? "step" : "steps"} approved
          </span>
          <span aria-hidden="true">·</span>
          <span>
            started by {request.initiatedBy.name},{" "}
            <span className="font-data tabular-nums">
              {formatDateTime(request.initiatedAt)}
            </span>
          </span>
        </p>
      </div>

      <ol className="flex flex-col">
        {request.steps.map((step, index) => (
          <StepRow
            key={step.id}
            step={step}
            total={request.steps.length}
            last={index === request.steps.length - 1}
            stoppedAtOrder={stopped?.order ?? null}
            previousRole={
              index === 0 ? null : request.steps[index - 1].approverRole
            }
            action={
              current?.id === step.id && decisionAction ? decisionAction : null
            }
          />
        ))}
      </ol>
    </section>
  );
}

function StepRow({
  step,
  total,
  last,
  stoppedAtOrder,
  previousRole,
  action,
}: {
  step: ApprovalStep;
  total: number;
  last: boolean;
  stoppedAtOrder: number | null;
  previousRole: ApprovalStep["approverRole"] | null;
  action: ReactNode;
}) {
  const dot = TONE_DOT[APPROVAL_STEP_STATE_TONE[step.state]];
  const dim = step.state === "HALTED" || step.state === "NOT_REACHED";

  return (
    <li className="flex gap-md">
      {/* Marker column: dot plus the connector to the next step. The same
          device the reschedule timeline uses, for the same reason — it makes a
          sequence read as a sequence without numbering every row twice. */}
      <div className="flex w-1.5 shrink-0 flex-col items-center">
        <span
          aria-hidden="true"
          className={`mt-[10px] size-1.5 shrink-0 rounded-full ${dot}`}
        />
        {!last && (
          <span aria-hidden="true" className="w-px flex-1 bg-border" />
        )}
      </div>

      <div className={`min-w-0 flex-1 ${last ? "pb-0" : "pb-lg"}`}>
        <div className="flex flex-wrap items-baseline gap-x-sm gap-y-2xs">
          <span className="font-data text-caption tabular-nums uppercase tracking-[0.08em] text-muted">
            Step {step.order} of {total}
          </span>
          <h5
            className={`text-body font-semibold ${dim ? "text-muted" : "text-text"}`}
          >
            {USER_ROLE_LABELS[step.approverRole]}
          </h5>
          <ApprovalStepPill state={step.state} />
        </div>

        {step.note && (
          <p className="mt-2xs max-w-[62ch] text-body-sm text-muted">
            {step.note}
          </p>
        )}

        {step.decision ? (
          <div className="mt-sm">
            <p className="text-body-sm text-text">
              {step.decision.outcome === "APPROVED" ? "Approved" : "Rejected"}{" "}
              by {step.decision.decidedBy.name}
              <span className="text-muted">
                {" · "}
                <span className="font-data tabular-nums">
                  {formatDateTime(step.decision.decidedAt)}
                </span>
              </span>
            </p>
            {step.decision.comments ? (
              <blockquote className="mt-sm border-l-2 border-border pl-md">
                <p className="max-w-[62ch] whitespace-pre-line text-body-sm text-text">
                  {step.decision.comments}
                </p>
                <footer className="mt-2xs text-caption text-muted">
                  Internal record. Never sent to the candidate.
                </footer>
              </blockquote>
            ) : (
              <p className="mt-2xs text-body-sm text-muted">
                No comment left. Comments are optional on an approval, required
                on a rejection.
              </p>
            )}
          </div>
        ) : (
          <StepPending
            step={step}
            stoppedAtOrder={stoppedAtOrder}
            previousRole={previousRole}
          />
        )}

        {action && <div className="mt-md">{action}</div>}
      </div>
    </li>
  );
}

function StepPending({
  step,
  stoppedAtOrder,
  previousRole,
}: {
  step: ApprovalStep;
  stoppedAtOrder: number | null;
  previousRole: ApprovalStep["approverRole"] | null;
}) {
  if (step.state === "HALTED") {
    return (
      <p className="mt-2xs max-w-[62ch] text-body-sm text-muted">
        Never asked — the chain ended at step{" "}
        <span className="font-data tabular-nums">{stoppedAtOrder}</span>. A
        rejection is final for this request; nobody after it is consulted.
      </p>
    );
  }

  if (step.state === "NOT_REACHED") {
    return (
      <p className="mt-2xs max-w-[62ch] text-body-sm text-muted">
        {previousRole
          ? `Asked once ${USER_ROLE_LABELS[previousRole].toLowerCase()} approves.`
          : "Asked once the chain starts."}
      </p>
    );
  }

  return null;
}
