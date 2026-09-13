import "server-only";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, type LanguageModel } from "ai";

/**
 * AGENTIC_DASHBOARD_PLAN.md "DECIDED — Tech stack": self-hosted vLLM at
 * https://llm.arahim.dev, OpenAI-compatible, no auth required. Model id is
 * "qwen3.6-35b-a3b" — lowercase, exact, confirmed via a live curl against
 * the real endpoint (the "Qwen3.6-35B-A3B-FP8" casing from an earlier draft
 * 404s). `apiKey` is a non-empty placeholder only — the SDK requires a
 * non-empty string even though the endpoint never checks it.
 */
export const LLM_MODEL_ID = "qwen3.6-35b-a3b";

const llmProvider = createOpenAI({
  baseURL: process.env.LLM_BASE_URL ?? "https://llm.arahim.dev/v1",
  apiKey: process.env.LLM_API_KEY ?? "unused-placeholder-key",
});

// `.chat(...)` is required here, not the bare `llmProvider(...)` call —
// @ai-sdk/openai v2 defaults the bare call to OpenAI's newer Responses
// API (POST /v1/responses). Confirmed via test/eval: this self-hosted
// vLLM endpoint only implements the classic Chat Completions API
// (/v1/chat/completions); its Responses-API shim 500s with a bare
// `'role'` KeyError as soon as a tool result is sent back in a
// follow-up turn (i.e. every multi-step tool-calling conversation).
export const llmModel = llmProvider.chat(LLM_MODEL_ID);

/**
 * Fallback provider used when the self-hosted vLLM endpoint (llmModel) is
 * unreachable or errors. GEMINI_API_KEY is required for this path — when
 * absent, generateFlagNarration skips straight to RULE_FALLBACK instead of
 * throwing. Narration produced this way is still reported as source "LLM"
 * (not a separate value) since callers only distinguish LLM-generated text
 * from the templated RULE_FALLBACK text.
 */
export const GEMINI_FALLBACK_MODEL_ID = "gemini-2.5-flash";

const fallbackModel: LanguageModel | undefined = process.env.GEMINI_API_KEY
  ? createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })(
      GEMINI_FALLBACK_MODEL_ID,
    )
  : undefined;

export interface FlagNarrationResult {
  text: string;
  source: "LLM" | "RULE_FALLBACK";
}

/**
 * Generates narration text for an agent flag, with a bounded timeout.
 * Per RESOLVED item 3 (former OPEN item 3): the monitoring loop's
 * rule-based layer must never depend on LLM uptime, so any failure or
 * timeout here resolves to a RULE_FALLBACK result rather than throwing —
 * callers supply their own templated fallback text in that case.
 */
export async function generateFlagNarration(
  prompt: string,
  // 5000 (the original AGENTIC_DASHBOARD_PLAN.md "Decision 3" budget) was
  // too tight for this model in practice: it's a reasoning model that
  // emits a hidden chain-of-thought before any answer text (confirmed via
  // a live curl — ~100-180 reasoning tokens even for trivial prompts).
  // test/eval/llm-narration.eval.test.ts measured 4 of 5 realistic
  // narration prompts hitting the old 5s ceiling and silently falling
  // back to RULE_FALLBACK even though the LLM was healthy — this call
  // only runs in the internal cron route (no user-facing request is
  // waiting on it), so there's no reason not to give it real headroom.
  timeoutMs = 15000,
): Promise<FlagNarrationResult> {
  try {
    const { text } = await generateText({
      model: llmModel,
      prompt,
      abortSignal: AbortSignal.timeout(timeoutMs),
    });
    return { text, source: "LLM" };
  } catch {
    if (!fallbackModel) {
      return { text: "", source: "RULE_FALLBACK" };
    }
    try {
      const { text } = await generateText({
        model: fallbackModel,
        prompt,
        abortSignal: AbortSignal.timeout(timeoutMs),
      });
      return { text, source: "LLM" };
    } catch {
      return { text: "", source: "RULE_FALLBACK" };
    }
  }
}
