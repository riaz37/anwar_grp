import "server-only";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, type LanguageModel } from "ai";

/**
 * Models tried in order for every LLM call in this app: gemini-3.1-flash-lite
 * (behind GEMINI_API_KEY), then DeepSeek (an OpenAI-compatible endpoint,
 * behind DEEPSEEK_API_KEY). Each tier is skipped when its required env var
 * is absent. `primaryModel` (the first configured tier) is used directly by
 * callers that need a single model, e.g. the streaming assistant route.
 */
export const GEMINI_MODEL_ID = "gemini-3.1-flash-lite";
export const DEEPSEEK_MODEL_ID = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";

const googleProvider = process.env.GEMINI_API_KEY
  ? createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })
  : undefined;

const deepseekProvider = process.env.DEEPSEEK_API_KEY
  ? createOpenAI({
      baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
      apiKey: process.env.DEEPSEEK_API_KEY,
    })
  : undefined;

export const models: LanguageModel[] = [
  googleProvider?.(GEMINI_MODEL_ID),
  deepseekProvider?.chat(DEEPSEEK_MODEL_ID),
].filter((model): model is Exclude<typeof model, undefined> => Boolean(model));

/**
 * Single model used by callers that make one model call rather than a
 * fallback chain (e.g. streamText in the assistant route, which can't
 * retry mid-stream). Undefined when neither GEMINI_API_KEY nor
 * DEEPSEEK_API_KEY is set — callers must handle that case explicitly.
 */
export const primaryModel: LanguageModel | undefined = models[0];

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
  for (const model of models) {
    try {
      const { text } = await generateText({
        model,
        prompt,
        abortSignal: AbortSignal.timeout(timeoutMs),
      });
      return { text, source: "LLM" };
    } catch {
      // try the next tier
    }
  }
  return { text: "", source: "RULE_FALLBACK" };
}
