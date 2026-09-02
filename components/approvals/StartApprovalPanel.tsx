"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DetailItem, DetailList } from "@/components/ui/DetailList";
import { InlineBanner, LiveRegion } from "@/components/ui/InlineBanner";
import {
  type ApprovalChainConfig,
  type ApprovalRouting,
} from "@/lib/types/approvals";
import {
  POSITION_LEVEL_LABELS,
  STAGE_LABELS,
  USER_ROLE_LABELS,
  type ApplicationStage,
} from "@/lib/types/domain";

/**
 * The state before an approval request exists: either the chain that *would*
 * run, with the action that starts it, or the honest admission that no chain is
 * configured for this position.
 *
 * Starting is explicit rather than automatic on the move to the Approval stage.
 * A stage change is a coordination edit a recruiter makes several times a day;
 * having one of them silently create a record that pages three named managers
 * is a surprising side effect, and an accidental one is not withdrawable. The
 * two are still connected — the panel says so on screen when the application is
 * sitting in Approval without a chain started, and when a chain is started from
 * an earlier stage.
 *
 * The no-chain case is a first-class, expected state, not an error. Not every
 * business unit × department × position level combination has a convention
 * recorded, and the recruiter who hits it needs three things: to know it is not
 * their mistake, to see the three values that were looked up (so they can spot
 * a requisition with the wrong position level), and to know who fixes it.
 */

export function StartApprovalPanel({
  routing,
  chain,
  stage,
  canInitiate,
  onStart,
}: {
  routing: ApprovalRouting;
  /** Null when no configured chain matches the routing above. */
  chain: ApprovalChainConfig | null;
  stage: ApplicationStage;
  canInitiate: boolean;
  onStart: () => Promise<void>;
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setWorking(true);
    setError(null);
    try {
      await onStart();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The approval request wasn’t started. Try again.",
      );
      setWorking(false);
    }
  }

  return (
    <section
      aria-labelledby="approval-start-heading"
      className="flex flex-col gap-lg"
    >
      <div>
        <h4 id="approval-start-heading" className="text-subhead text-text">
          Approval chain
        </h4>
        <p className="mt-2xs max-w-[62ch] text-body-sm text-muted">
          Who signs off on this hire is set by the business unit, department and
          position level on the requisition — not by this application.
        </p>
      </div>

      <DetailList columns={3}>
        <DetailItem label="Business unit">{routing.businessUnit.name}</DetailItem>
        <DetailItem label="Department">{routing.department.name}</DetailItem>
        <DetailItem label="Position level">
          {POSITION_LEVEL_LABELS[routing.positionLevel]}
        </DetailItem>
      </DetailList>

      <LiveRegion>
        {error && (
          <InlineBanner
            tone="error"
            title="That approval request wasn’t started"
            onDismiss={() => setError(null)}
          >
            {error}
          </InlineBanner>
        )}
      </LiveRegion>

      {chain === null ? (
        <NoChainConfigured routing={routing} />
      ) : (
        <>
          <div>
            <h5 className="text-body font-semibold text-text">
              {chain.steps.length}{" "}
              {chain.steps.length === 1 ? "approver" : "approvers"}, in order
            </h5>
            <ol className="mt-sm flex flex-col divide-y divide-border border-y border-border">
              {chain.steps.map((step) => (
                <li
                  key={step.order}
                  className="flex flex-wrap items-baseline gap-x-md gap-y-2xs py-sm"
                >
                  <span className="font-data text-body-sm tabular-nums text-muted">
                    {step.order}
                  </span>
                  <span className="text-body-sm font-medium text-text">
                    {USER_ROLE_LABELS[step.approverRole]}
                  </span>
                  {step.note && (
                    <span className="text-body-sm text-muted">{step.note}</span>
                  )}
                </li>
              ))}
            </ol>
            {chain.department === null && (
              <p className="mt-sm max-w-[62ch] text-caption text-muted">
                Matched the {chain.businessUnit.name} default for this position
                level — {routing.department.name} has no chain of its own.
              </p>
            )}
          </div>

          {canInitiate ? (
            <div className="flex flex-wrap items-center gap-md border-t border-border pt-lg">
              <Button
                variant="primary"
                disabled={working}
                aria-busy={working}
                onClick={() => void start()}
              >
                {working ? "Starting…" : "Start the approval chain"}
              </Button>
              <p className="max-w-[46ch] text-body-sm text-muted">
                {stage === "APPROVAL"
                  ? "This application is already at the Approval stage. Starting the chain asks the first approver."
                  : `This application is at ${STAGE_LABELS[stage]}. Starting the chain now is allowed, but the stage is what the rest of the system reads — move it to Approval on the Pipeline tab as well.`}
              </p>
            </div>
          ) : (
            <p className="max-w-[62ch] border-t border-border pt-lg text-body-sm text-muted">
              The assigned recruiter starts the chain. You will see it here, and
              be asked to decide, when it reaches your step.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function NoChainConfigured({ routing }: { routing: ApprovalRouting }) {
  return (
    <InlineBanner
      tone="warning"
      title="No approval chain is configured for this position"
    >
      <p>
        Nothing has been recorded for{" "}
        <strong className="font-semibold">{routing.businessUnit.name}</strong> ·{" "}
        <strong className="font-semibold">{routing.department.name}</strong> ·{" "}
        <strong className="font-semibold">
          {POSITION_LEVEL_LABELS[routing.positionLevel]}
        </strong>
        , so there is no one to ask. This is a configuration gap, not a problem
        with this candidate.
      </p>
      <p className="mt-sm">
        Ask a TA administrator to add a chain for that combination — it is a
        settings change, not a release. If one of those three values looks
        wrong, the fix is on the requisition instead.
      </p>
      {/* TODO(frontend): link straight to the chain-config screen once
          /administration exists (spec Sec 7 names it; nothing is built there
          yet, and a link to a 404 is worse than a sentence). */}
    </InlineBanner>
  );
}
