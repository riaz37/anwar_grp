import "server-only";
import { randomUUID } from "crypto";

/**
 * STUB PROVIDER — swap point for a real transactional email integration
 * (BUILD_PLAN.md Sec 2.10: "Email: transactional email provider (SMTP
 * API), server-side rendered templates"). No email API key is
 * configured in this environment, so this simulates provider behavior
 * instead of making a real network call.
 *
 * To integrate a real provider: replace the body of `sendEmail` with an
 * SDK call (e.g. SES `SendEmailCommand`, SendGrid, Postmark) that takes
 * the same input shape and returns { success, providerMessageId } or
 * { success: false, error }. Nothing else in the communication pipeline
 * (lib/communication-worker.ts) needs to change — it only depends on
 * this function's return shape.
 */

export interface SendEmailInput {
  to: string;
  subject: string | null;
  body: string;
}

export interface ProviderSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

const SIMULATED_SUCCESS_RATE = 0.9;

/** Magic string a test/demo can put in a rendered body to deterministically
 * force a provider failure, instead of relying on the random 90% rate. */
export const SIMULATE_FAILURE_TOKEN = "SIMULATE_FAILURE";

export async function sendEmail(
  input: SendEmailInput,
): Promise<ProviderSendResult> {
  // Simulate network latency.
  await new Promise((resolve) => setTimeout(resolve, 50));

  if (input.body.includes(SIMULATE_FAILURE_TOKEN)) {
    return { success: false, error: "Simulated email provider failure (magic token)." };
  }

  if (Math.random() < SIMULATED_SUCCESS_RATE) {
    return { success: true, providerMessageId: `stub-email-${randomUUID()}` };
  }

  return { success: false, error: "Simulated transient email provider error." };
}
