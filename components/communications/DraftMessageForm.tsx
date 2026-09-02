"use client";

import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SelectField, TextAreaField, TextInputField } from "@/components/ui/Field";
import { InlineBanner, LiveRegion } from "@/components/ui/InlineBanner";
import { ApiRequestError } from "@/lib/api-client";
import {
  buildMessageContext,
  type MessageContextInput,
} from "@/lib/communications/build-context";
import { renderTemplate } from "@/lib/communications/field-allowlist";
import { formatDate, formatTime } from "@/lib/format";
import {
  COMMUNICATION_CHANNEL_LABELS,
  COMMUNICATION_EVENT_LABELS,
  COMMUNICATION_EVENTS,
  type Communication,
  type CommunicationChannel,
  type CommunicationEvent,
  type InterviewRound,
  type MessageTemplate,
  type PersonRef,
} from "@/lib/types/domain";
import { FieldAvailabilityNote } from "./FieldAvailabilityNote";
import { MessagePreview } from "./MessagePreview";

/**
 * Draft one candidate message from a pre-approved template
 * (BUILD_PLAN.md Sec 2.8).
 *
 * There is no free-text body field anywhere in this form, and that is the
 * design, not an omission: WhatsApp business-initiated messages only send
 * against a Meta-approved template (BUILD_PLAN.md key assumption 3), and the
 * field allowlist can only be guaranteed if the body is a template the
 * organisation vetted. The recruiter's inputs are the choices — which event,
 * which template, which interview round — plus the handful of free fields the
 * templates explicitly interpolate.
 */

const EVENTS_NEEDING_INTERVIEW: ReadonlySet<CommunicationEvent> = new Set([
  "INTERVIEW_INVITATION",
  "INTERVIEW_REMINDER",
  "RESCHEDULING",
]);

const EVENTS_NEEDING_DOCUMENTS: ReadonlySet<CommunicationEvent> = new Set([
  "DOCUMENT_REQUEST",
  "JOINING_REMINDER",
]);

/* ──────────────────────────────────────────────────────────────────────────
 * SWAP POINT — draft write
 *
 * TODO(backend): POST /api/v1/applications/{applicationId}/communications
 *   { templateId, templateVersion, channel, recipient, interviewId,
 *     documentRequestList, submitForApproval }  ->  Communication
 *
 * The server renders the body. This form's preview is advisory: it exists so
 * the recruiter approves something they have actually read, but posting a
 * client-rendered body would let a modified client walk straight through the
 * field allowlist, which is the one thing the allowlist is for.
 *
 * `submitForApproval` decides whether the new row lands on `DRAFTED` or
 * `AWAITING_APPROVAL` — both are legal starting states in Sec 2.8's pipeline,
 * and a recruiter part-way through a batch wants the former.
 * ────────────────────────────────────────────────────────────────────────── */
async function submitDraft(input: {
  applicationId: string;
  templateId: string;
  channel: CommunicationChannel;
  recipient: string;
  interviewId: string | null;
  documentRequestList: string;
  submitForApproval: boolean;
}): Promise<{ id: string; version: number }> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return { id: `cm_local_${input.applicationId}_${Date.now()}`, version: 1 };
}

type Status =
  | { phase: "idle" }
  | { phase: "submitting"; forApproval: boolean }
  | { phase: "error"; message: string };

