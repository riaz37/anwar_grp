import "server-only";
import { randomUUID } from "crypto";
import { SIMULATE_FAILURE_TOKEN, type ProviderSendResult } from "./email-provider";

/**
 * STUB PROVIDER — swap point for the real WhatsApp Business API
 * integration (BUILD_PLAN.md Sec 2.10: "WhatsApp Business API —
 * business-initiated messages require Meta-approved templates, which is
 * why MessageTemplate is a first-class, pre-approved, versioned entity").
 * No Meta/WhatsApp Business API credentials are configured in this
 * environment, so this simulates provider behavior instead of making a
 * real network call.
 *
 * To integrate a real provider: replace the body of `sendWhatsapp` with
 * a call to the WhatsApp Business Cloud API (POST
 * /{phone-number-id}/messages, using the Meta-approved template name +
 * language + component params rather than a free-text body — the
 * `renderedBody` snapshot here still serves as the audit-trail copy of
 * what was sent). Return shape matches lib/providers/email-provider.ts
 * so lib/communication-worker.ts stays provider-agnostic.
 */

export interface SendWhatsappInput {
  to: string;
  body: string;
}

const SIMULATED_SUCCESS_RATE = 0.9;

export async function sendWhatsapp(
  input: SendWhatsappInput,
): Promise<ProviderSendResult> {
  // Simulate network latency.
  await new Promise((resolve) => setTimeout(resolve, 50));

  if (input.body.includes(SIMULATE_FAILURE_TOKEN)) {
    return { success: false, error: "Simulated WhatsApp provider failure (magic token)." };
  }

  if (Math.random() < SIMULATED_SUCCESS_RATE) {
    return { success: true, providerMessageId: `stub-whatsapp-${randomUUID()}` };
  }

  return { success: false, error: "Simulated transient WhatsApp provider error." };
}
