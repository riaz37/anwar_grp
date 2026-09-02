import type { Communication, MessageTemplate } from "@/lib/types/domain";
import { personById } from "./_mock-reference";

/**
 * TEMPORARY mock data for the Communications section of the application view
 * (spec Sec 6 > Communication; BUILD_PLAN.md Sec 2.8).
 *
 * SWAP POINTS
 *   getMockTemplates()
 *     -> await fetchTemplates();
 *        // GET /api/v1/message-templates?event=&channel=
 *        // Templates are versioned, pre-approved objects, never composed at
 *        //  send time (BUILD_PLAN.md key assumption 3 — WhatsApp
 *        //  business-initiated messages require Meta-approved templates).
 *
 *   getMockCommunications(applicationId)
 *     -> await fetchCommunications(applicationId);
 *        // GET /api/v1/applications/{id}/communications
 *
 *   components/communications/DraftMessageForm.tsx  submitDraft()
 *     -> POST /api/v1/applications/{id}/communications
 *        { templateId, templateVersion, channel, recipient }
 *        The *server* renders the body from the template + the allowlisted
 *        context and returns `renderedBody`; the client preview is advisory
 *        only. Never post a client-rendered body — that would let a modified
 *        client bypass the field allowlist entirely.
 *
 *   components/communications/CommunicationCard.tsx  submitApproval()
 *     -> POST /api/v1/communications/{id}/approve  { version }
 *        Enqueues the BullMQ send job on success (BUILD_PLAN.md Sec 2.8).
 *
 *   components/communications/CommunicationCard.tsx  submitRetry()
 *     -> POST /api/v1/communications/{id}/retry  { version }
 *
 * `DELIVERED` and `FAILED` are never set by the client in any of these flows:
 * both arrive from a provider webhook, which is exactly why the pipeline is
 * asynchronous (BUILD_PLAN.md Sec 2.8).
 */

/* ── Template library ────────────────────────────────────────────────────── */

/**
 * One template per event from spec Sec 6's list, plus a WhatsApp variant for
 * the three events recruiters actually send over WhatsApp today (invitation,
 * reminder, joining reminder). WhatsApp bodies are deliberately shorter and
 * carry no subject — the channel has neither.
 *
 * Every `allowedFields` entry below is a member of the allowlist in
 * `lib/communications/field-allowlist.ts`. `application.internal_notes` and
 * `application.rejection_reason` appear in no template's list and in no
 * template's body — the rejection template says nothing about *why*, which is
 * the spec's requirement made structural rather than merely warned about.
 */
