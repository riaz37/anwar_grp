import "server-only";
import { Resend } from "resend";
import type { AgentFlagType } from "@prisma/client";

const FLAG_TYPE_LABELS: Record<AgentFlagType, string> = {
  STUCK_MILESTONE: "Stuck milestone",
  STUCK_BLOCKER: "Stuck blocker",
  HIGH_RISK: "High-severity risk",
  OWNERSHIP_GAP: "Ownership gap",
};

/**
 * A single recipient of a flag alert, with `relation` explaining — in
 * that person's own terms — why *they* are getting this email (e.g. "You
 * own this milestone" vs. "You lead the team behind this project"). Set
 * per recipient by the caller in app/api/internal/agent-monitor/route.ts,
 * which knows each person's relationship to the flagged item.
 */
export interface FlagAlertRecipient {
  email: string;
  name: string;
  relation: string;
}

export interface FlagAlertEmailInput {
  projectId: string;
  projectName: string;
  flagType: AgentFlagType;
  severity: number;
  narration: string;
  recipients: FlagAlertRecipient[];
}

function buildDashboardUrl(projectId: string): string {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/projects/${projectId}`;
}

function renderSubject(input: FlagAlertEmailInput): string {
  return `[PMO Agent] ${FLAG_TYPE_LABELS[input.flagType]} — ${input.projectName}`;
}

function renderBody(input: FlagAlertEmailInput, recipient: FlagAlertRecipient): string {
  const url = buildDashboardUrl(input.projectId);
  return `
    <p>Hi ${recipient.name},</p>
    <p>${recipient.relation}</p>
    <p><strong>Project:</strong> ${input.projectName}<br/>
    <strong>Type:</strong> ${FLAG_TYPE_LABELS[input.flagType]}<br/>
    <strong>Severity:</strong> ${input.severity}/3</p>
    <p>${input.narration}</p>
    <p><a href="${url}">Open project</a></p>
  `.trim();
}

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

const DEFAULT_FROM = "PMO Agent <alerts@resend.dev>";

/**
 * Sends `html` to each recipient individually (never a combined `to:`
 * list, so recipients can't see each other's addresses) via Resend.
 * Never throws — a missing RESEND_API_KEY or a per-recipient Resend
 * failure is logged and swallowed so one bad address can't block the
 * others, and callers (background jobs, agent tool calls) never fail
 * their own work over email deliverability. Returns how many sends
 * actually went out so callers that report back to a user/LLM can say so.
 */
async function sendEmailToEach(
  subject: string,
  recipients: Array<{ email: string; html: string }>,
): Promise<number> {
  if (recipients.length === 0) return 0;

  const client = getResendClient();
  if (!client) {
    console.warn("RESEND_API_KEY not configured — skipping email send.");
    return 0;
  }

  const from = process.env.ALERT_EMAIL_FROM ?? DEFAULT_FROM;

  const results = await Promise.all(
    recipients.map(async ({ email, html }) => {
      try {
        await client.emails.send({ from, to: [email], subject, html });
        return true;
      } catch (err) {
        console.error(`Failed to send email to ${email}`, err);
        return false;
      }
    }),
  );

  return results.filter(Boolean).length;
}

/**
 * Sends an immediate email alert for a newly-created AgentFlag — one send
 * per recipient, each personalized around that person's `relation` to the
 * flagged item (project owner, the specific milestone/blocker/risk owner,
 * their team lead, or Management) rather than one generic email blasted
 * to a static role list. Recipient targeting itself lives in
 * app/api/internal/agent-monitor/route.ts (collectCandidates), which is
 * the only place that knows who's actually accountable for what.
 */
export async function sendFlagAlertEmail(input: FlagAlertEmailInput): Promise<void> {
  await sendEmailToEach(
    renderSubject(input),
    input.recipients.map((recipient) => ({
      email: recipient.email,
      html: renderBody(input, recipient),
    })),
  );
}

export interface ProjectNotificationRecipient {
  email: string;
  name: string;
}

export interface ProjectNotificationInput {
  projectId: string;
  projectName: string;
  message: string;
  senderName: string;
  recipients: ProjectNotificationRecipient[];
}

function renderNotificationBody(
  input: ProjectNotificationInput,
  recipient: ProjectNotificationRecipient,
): string {
  const url = buildDashboardUrl(input.projectId);
  return `
    <p>Hi ${recipient.name},</p>
    <p>${input.senderName} sent an update about <strong>${input.projectName}</strong> via the PMO Agent:</p>
    <p>${input.message}</p>
    <p><a href="${url}">Open project</a></p>
  `.trim();
}

/**
 * Sends a user-composed update about a project to a set of recipients —
 * the PMO Agent chat's `notifyProjectStakeholders` tool (lib/agent-tools.ts)
 * is the only caller, so recipient targeting/authorization lives there.
 * Unlike sendFlagAlertEmail, `message` is free text from the requesting
 * user (relayed through the LLM), not a rule-generated narration.
 */
export async function sendProjectNotificationEmail(
  input: ProjectNotificationInput,
): Promise<number> {
  return sendEmailToEach(
    `[PMO Agent] Update on ${input.projectName}`,
    input.recipients.map((recipient) => ({
      email: recipient.email,
      html: renderNotificationBody(input, recipient),
    })),
  );
}
