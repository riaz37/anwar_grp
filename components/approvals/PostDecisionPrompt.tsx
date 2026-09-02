"use client";

import { Button } from "@/components/ui/Button";
import { CommunicationStatusPill } from "@/components/ui/StatusPill";
import { outcomeFollowUp, type ApprovalRequestStatus } from "@/lib/types/approvals";
import {
  COMMUNICATION_EVENT_LABELS,
  STAGE_LABELS,
  type ApplicationStage,
  type Communication,
} from "@/lib/types/domain";

/**
 * What happens after the chain ends: move the application, then tell the
 * candidate.
 *
 * Two deliberate properties.
 *
 * 1. It prompts; it does not act. A finished approval chain does not move the
 *    application and does not send anything — spec Sec 4 excludes automatic
 *    decisions, automatic rejection and unapproved automatic messaging, and all
 *    three would be one `useEffect` away here. The recruiter moves the stage on
 *    the Pipeline tab and drafts the message from the Messages tab, both
 *    unchanged from Phases 2 and 3.
 *
 * 2. It carries no reason. The entry point into the drafting flow passes the
 *    message *event* and nothing else — never the rejecting approver's
 *    comments, never an evaluation's concerns. The PDF is explicit ("Internal
 *    notes and rejection reasons must never appear automatically in candidate
 *    messages") and BUILD_PLAN.md Sec 2.8 makes it structural: the field
 *    allowlist has no `rejection_reason`, so there is no field a reason could
 *    even be interpolated into. This component is the one place in the product
 *    where an internal reason and a candidate-facing message are on screen
 *    together, so it is the one place that guarantee could plausibly have been
 *    broken by convenience. It is not.
 */
export function PostDecisionPrompt({
  status,
  stage,
  communications,
  onOpenPipeline,
  onDraftMessage,
}: {
  status: ApprovalRequestStatus;
  stage: ApplicationStage;
  communications: readonly Communication[];
  onOpenPipeline: () => void;
  /** Opens the Messages tab's existing draft form, pre-filtered to `event`. */
  onDraftMessage: (event: "SELECTION" | "REJECTION") => void;
}) {
  const followUp = outcomeFollowUp(status);
  if (!followUp) return null;

  const stageReached = stage === followUp.stage;
  const existing = communications.find(
    (message) => message.event === followUp.event,
  );
  const approved = status === "APPROVED";

  return (
    <section
      aria-labelledby="approval-followup-heading"
      className={`rounded-md border px-md py-md lg:px-lg lg:py-lg ${
        approved
          ? "border-success-soft bg-success-soft"
          : "border-border bg-surface-sunken"
      }`}
    >
      <h4
        id="approval-followup-heading"
        className={`text-subhead ${approved ? "text-success-ink" : "text-text"}`}
      >
        {approved
          ? "Approved — two things left"
          : "Rejected — two things left"}
      </h4>

      <ol className="mt-md flex flex-col gap-lg">
        <li>
          <p className="text-body-sm font-semibold text-text">
            1. Move the application to {STAGE_LABELS[followUp.stage]}
          </p>
          <p className="mt-2xs max-w-[62ch] text-body-sm text-muted">
            {stageReached
              ? `Done — this application is already at ${STAGE_LABELS[followUp.stage]}.`
              : `The chain has finished, but the application still reads ${STAGE_LABELS[stage]}. The stage is what every dashboard and report counts, so it does not follow automatically.`}
          </p>
          {!stageReached && (
            <div className="mt-sm">
              <Button variant="secondary" onClick={onOpenPipeline}>
                Open the Pipeline tab
              </Button>
            </div>
          )}
        </li>

        <li>
          <p className="text-body-sm font-semibold text-text">
            2. Tell the candidate
          </p>
          {existing ? (
            <p className="mt-sm flex flex-wrap items-center gap-sm text-body-sm text-muted">
              <CommunicationStatusPill status={existing.status} />
              <span>
                {COMMUNICATION_EVENT_LABELS[existing.event]} message already
                drafted on the Messages tab.
              </span>
            </p>
          ) : (
            <>
              <p className="mt-2xs max-w-[62ch] text-body-sm text-muted">
                Drafted from an approved{" "}
                {COMMUNICATION_EVENT_LABELS[followUp.event].toLowerCase()}{" "}
                template and approved by a recruiter before it sends, like every
                other candidate message. Nothing recorded on this tab — not the
                approvers&rsquo; comments, not the panel&rsquo;s concerns —
                goes into it.
              </p>
              <div className="mt-sm">
                <Button
                  variant={stageReached ? "primary" : "secondary"}
                  onClick={() => onDraftMessage(followUp.event)}
                >
                  Draft the{" "}
                  {COMMUNICATION_EVENT_LABELS[followUp.event].toLowerCase()}{" "}
                  message
                </Button>
              </div>
            </>
          )}
        </li>
      </ol>
    </section>
  );
}