const TEMPLATES: readonly MessageTemplate[] = [
  {
    id: "tpl_interview_invitation_email",
    event: "INTERVIEW_INVITATION",
    channel: "EMAIL",
    name: "Interview invitation",
    version: 3,
    subject:
      "Interview for {{position.title}} — {{interview.date}} at {{interview.time}}",
    body: `Dear {{candidate.name}},

Thank you for your interest in the {{position.title}} role with {{position.business_unit}} at {{company.name}}.

We would like to invite you to round {{interview.round}} — {{interview.title}}.

  Date      {{interview.date}}
  Time      {{interview.time}} ({{interview.duration}})
  Format    {{interview.mode}}
  Where     {{interview.location}}
  Panel     {{interview.panel}}

{{interview.instructions}}

Please reply to this email to confirm you can attend.

Regards,
{{recruiter.name}}
Talent Acquisition, {{company.name}}
{{recruiter.email}}`,
    allowedFields: [
      "candidate.name",
      "position.title",
      "position.business_unit",
      "company.name",
      "interview.round",
      "interview.title",
      "interview.date",
      "interview.time",
      "interview.duration",
      "interview.mode",
      "interview.location",
      "interview.panel",
      "interview.instructions",
      "recruiter.name",
      "recruiter.email",
    ],
    providerApproval: "NOT_REQUIRED",
  },
  {
    id: "tpl_interview_invitation_wa",
    event: "INTERVIEW_INVITATION",
    channel: "WHATSAPP",
    name: "Interview invitation (short)",
    version: 2,
    subject: null,
    body: `Hello {{candidate.first_name}}, this is {{recruiter.name}} from {{company.name}}.

Your interview for {{position.title}} is on {{interview.date}} at {{interview.time}}.
Location: {{interview.location}}

Please reply YES to confirm.`,
    allowedFields: [
      "candidate.first_name",
      "recruiter.name",
      "company.name",
      "position.title",
      "interview.date",
      "interview.time",
      "interview.location",
    ],
    providerApproval: "APPROVED",
  },
  {
    id: "tpl_interview_reminder_wa",
    event: "INTERVIEW_REMINDER",
    channel: "WHATSAPP",
    name: "Interview reminder",
    version: 2,
    subject: null,
    body: `Reminder: your {{position.title}} interview at {{company.name}} is tomorrow, {{interview.date}}, at {{interview.time}}.

{{interview.location}}

Any problem, call {{recruiter.name}} on {{recruiter.mobile}}.`,
    allowedFields: [
      "position.title",
      "company.name",
      "interview.date",
      "interview.time",
      "interview.location",
      "recruiter.name",
      "recruiter.mobile",
    ],
    providerApproval: "APPROVED",
  },
  {
    id: "tpl_interview_reminder_email",
    event: "INTERVIEW_REMINDER",
    channel: "EMAIL",
    name: "Interview reminder",
    version: 2,
    subject: "Reminder — {{position.title}} interview on {{interview.date}}",
    body: `Dear {{candidate.name}},

A reminder of your interview for {{position.title}}:

  Date      {{interview.date}}
  Time      {{interview.time}} ({{interview.duration}})
  Where     {{interview.location}}

{{interview.instructions}}

Regards,
{{recruiter.name}}`,
    allowedFields: [
      "candidate.name",
      "position.title",
      "interview.date",
      "interview.time",
      "interview.duration",
      "interview.location",
      "interview.instructions",
      "recruiter.name",
    ],
    providerApproval: "NOT_REQUIRED",
  },
  {
    id: "tpl_rescheduling_email",
    event: "RESCHEDULING",
    channel: "EMAIL",
    name: "Interview rescheduled",
    version: 2,
    subject: "Your {{position.title}} interview has moved",
    body: `Dear {{candidate.name}},

Your interview for {{position.title}} has been rescheduled. The new details are:

  Date      {{interview.date}}
  Time      {{interview.time}} ({{interview.duration}})
  Format    {{interview.mode}}
  Where     {{interview.location}}

Apologies for the change, and thank you for your flexibility. Please reply to confirm the new time works for you.

Regards,
{{recruiter.name}}
{{recruiter.email}}`,
    allowedFields: [
      "candidate.name",
      "position.title",
      "interview.date",
      "interview.time",
      "interview.duration",
      "interview.mode",
      "interview.location",
      "recruiter.name",
      "recruiter.email",
    ],
    providerApproval: "NOT_REQUIRED",
  },
  {
    id: "tpl_document_request_email",
    event: "DOCUMENT_REQUEST",
    channel: "EMAIL",
    name: "Document request",
    version: 4,
    subject: "Documents needed for your {{position.title}} application",
    body: `Dear {{candidate.name}},

To continue with your application for {{position.title}}, please send us:

{{document.request_list}}

Scanned copies attached to a reply to this email are fine.

Regards,
{{recruiter.name}}
Talent Acquisition, {{company.name}}`,
    allowedFields: [
      "candidate.name",
      "position.title",
      "document.request_list",
      "recruiter.name",
      "company.name",
    ],
    providerApproval: "NOT_REQUIRED",
  },
  {
    id: "tpl_selection_email",
    event: "SELECTION",
    channel: "EMAIL",
    name: "Selection",
    version: 3,
    subject: "Outcome of your application for {{position.title}}",
    body: `Dear {{candidate.name}},

We are pleased to tell you that you have been selected for the {{position.title}} role in {{position.department}}, {{position.business_unit}}.

Your recruiter, {{recruiter.name}}, will contact you shortly with the next steps. Your target joining date is {{joining.date}}.

Congratulations, and welcome to {{company.name}}.

Regards,
{{recruiter.name}}
{{recruiter.email}}`,
    allowedFields: [
      "candidate.name",
      "position.title",
      "position.department",
      "position.business_unit",
      "recruiter.name",
      "recruiter.email",
      "joining.date",
      "company.name",
    ],
    providerApproval: "NOT_REQUIRED",
  },
  {
    id: "tpl_rejection_email",
    event: "REJECTION",
    channel: "EMAIL",
    name: "Rejection",
    version: 5,
    subject: "Your application for {{position.title}}",
    body: `Dear {{candidate.name}},

Thank you for the time you gave to your application for {{position.title}} at {{company.name}}.

On this occasion we will not be taking your application further. The decision was not an easy one, and it says nothing about the quality of your work.

We would be glad to consider you for future openings, and your profile stays on file for that purpose.

With best wishes,
{{recruiter.name}}
Talent Acquisition, {{company.name}}`,
    allowedFields: [
      "candidate.name",
      "position.title",
      "company.name",
      "recruiter.name",
    ],
    providerApproval: "NOT_REQUIRED",
  },
  {
    id: "tpl_joining_reminder_email",
    event: "JOINING_REMINDER",
    channel: "EMAIL",
    name: "Joining reminder",
    version: 2,
    subject: "Your first day at {{company.name}} — {{joining.date}}",
    body: `Dear {{candidate.name}},

We are looking forward to your first day as {{position.title}} on {{joining.date}}.

Please bring:

{{document.request_list}}

Report to reception and ask for {{recruiter.name}}.

Regards,
{{recruiter.name}}
Talent Acquisition, {{company.name}}`,
    allowedFields: [
      "candidate.name",
      "position.title",
      "joining.date",
      "document.request_list",
      "recruiter.name",
      "company.name",
    ],
    providerApproval: "NOT_REQUIRED",
  },
  {
    id: "tpl_joining_reminder_wa",
    event: "JOINING_REMINDER",
    channel: "WHATSAPP",
    name: "Joining reminder (short)",
    version: 1,
    subject: null,
    body: `Hello {{candidate.first_name}}, a reminder that you join {{company.name}} as {{position.title}} on {{joining.date}}.

Please bring: {{document.request_list}}

Ask for {{recruiter.name}} at reception.`,
    allowedFields: [
      "candidate.first_name",
      "company.name",
      "position.title",
      "joining.date",
      "document.request_list",
      "recruiter.name",
    ],
    // Deliberately PENDING: BUILD_PLAN.md Sec 3.3 names WhatsApp template
    // approval turnaround as a real technical risk, and the draft form has to
    // show what an unapproved template does to the send path.
    providerApproval: "PENDING",
  },
];

