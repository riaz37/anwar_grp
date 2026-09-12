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

/**
 * Sends an immediate email alert for a newly-created AgentFlag — one send
 * per recipient, each personalized around that person's `relation` to the
 * flagged item (project owner, the specific milestone/blocker/risk owner,
 * their team lead, or Management) rather than one generic email blasted
 * to a static role list. Recipient targeting itself lives in
 * app/api/internal/agent-monitor/route.ts (collectCandidates), which is
 * the only place that knows who's actually accountable for what.
 *
 * Never throws — a missing RESEND_API_KEY or a per-recipient Resend
 * failure is logged and swallowed so the monitoring loop's rule-based
 * flag writes (the governance-critical part) never depend on email
 * deliverability, and one bad recipient address can't block the others.
 */
export async function sendFlagAlertEmail(input: FlagAlertEmailInput): Promise<void> {
  if (input.recipients.length === 0) return;

  const client = getResendClient();
  if (!client) {
    console.warn("RESEND_API_KEY not configured — skipping flag alert email.");
    return;
  }

  const from = process.env.ALERT_EMAIL_FROM ?? "PMO Agent <alerts@resend.dev>";
  const subject = renderSubject(input);

  await Promise.all(
    input.recipients.map(async (recipient) => {
      try {
        await client.emails.send({
          from,
          to: [recipient.email],
          subject,
          html: renderBody(input, recipient),
        });
      } catch (err) {
        console.error(`Failed to send flag alert email to ${recipient.email}`, err);
      }
    }),
  );
}