export function DraftMessageForm({
  applicationId,
  templates,
  interviews,
  context,
  currentUser,
  onDrafted,
  onCancel,
}: {
  applicationId: string;
  templates: readonly MessageTemplate[];
  interviews: readonly InterviewRound[];
  /** Everything the renderer needs except the chosen interview + free fields. */
  context: Omit<
    MessageContextInput,
    "interview" | "documentRequestList" | "joiningDate"
  >;
  currentUser: PersonRef;
  onDrafted: (communication: Communication) => void;
  onCancel: () => void;
}) {
  const prefix = useId();

  const [event, setEvent] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");
  const [interviewId, setInterviewId] = useState<string>(
    interviews.at(-1)?.id ?? "",
  );
  const [documentRequestList, setDocumentRequestList] = useState("");
  const [recipientOverride, setRecipientOverride] = useState<string | null>(
    null,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>({ phase: "idle" });

  const submitting = status.phase === "submitting";
  const submittingForApproval =
    status.phase === "submitting" && status.forApproval;

  const eventTemplates = templates.filter(
    (template) => template.event === event,
  );
  const template = templates.find((entry) => entry.id === templateId) ?? null;
  const interview =
    interviews.find((round) => round.id === interviewId) ?? null;

  const defaultRecipient =
    template?.channel === "WHATSAPP"
      ? context.candidate.mobile
      : context.candidate.email;
  const recipient = recipientOverride ?? defaultRecipient;

  const values = useMemo(
    () =>
      buildMessageContext({
        ...context,
        interview:
          template && EVENTS_NEEDING_INTERVIEW.has(template.event)
            ? interview
            : null,
        documentRequestList,
      }),
    [context, template, interview, documentRequestList],
  );

  const bodyRender = useMemo(
    () => (template ? renderTemplate(template.body, values) : null),
    [template, values],
  );
  const subjectRender = useMemo(
    () =>
      template?.subject ? renderTemplate(template.subject, values) : null,
    [template, values],
  );

  const needsInterview =
    template !== null && EVENTS_NEEDING_INTERVIEW.has(template.event);
  const needsDocuments =
    template !== null && EVENTS_NEEDING_DOCUMENTS.has(template.event);
  const whatsappPending =
    template?.channel === "WHATSAPP" && template.providerApproval === "PENDING";

  function handleEventChange(next: string) {
    setEvent(next);
    const first = templates.find((entry) => entry.event === next);
    setTemplateId(first?.id ?? "");
    setRecipientOverride(null);
    setErrors({});
  }

  async function handleSubmit(forApproval: boolean) {
    const found: Record<string, string> = {};
    if (!template) found.template = "Choose the message to send.";
    if (!recipient.trim()) {
      found.recipient = "There is no address to send this to.";
    }
    if (needsInterview && !interview) {
      found.interview = "Choose which interview round this message is about.";
    }
    if (needsDocuments && !documentRequestList.trim()) {
      found.documents = "List the documents the candidate should send.";
    }
    setErrors(found);
    if (Object.keys(found).length > 0 || !template || !bodyRender) return;

    setStatus({ phase: "submitting", forApproval });
    try {
      const result = await submitDraft({
        applicationId,
        templateId: template.id,
        channel: template.channel,
        recipient: recipient.trim(),
        interviewId: needsInterview ? (interview?.id ?? null) : null,
        documentRequestList,
        submitForApproval: forApproval,
      });

      onDrafted({
        id: result.id,
        applicationId,
        templateId: template.id,
        templateName: template.name,
        templateVersion: template.version,
        event: template.event,
        channel: template.channel,
        recipient: recipient.trim(),
        subject: subjectRender ? subjectRender.text : null,
        renderedBody: bodyRender.text,
        status: forApproval ? "AWAITING_APPROVAL" : "DRAFTED",
        failureReason: null,
        createdBy: currentUser,
        createdAt: new Date().toISOString(),
        approvedBy: null,
        approvedAt: null,
        sentAt: null,
        deliveredAt: null,
        attemptCount: 0,
        version: result.version,
      });
    } catch (error) {
      setStatus({
        phase: "error",
        message:
          error instanceof ApiRequestError || error instanceof Error
            ? error.message
            : "That draft wasn’t saved. Try again.",
      });
    }
  }

  return (
    <div className="flex max-w-[var(--container-form)] flex-col gap-lg rounded-md border border-border bg-surface px-md py-lg lg:px-lg">
      <div>
        <h4 className="text-subhead text-text">Draft a message</h4>
        <p className="mt-2xs max-w-[58ch] text-body-sm text-muted">
          Messages are built from approved templates, not written from scratch —
          it keeps every candidate hearing the same thing, and WhatsApp will
          only deliver templates its provider has approved.
        </p>
      </div>

      <LiveRegion>
        {status.phase === "error" && (
          <InlineBanner
            tone="error"
            title="That draft wasn’t saved"
            onDismiss={() => setStatus({ phase: "idle" })}
          >
            {status.message}
          </InlineBanner>
        )}
      </LiveRegion>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <SelectField
          id={`${prefix}-event`}
          label="What is this message about?"
          required
          disabled={submitting}
          value={event}
          onChange={handleEventChange}
          error={errors.template && !event ? errors.template : undefined}
          placeholder="Choose…"
          options={COMMUNICATION_EVENTS.map((value) => ({
            value,
            label: COMMUNICATION_EVENT_LABELS[value],
          }))}
        />

        <SelectField
          id={`${prefix}-template`}
          label="Template and channel"
          required
          disabled={submitting || eventTemplates.length === 0}
          value={templateId}
          onChange={(next) => {
            setTemplateId(next);
            setRecipientOverride(null);
          }}
          error={event ? errors.template : undefined}
          placeholder={
            eventTemplates.length === 0
              ? "Pick a message purpose first"
              : "Choose a template…"
          }
          options={eventTemplates.map((entry) => ({
            value: entry.id,
            label: `${entry.name} · ${COMMUNICATION_CHANNEL_LABELS[entry.channel]} · v${entry.version}`,
          }))}
        />

        {needsInterview && (
          <SelectField
            id={`${prefix}-interview`}
            label="Which interview round?"
            required
            disabled={submitting || interviews.length === 0}
            value={interviewId}
            onChange={setInterviewId}
            error={errors.interview}
            placeholder={
              interviews.length === 0
                ? "No rounds scheduled yet"
                : "Choose a round…"
            }
            options={interviews.map((round) => ({
              value: round.id,
              label: `Round ${round.roundNumber} — ${round.title}, ${formatDate(round.scheduledDate)} ${formatTime(round.scheduledTime)}`,
            }))}
            hint={
              interviews.length === 0
                ? "Schedule the round on the Interviews tab first — the message reads its date, time and location from it."
                : undefined
            }
          />
        )}

        {template && (
          <TextInputField
            id={`${prefix}-recipient`}
            label={template.channel === "WHATSAPP" ? "WhatsApp number" : "Email address"}
            required
            disabled={submitting}
            type={template.channel === "WHATSAPP" ? "tel" : "email"}
            value={recipient}
            onChange={setRecipientOverride}
            error={errors.recipient}
            hint="Taken from the candidate profile. Change it only for this one message."
          />
        )}
      </div>

      {needsDocuments && (
        <TextAreaField
          id={`${prefix}-documents`}
          label="Documents to ask for"
          required
          rows={3}
          disabled={submitting}
          value={documentRequestList}
          onChange={setDocumentRequestList}
          error={errors.documents}
          hint="One per line, or comma-separated. This is the only free text in the message."
        />
      )}

      {whatsappPending && (
        <InlineBanner
          tone="warning"
          title="This WhatsApp template is still awaiting provider approval"
        >
          You can draft and approve it now, but the send will fail until Meta
          approves the template. Use the email version if the candidate needs
          this today.
        </InlineBanner>
      )}

      {template && bodyRender ? (
        <MessagePreview
          subject={subjectRender}
          render={bodyRender}
          channel={COMMUNICATION_CHANNEL_LABELS[template.channel]}
          recipient={recipient}
        />
      ) : (
        <p className="rounded-md border border-dashed border-border bg-surface-sunken px-md py-lg text-body-sm text-muted">
          Choose a template to see exactly what the candidate will receive.
        </p>
      )}

      <FieldAvailabilityNote />

      <div className="flex flex-wrap items-center gap-md border-t border-border pt-lg">
        <Button
          variant="primary"
          disabled={submitting}
          aria-busy={submittingForApproval}
          onClick={() => void handleSubmit(true)}
        >
          {submittingForApproval ? "Saving…" : "Save and send for approval"}
        </Button>
        <Button
          variant="secondary"
          disabled={submitting}
          onClick={() => void handleSubmit(false)}
        >
          Save as draft
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
