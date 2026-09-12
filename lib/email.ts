import "server-only";
import { Resend } from "resend";
import type { AgentFlagType } from "@prisma/client";

const FLAG_TYPE_LABELS: Record<AgentFlagType, string> = {
  STUCK_MILESTONE: "Stuck milestone",
  STUCK_BLOCKER: "Stuck blocker",
  HIGH_RISK: "High-severity risk",
  OWNERSHIP_GAP: "Ownership gap",
};

export interface FlagAlertEmailInput {
  projectId: string;
  projectName: string;
  flagType: AgentFlagType;
  severity: number;
  narration: string;
  recipients: Array<{ email: string; name: string }>;
}

function buildDashboardUrl(projectId: string): string {
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/projects/${projectId}`;
}

function renderSubject(input: FlagAlertEmailInput): string {
  return `[PMO Agent] ${FLAG_TYPE_LABELS[input.flagType]} — ${input.projectName}`;
}

function renderBody(input: FlagAlertEmailInput): string {
  const url = buildDashboardUrl(input.projectId);
  return `
    <p>The PMO monitoring agent flagged a new issue on <strong>${input.projectName}</strong>.</p>
    <p><strong>Type:</strong> ${FLAG_TYPE_LABELS[input.flagType]}<br/>
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
 * Sends an immediate email alert for a newly-created AgentFlag. This is a
 * deliberate reversal of PROJECT_PLAN.md item 7's original pull-only
 * notification decision, made explicitly by the user (see
 * AGENTIC_DASHBOARD_PLAN.md "Decision 4, updated"): the monitor now pushes
 * an email per new flag instead of only surfacing it in-app.
 *
 * Never throws — a missing RESEND_API_KEY or a Resend API failure is
 * logged and swallowed so the monitoring loop's rule-based flag writes
 * (the governance-critical part) never depend on email deliverability.
 */
export async function sendFlagAlertEmail(input: FlagAlertEmailInput): Promise<void> {
  if (input.recipients.length === 0) return;

  const client = getResendClient();
  if (!client) {
    console.warn("RESEND_API_KEY not configured — skipping flag alert email.");
    return;
  }

  const from = process.env.ALERT_EMAIL_FROM ?? "PMO Agent <alerts@resend.dev>";

  try {
    await client.emails.send({
      from,
      to: input.recipients.map((r) => r.email),
      subject: renderSubject(input),
      html: renderBody(input),
    });
  } catch (err) {
    console.error("Failed to send flag alert email", err);
  }
}
