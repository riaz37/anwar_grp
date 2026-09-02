"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { InlineBanner, LiveRegion } from "@/components/ui/InlineBanner";
import { CommunicationStatusPill } from "@/components/ui/StatusPill";
import { MailIcon, RetryIcon, WhatsAppIcon } from "@/components/ui/icons";
import { ApiRequestError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import {
  COMMUNICATION_CHANNEL_LABELS,
  COMMUNICATION_EVENT_LABELS,
  COMMUNICATION_STATUS_MEANING,
  type Communication,
  type CommunicationStatus,
  type PersonRef,
} from "@/lib/types/domain";

/**
 * One drafted or sent message, with the action its current pipeline state
 * calls for (BUILD_PLAN.md Sec 2.8).
 *
 * The approval is the compliance-relevant moment — spec Sec 6: "Candidate-facing
 * messages must be approved by the recruiter before sending" — so it is a
 * two-step interaction, not a bare button: the recruiter has to acknowledge
 * they have read the message as the candidate will receive it. That
 * acknowledgement is inline rather than a modal, per DESIGN.md's calm register
 * and the same reasoning that made the conflict banner inline.
 *
 * `FAILED` is deliberately not a dead end. A failed send is work back on the
 * recruiter's desk, so the card explains what the provider said and offers a
 * retry, which is the difference between a status the recruiter can act on and
 * one they have to work around by opening WhatsApp.
 */

const CHANNEL_ICON = {
  EMAIL: MailIcon,
  WHATSAPP: WhatsAppIcon,
} as const;

/* ──────────────────────────────────────────────────────────────────────────
 * SWAP POINTS — approval and retry
 *
 * TODO(backend):
 *   POST /api/v1/communications/{id}/request-approval  { version }
 *       DRAFTED -> AWAITING_APPROVAL
 *   POST /api/v1/communications/{id}/approve           { version }
 *       AWAITING_APPROVAL -> APPROVED, and enqueues the BullMQ send job in the
 *       same transaction. The route must re-check the approver's role
 *       server-side; this button being visible is a UX convenience, never the
 *       security boundary (BUILD_PLAN.md Sec 2.5).
 *   POST /api/v1/communications/{id}/retry             { version }
 *       FAILED -> APPROVED, re-enqueues, increments `attemptCount`. Should be
 *       refused past the bounded retry limit with a distinct error code so
 *       this card can say "give up and call them" rather than "try again".
 *
 * `SENT`, `DELIVERED` and `FAILED` are never set from the client: `SENT` is the
 * worker's, the other two come from a provider webhook. That is the whole
 * reason the pipeline is asynchronous.
 *
 * The mock below advances one step and stops; it never fabricates a
 * `DELIVERED`, because pretending the client can know that would hide the one
 * genuinely asynchronous part of this feature.
 * ────────────────────────────────────────────────────────────────────────── */
async function transitionCommunication(input: {
  id: string;
  action: "request-approval" | "approve" | "retry";
  version: number;
}): Promise<{ status: CommunicationStatus; version: number }> {
  await new Promise((resolve) => setTimeout(resolve, 450));
  const status: CommunicationStatus =
    input.action === "request-approval" ? "AWAITING_APPROVAL" : "APPROVED";
  return { status, version: input.version + 1 };
}

type Status =
  | { phase: "idle" }
  | { phase: "confirming" }
  | { phase: "working" }
  | { phase: "error"; message: string };

export function CommunicationCard({
  communication,
  currentUser,
  onTransitioned,
}: {
  communication: Communication;
  currentUser: PersonRef;
  onTransitioned: (change: {
    id: string;
    status: CommunicationStatus;
    version: number;
    approvedBy?: PersonRef;
    attemptCount?: number;
  }) => void;
}) {
  const [status, setStatus] = useState<Status>({ phase: "idle" });
  const [acknowledged, setAcknowledged] = useState(false);
  const [bodyOpen, setBodyOpen] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);

  const ChannelIcon = CHANNEL_ICON[communication.channel];
  const working = status.phase === "working";

  /* Move focus into the confirmation when it appears: a keyboard user who
     pressed "Approve" must land on the thing they now have to answer, not stay
     on a button that has been replaced. */
  useEffect(() => {
    if (status.phase === "confirming") confirmRef.current?.focus();
  }, [status.phase]);

  async function run(action: "request-approval" | "approve" | "retry") {
    setStatus({ phase: "working" });
    try {
      const result = await transitionCommunication({
        id: communication.id,
        action,
        version: communication.version,
      });
      onTransitioned({
        id: communication.id,
        status: result.status,
        version: result.version,
        approvedBy: action === "approve" ? currentUser : undefined,
        attemptCount:
          action === "retry" ? communication.attemptCount + 1 : undefined,
      });
      setAcknowledged(false);
      setStatus({ phase: "idle" });
    } catch (error) {
      setStatus({
        phase: "error",
        message:
          error instanceof ApiRequestError || error instanceof Error
            ? error.message
            : "That didn’t go through. Try again.",
      });
    }
  }

  return (
    <article className="rounded-md border border-border bg-surface px-md py-md lg:px-lg">
      <header className="flex flex-wrap items-start justify-between gap-md">
        <div className="flex min-w-0 items-start gap-sm">
          <ChannelIcon className="mt-2xs shrink-0 text-muted" />
          <div className="min-w-0">
            <h4 className="text-body font-semibold text-text">
              {COMMUNICATION_EVENT_LABELS[communication.event]}
            </h4>
            <p className="mt-2xs text-body-sm text-muted">
              {COMMUNICATION_CHANNEL_LABELS[communication.channel]} to{" "}
              <span className="font-data tabular-nums text-text">
                {communication.recipient}
              </span>{" "}
              · {communication.templateName} v{communication.templateVersion}
            </p>
          </div>
        </div>
        <CommunicationStatusPill status={communication.status} />
      </header>

      <p className="mt-sm text-body-sm text-muted">
        {COMMUNICATION_STATUS_MEANING[communication.status]}
      </p>

      <dl className="mt-md grid grid-cols-1 gap-x-lg gap-y-xs sm:grid-cols-2">
        <Timestamp label="Drafted" who={communication.createdBy.name} at={communication.createdAt} />
        {communication.approvedAt && (
          <Timestamp
            label="Approved"
            who={communication.approvedBy?.name ?? "—"}
            at={communication.approvedAt}
          />
        )}
        {communication.sentAt && (
          <Timestamp label="Sent" at={communication.sentAt} />
        )}
        {communication.deliveredAt && (
          <Timestamp label="Delivered" at={communication.deliveredAt} />
        )}
      </dl>

      <div className="mt-md">
        <button
          type="button"
          aria-expanded={bodyOpen}
          onClick={() => setBodyOpen((open) => !open)}
          className="-ml-sm inline-flex min-h-11 items-center rounded-sm px-sm text-body-sm font-medium text-accent-ink"
        >
          {bodyOpen ? "Hide the message" : "Read the message"}
        </button>
        {bodyOpen && (
          <div className="mt-sm rounded-md border border-border bg-surface-sunken px-md py-md">
            {communication.subject && (
              <p className="mb-sm border-b border-border pb-sm text-body-sm font-semibold text-text">
                {communication.subject}
              </p>
            )}
            <p className="whitespace-pre-wrap text-body-sm leading-relaxed text-text">
              {communication.renderedBody}
            </p>
          </div>
        )}
      </div>

      <LiveRegion>
        {communication.status === "FAILED" && communication.failureReason && (
          <div className="mt-md">
            <InlineBanner
              tone="error"
              title={`Not delivered after ${communication.attemptCount} attempt${communication.attemptCount === 1 ? "" : "s"}`}
            >
              {communication.failureReason} Nothing reached the candidate — if
              retrying fails again, reach them another way and record what
              happened on the application.
            </InlineBanner>
          </div>
        )}
        {status.phase === "error" && (
          <div className="mt-md">
            <InlineBanner
              tone="error"
              title="That action didn’t go through"
              onDismiss={() => setStatus({ phase: "idle" })}
            >
              {status.message}
            </InlineBanner>
          </div>
        )}
      </LiveRegion>

      {status.phase === "confirming" ? (
        <div
          ref={confirmRef}
          tabIndex={-1}
          role="group"
          aria-label="Confirm approval"
          className="mt-md rounded-md border border-warning-soft bg-warning-soft px-md py-md motion-safe:animate-[fade-in_200ms_var(--ease-enter)]"
        >
          <p className="text-body-sm font-semibold text-warning-ink">
            Approve this message for sending?
          </p>
          <p className="mt-2xs max-w-[62ch] text-body-sm text-warning-ink">
            Approving queues it immediately. It goes to{" "}
            <span className="font-data tabular-nums">
              {communication.recipient}
            </span>{" "}
            over {COMMUNICATION_CHANNEL_LABELS[communication.channel]}, and it
            cannot be recalled once the provider has it.
          </p>
          <label className="mt-md flex min-h-11 items-start gap-sm text-body-sm text-warning-ink">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              className="mt-[5px] size-4 shrink-0 accent-[var(--warning)]"
            />
            I have read the message above as the candidate will receive it.
          </label>
          <div className="mt-md flex flex-wrap items-center gap-sm">
            <Button
              variant="primary"
              disabled={!acknowledged || working}
              aria-busy={working}
              onClick={() => void run("approve")}
            >
              {working ? "Approving…" : "Approve and queue for sending"}
            </Button>
            <Button
              variant="ghost"
              disabled={working}
              onClick={() => {
                setAcknowledged(false);
                setStatus({ phase: "idle" });
              }}
            >
              Not yet
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-md flex flex-wrap items-center gap-sm">
          {communication.status === "DRAFTED" && (
            <Button
              variant="secondary"
              disabled={working}
              aria-busy={working}
              onClick={() => void run("request-approval")}
            >
              {working ? "Submitting…" : "Send for approval"}
            </Button>
          )}
          {communication.status === "AWAITING_APPROVAL" && (
            <Button
              variant="primary"
              onClick={() => setStatus({ phase: "confirming" })}
            >
              Approve…
            </Button>
          )}
          {communication.status === "FAILED" && (
            <Button
              variant="secondary"
              disabled={working}
              aria-busy={working}
              onClick={() => void run("retry")}
            >
              <RetryIcon />
              {working ? "Re-queueing…" : "Retry send"}
            </Button>
          )}
          {communication.attemptCount > 0 && (
            <span className="font-data text-caption tabular-nums text-muted">
              {communication.attemptCount} send attempt
              {communication.attemptCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
      )}
    </article>
  );
}

function Timestamp({
  label,
  who,
  at,
}: {
  label: string;
  who?: string;
  at: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-sm">
      <dt className="text-caption font-medium uppercase tracking-[0.06em] text-muted">
        {label}
      </dt>
      <dd className="text-body-sm text-text">
        <span className="font-data tabular-nums">{formatDateTime(at)}</span>
        {who && <span className="text-muted"> · {who}</span>}
      </dd>
    </div>
  );
}