export function getMockTemplates(): readonly MessageTemplate[] {
  return TEMPLATES;
}

export function getMockTemplate(id: string): MessageTemplate | null {
  return TEMPLATES.find((template) => template.id === id) ?? null;
}

/* ── Seeded communications ───────────────────────────────────────────────── */

function timestampDaysAgo(offset: number, hour = 13, minute = 5): string {
  const date = new Date();
  date.setUTCHours(hour, minute, 0, 0);
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString();
}

interface CommunicationSeed
  extends Omit<
    Communication,
    "createdBy" | "createdAt" | "approvedBy" | "approvedAt" | "sentAt" | "deliveredAt"
  > {
  createdById: string;
  createdDaysAgo: number;
  approvedById?: string;
  approvedDaysAgo?: number;
  sentDaysAgo?: number;
  deliveredDaysAgo?: number;
}

/**
 * Five of the six pipeline states are seeded across two applications, so every
 * status pill, the approval affordance and the failed-send retry path are all
 * reachable without creating anything first.
 */
const COMMUNICATIONS: readonly CommunicationSeed[] = [
  {
    id: "cm_8814_1",
    applicationId: "app_8814",
    templateId: "tpl_interview_invitation_email",
    templateName: "Interview invitation",
    templateVersion: 3,
    event: "INTERVIEW_INVITATION",
    channel: "EMAIL",
    recipient: "farhana.rahman@example.com",
    subject: "Interview for Merchandiser — 20 Aug 2026 at 11:00",
    renderedBody:
      "Dear Farhana Rahman,\n\nThank you for your interest in the Merchandiser role with Anwar Textiles at Anwar Group of Industries.\n\nWe would like to invite you to round 1 — Functional round.\n\n  Date      20 Aug 2026\n  Time      11:00 (45 min)\n  Format    In person\n  Where     Head office, Gulshan-1 — Meeting room 4B\n  Panel     Kamrul Hasan, Tuhin Chowdhury\n\nPlease arrive 15 minutes early and bring a printed CV plus your NID.\n\nRegards,\nSadia Karim",
    status: "DELIVERED",
    failureReason: null,
    createdById: "usr_recruiter_1",
    createdDaysAgo: 22,
    approvedById: "usr_recruiter_1",
    approvedDaysAgo: 22,
    sentDaysAgo: 22,
    deliveredDaysAgo: 22,
    attemptCount: 1,
    version: 4,
  },
  {
    id: "cm_8814_2",
    applicationId: "app_8814",
    templateId: "tpl_interview_reminder_wa",
    templateName: "Interview reminder",
    templateVersion: 2,
    event: "INTERVIEW_REMINDER",
    channel: "WHATSAPP",
    recipient: "+8801711 204 553",
    subject: null,
    renderedBody:
      "Reminder: your Merchandiser interview at Anwar Group of Industries is tomorrow, 20 Aug 2026, at 11:00.\n\nHead office, Gulshan-1 — Meeting room 4B\n\nAny problem, call Sadia Karim on +8801711 000 100.",
    status: "FAILED",
    failureReason:
      "WhatsApp Business API rejected the send: the recipient has not opted in to business messages on this number (error 131047).",
    createdById: "usr_recruiter_1",
    createdDaysAgo: 23,
    approvedById: "usr_recruiter_1",
    approvedDaysAgo: 23,
    attemptCount: 3,
    version: 6,
  },
  {
    id: "cm_8814_3",
    applicationId: "app_8814",
    templateId: "tpl_rescheduling_email",
    templateName: "Interview rescheduled",
    templateVersion: 2,
    event: "RESCHEDULING",
    channel: "EMAIL",
    recipient: "farhana.rahman@example.com",
    subject: "Your Merchandiser interview has moved",
    renderedBody:
      "Dear Farhana Rahman,\n\nYour interview for Merchandiser has been rescheduled. The new details are:\n\n  Date      <new date>\n  Time      15:30 (1 h)\n  Format    Online\n  Where     https://meet.example.com/anwar-merch-r2\n\nApologies for the change, and thank you for your flexibility.\n\nRegards,\nSadia Karim\nsadia.karim@anwargroup.test",
    status: "AWAITING_APPROVAL",
    failureReason: null,
    createdById: "usr_recruiter_1",
    createdDaysAgo: 3,
    attemptCount: 0,
    version: 2,
  },
  {
    id: "cm_8845_1",
    applicationId: "app_8845",
    templateId: "tpl_interview_invitation_email",
    templateName: "Interview invitation",
    templateVersion: 3,
    event: "INTERVIEW_INVITATION",
    channel: "EMAIL",
    recipient: "rifat.chowdhury@example.com",
    subject: "Interview for Plant Operations Officer — tomorrow at 10:30",
    renderedBody:
      "Dear Rifat Chowdhury,\n\nWe would like to invite you to round 1 — Technical round.\n\n  Date      <interview date>\n  Time      10:30 (45 min)\n  Format    In person\n  Where     Anwar Cement, Plant Operations block — Interview room 2\n  Panel     Zahid Iqbal, Ashiqur Rahman\n\nTransport from the Dhaka office leaves at 08:00.\n\nRegards,\nSadia Karim",
    status: "SENT",
    failureReason: null,
    createdById: "usr_recruiter_1",
    createdDaysAgo: 3,
    approvedById: "usr_recruiter_1",
    approvedDaysAgo: 3,
    sentDaysAgo: 3,
    attemptCount: 1,
    version: 3,
  },
  {
    id: "cm_8845_2",
    applicationId: "app_8845",
    templateId: "tpl_document_request_email",
    templateName: "Document request",
    templateVersion: 4,
    event: "DOCUMENT_REQUEST",
    channel: "EMAIL",
    recipient: "rifat.chowdhury@example.com",
    subject: "Documents needed for your Plant Operations Officer application",
    renderedBody:
      "Dear Rifat Chowdhury,\n\nTo continue with your application for Plant Operations Officer, please send us:\n\nNID copy, academic certificates, last three months' salary certificate\n\nRegards,\nSadia Karim\nTalent Acquisition, Anwar Group of Industries",
    status: "DRAFTED",
    failureReason: null,
    createdById: "usr_recruiter_1",
    createdDaysAgo: 0,
    attemptCount: 0,
    version: 1,
  },
];

function hydrate(seed: CommunicationSeed): Communication {
  const {
    createdById,
    createdDaysAgo,
    approvedById,
    approvedDaysAgo,
    sentDaysAgo,
    deliveredDaysAgo,
    ...rest
  } = seed;

  return {
    ...rest,
    createdBy: personById(createdById),
    createdAt: timestampDaysAgo(createdDaysAgo),
    approvedBy: approvedById ? personById(approvedById) : null,
    approvedAt:
      approvedDaysAgo === undefined
        ? null
        : timestampDaysAgo(approvedDaysAgo, 13, 40),
    sentAt:
      sentDaysAgo === undefined ? null : timestampDaysAgo(sentDaysAgo, 13, 42),
    deliveredAt:
      deliveredDaysAgo === undefined
        ? null
        : timestampDaysAgo(deliveredDaysAgo, 13, 43),
  };
}

export function getMockCommunications(applicationId: string): Communication[] {
  return COMMUNICATIONS.filter(
    (seed) => seed.applicationId === applicationId,
  ).map(hydrate);
}
