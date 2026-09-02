"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { LiveRegion } from "@/components/ui/InlineBanner";
import { PlusIcon } from "@/components/ui/icons";
import type { MessageContextInput } from "@/lib/communications/build-context";
import {
  COMMUNICATION_STATUS_LABELS,
  type Communication,
  type CommunicationStatus,
  type InterviewRound,
  type MessageTemplate,
  type PersonRef,
} from "@/lib/types/domain";
import { CommunicationCard } from "./CommunicationCard";
import { DraftMessageForm } from "./DraftMessageForm";
import { FieldAvailabilityNote } from "./FieldAvailabilityNote";

/**
 * Every candidate message on one application: the drafting entry point, the
 * approval queue and the history, in that order.
 *
 * Newest first here, unlike the interview list — a communications log is read
 * as "what happened most recently", and the item needing action is almost
 * always the newest one.
 */
export function CommunicationsSection({
  applicationId,
  communications: messages,
  onChange,
  templates,
  interviews,
  context,
  currentUser,
}: {
  applicationId: string;
  communications: Communication[];
  /** Lifted to the application panel so the tab count stays in step. */
  onChange: (communications: Communication[]) => void;
  templates: readonly MessageTemplate[];
  interviews: readonly InterviewRound[];
  context: Omit<
    MessageContextInput,
    "interview" | "documentRequestList" | "joiningDate"
  >;
  currentUser: PersonRef;
}) {
  const [drafting, setDrafting] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const awaitingApproval = messages.filter(
    (message) => message.status === "AWAITING_APPROVAL",
  ).length;
  const failed = messages.filter(
    (message) => message.status === "FAILED",
  ).length;

  function handleTransitioned(change: {
    id: string;
    status: CommunicationStatus;
    version: number;
    approvedBy?: PersonRef;
    attemptCount?: number;
  }) {
    const now = new Date().toISOString();
    onChange(
      messages.map((message) =>
        message.id === change.id
          ? {
              ...message,
              status: change.status,
              version: change.version,
              approvedBy: change.approvedBy ?? message.approvedBy,
              approvedAt: change.approvedBy ? now : message.approvedAt,
              attemptCount: change.attemptCount ?? message.attemptCount,
              failureReason:
                change.status === "FAILED" ? message.failureReason : null,
            }
          : message,
      ),
    );
    setAnnouncement(
      `Message status is now ${COMMUNICATION_STATUS_LABELS[change.status]}.`,
    );
  }

  if (drafting) {
    return (
      <DraftMessageForm
        applicationId={applicationId}
        templates={templates}
        interviews={interviews}
        context={context}
        currentUser={currentUser}
        onCancel={() => setDrafting(false)}
        onDrafted={(communication) => {
          onChange([communication, ...messages]);
          setDrafting(false);
          setAnnouncement(
            `Message drafted. Status is ${COMMUNICATION_STATUS_LABELS[communication.status]}.`,
          );
        }}
      />
    );
  }

  return (
    <div className="flex max-w-[var(--container-form)] flex-col gap-lg">
      {/* DESIGN.md > Motion names "message-status badge updates" as one of the
          transitions worth having; the announcement is its accessible half. */}
      <LiveRegion>
        {announcement && (
          <p className="rounded-sm border border-success-soft bg-success-soft px-md py-sm text-body-sm text-success-ink">
            {announcement}
          </p>
        )}
      </LiveRegion>

      <div className="flex flex-wrap items-center justify-between gap-md">
        <div>
          <p className="text-body-sm text-muted">
            {messages.length === 0
              ? "No messages on this application yet."
              : `${messages.length} message${messages.length === 1 ? "" : "s"}`}
            {awaitingApproval > 0 && (
              <>
                {" · "}
                <span className="text-warning-ink">
                  {awaitingApproval} awaiting your approval
                </span>
              </>
            )}
            {failed > 0 && (
              <>
                {" · "}
                <span className="text-error-ink">
                  {failed} failed to send
                </span>
              </>
            )}
          </p>
        </div>
        <Button variant="primary" onClick={() => setDrafting(true)}>
          <PlusIcon />
          Draft a message
        </Button>
      </div>

      {messages.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-surface px-lg py-xl">
          <h4 className="text-subhead text-text">Nothing sent yet</h4>
          <p className="mt-sm max-w-[58ch] text-body-sm text-muted">
            Every message to this candidate is drafted from an approved
            template, approved by a recruiter, and then tracked from sent
            through to delivered — so there is one place that answers “what have
            we actually told them?”
          </p>
        </div>
      ) : (
        <ol className="flex flex-col gap-md">
          {messages.map((message) => (
            <li key={message.id}>
              <CommunicationCard
                communication={message}
                currentUser={currentUser}
                onTransitioned={handleTransitioned}
              />
            </li>
          ))}
        </ol>
      )}

      <FieldAvailabilityNote />
    </div>
  );
}
