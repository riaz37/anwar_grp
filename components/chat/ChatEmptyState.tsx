"use client";

import { useRef, useState } from "react";
import { Bot } from "lucide-react";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";

const PORTFOLIO_PROMPTS = [
  "What's blocked right now?",
  "Which projects are behind schedule?",
  "Where are the ownership gaps?",
];

/** The landing screen of the dedicated /chat page: no conversation exists
 *  yet, so this renders the ChatGPT-style centered "what can I help with"
 *  composer rather than an empty thread. Submitting creates the conversation
 *  and hands off to it (see ChatShell.handleStartNewChat). */
export function ChatEmptyState({
  busy,
  onSend,
}: {
  busy: boolean;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    onSend(trimmed);
  }

  // A suggested prompt fills the composer for review/editing rather than
  // sending immediately — clicking one shouldn't skip the chance to tweak
  // the question before it goes out.
  function fillFromPrompt(prompt: string) {
    setDraft(prompt);
    textareaRef.current?.focus();
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col justify-center gap-ds-4xl px-ds-2xl">
      <div className="flex flex-col items-center gap-ds-lg py-ds-4xl text-center">
        <span className="flex size-12 items-center justify-center rounded-pill bg-primary-wash text-primary-high">
          <Bot aria-hidden="true" className="size-6" />
        </span>
        <div>
          <h1 className="text-title-1 font-semibold text-text-high">PMO agent</h1>
          <p className="mt-ds-xs text-body-2 text-text-low">
            Status, risk, delay, and ownership — grounded in real data.
          </p>
        </div>
        <ul className="flex flex-wrap justify-center gap-ds-sm">
          {PORTFOLIO_PROMPTS.map((prompt) => (
            <li key={prompt}>
              <button
                className="rounded-pill border border-outline-med bg-surface-2 px-ds-xl py-ds-sm text-caption-2 text-text-med transition-colors duration-150 hover:border-outline-high hover:bg-surface-3 hover:text-text-high focus-visible:outline-none"
                onClick={() => fillFromPrompt(prompt)}
                type="button"
              >
                {prompt}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <PromptInput
        className="relative rounded-2xl bg-gradient-to-br from-primary-wash via-outline-med to-transparent p-px shadow-e1 [&_[data-slot=input-group]]:rounded-2xl [&_[data-slot=input-group]]:border-none [&_[data-slot=input-group]]:bg-surface-2/80 [&_[data-slot=input-group]]:shadow-none [&_[data-slot=input-group]]:backdrop-blur-md"
        onSubmit={(message) => submit(message.text)}
      >
        <PromptInputTextarea
          className="pl-ds-xl text-body-2 text-text-high placeholder:text-text-low"
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about status, risks, delays, or ownership…"
          ref={textareaRef}
          value={draft}
        />
        <PromptInputFooter className="px-ds-xl pb-ds-lg">
          <p className="text-caption-2 text-text-low">
            Enter to send · Shift+Enter for a new line
          </p>
          <PromptInputSubmit
            aria-label="Ask"
            className="rounded-pill bg-primary-med text-primary-onaccent shadow-primary-button hover:bg-primary-high disabled:opacity-40 disabled:shadow-none"
            disabled={!draft.trim() || busy}
            status={busy ? "submitted" : "ready"}
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
