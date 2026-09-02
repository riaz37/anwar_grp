"use client";

import { useState } from "react";
import {
  decideApprovalAction,
  initiateApprovalAction,
} from "@/app/(dashboard)/_approval-actions";
import { LiveRegion } from "@/components/ui/InlineBanner";
import {
  APPROVAL_REQUEST_STATUS_LABELS,
  awaitingStep,
  type ApplicationApproval,
} from "@/lib/types/approvals";
import {
  USER_ROLE_LABELS,
  type ApplicationSummary,
  type Communication,
  type InterviewEvaluationRound,
  type ScreeningAssessment,
} from "@/lib/types/domain";
import { ApprovalChainProgress } from "./ApprovalChainProgress";
import { ApprovalDecisionForm } from "./ApprovalDecisionForm";
import { DecisionSupport } from "./DecisionSupport";
import { PostDecisionPrompt } from "./PostDecisionPrompt";
import { StartApprovalPanel } from "./StartApprovalPanel";

/**
 * The Decision tab: the spec's "Decisions and Approvals" section as its own
 * view on one application.
 *
 * It is mostly composition. What a recruiter needs in order to decide already
 * existed after Phases 3 and 4 — it was just spread across the Screening and
 * Evaluations tabs — so `DecisionSupport` gathers it without re-deriving any of
 * it. What is new is the chain: who has to sign off, where it is stuck, what
 * they said, and the action for the person it is stuck on.
 *
 * The order is the order the work happens in: read the record, then sign off,
 * then act on the outcome. Nothing on this tab decides anything by itself —
 * the PDF's "the system may summarize information but must not make the final
 * hiring decision" is the same constraint Phase 4's summary panel was built
 * under, and it holds here too.
 */
export function DecisionSection({
  application,
  approval: initialApproval,
  rounds,
  screening,
  communications,
  viewerId,
  onOpenScreening,
  onOpenEvaluations,
  onOpenPipeline,
  onDraftMessage,
}: {
  application: ApplicationSummary;
  /** Null when the application's requisition could not be resolved. */
  approval: ApplicationApproval | null;
  rounds: readonly InterviewEvaluationRound[];
  screening: ScreeningAssessment | null;
  communications: readonly Communication[];
  /** Dev-only viewer override id — see `_mock-evaluations.ts`. Drops out with
   *  the mock data, when the approver comes from the session. */
  viewerId?: string;
  onOpenScreening: () => void;
  onOpenEvaluations: (interviewId: string) => void;
  onOpenPipeline: () => void;
  onDraftMessage: (event: "SELECTION" | "REJECTION") => void;
}) {
  const [approval, setApproval] = useState(initialApproval);
  const [announcement, setAnnouncement] = useState("");

  const target = {
    id: application.id,
    requisitionId: application.requisitionId,
  };

  async function start() {
    const result = await initiateApprovalAction(target, viewerId);
    setApproval(result.approval);
    const first = awaitingStep(result.approval.request);
    setAnnouncement(
      first
        ? `Approval chain started. Waiting on the ${USER_ROLE_LABELS[first.approverRole].toLowerCase()}.`
        : "Approval chain started.",
    );
  }

  async function decide(input: {
    stepId: string;
    outcome: "APPROVED" | "REJECTED";
    comments: string;
    version: number;
  }) {
    if (!approval?.request) return;
    const result = await decideApprovalAction(
      target,
      { requestId: approval.request.id, ...input },
      viewerId,
    );
    setApproval(result.approval);

    const next = result.approval.request;
    const waiting = awaitingStep(next);
    setAnnouncement(
      next
        ? waiting
          ? `Decision recorded. The approval is now waiting on the ${USER_ROLE_LABELS[waiting.approverRole].toLowerCase()}.`
          : `Decision recorded. The approval is now ${APPROVAL_REQUEST_STATUS_LABELS[next.status].toLowerCase()}.`
        : "Decision recorded.",
    );
  }

  const request = approval?.request ?? null;
  const current = awaitingStep(request);
  const canDecideNow =
    current !== null && approval?.viewerDecidableStepId === current.id;

  return (
    <div className="flex max-w-[var(--container-form)] flex-col gap-xl">
      {/* DESIGN.md > Accessibility: approval and status changes are announced,
          not only shown. Mounted at all times so the announcement lands when it
          arrives rather than when the region appears. */}
      <LiveRegion>
        {announcement && (
          <p className="rounded-sm border border-success-soft bg-success-soft px-md py-sm text-body-sm text-success-ink">
            {announcement}
          </p>
        )}
      </LiveRegion>

      <DecisionSupport
        rounds={rounds}
        screening={screening}
        onOpenScreening={onOpenScreening}
        onOpenEvaluations={onOpenEvaluations}
      />

      <div className="border-t border-border pt-xl">
        {approval === null ? (
          <p className="max-w-[62ch] text-body-sm text-muted">
            This application&rsquo;s requisition could not be read, so the
            approval chain for it cannot be resolved. Open the requisition from
            the Pipeline tab to check it still exists.
          </p>
        ) : request === null ? (
          <StartApprovalPanel
            routing={approval.routing}
            chain={approval.chain}
            stage={application.stage}
            canInitiate={approval.viewerCanInitiate}
            onStart={start}
          />
        ) : (
          <ApprovalChainProgress
            request={request}
            decisionAction={
              canDecideNow && current ? (
                <ApprovalDecisionForm
                  request={request}
                  step={current}
                  onDecide={decide}
                />
              ) : undefined
            }
          />
        )}
      </div>

      {request && (
        <PostDecisionPrompt
          status={request.status}
          stage={application.stage}
          communications={communications}
          onOpenPipeline={onOpenPipeline}
          onDraftMessage={onDraftMessage}
        />
      )}
    </div>
  );
}
