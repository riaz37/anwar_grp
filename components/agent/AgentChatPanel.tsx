"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { ToolUIPart, UIMessage } from "ai";
import { Button as AppButton } from "@/components/ui/Button";
import { RetryIcon } from "@/components/ui/icons";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { CollapsibleContent } from "@/components/ui/primitives/collapsible";
import { AgentWaveBackdrop } from "./AgentWaveBackdrop";
import { AgentThinkingOrb } from "./AgentThinkingOrb";
import { cn } from "@/lib/utils";

interface AgentChatPanelProps {
  /** When set, scopes the assistant's answers to one project (drill-down variant). */
  projectId?: string;
  placeholder?: string;
  /** When set, the turn is persisted to this conversation (dedicated /chat page). */
  conversationId?: string;
  /** Messages loaded from a persisted conversation, rendered before any new turn. */
  initialMessages?: UIMessage[];
  /** Called once the first token of a fresh conversation's reply has streamed in,
   *  so the sidebar list can pick up the auto-derived title. */
  onFirstMessageSent?: () => void;
  /** Sent automatically once, on mount — the hand-off from the empty-state
   *  composer that created this conversation before navigating here. */
  autoSendText?: string;
}

/** Tool name → short activity label, active and done tense. No raw JSON, no
 *  wrench badges — this reads like a report footnote, not a dev console. */
const TOOL_LABELS: Record<string, { active: string; done: string }> = {
  getProjectStatus: {
    active: "checking project status",
    done: "checked project status",
  },
  getProjectRaci: {
    active: "checking RACI and ownership",
    done: "checked RACI and ownership",
  },
  listOpenFlags: { active: "checking open flags", done: "checked open flags" },
  getProjectTimeline: {
    active: "checking the project timeline",
    done: "checked the project timeline",
  },
  searchDocuments: {
    active: "searching documents",
    done: "searched documents",
  },
};

/** Prompts the agent can actually answer today — no invented data, just the
 *  same ground the empty-state copy already promises. */
const PROJECT_PROMPTS = [
  "What's this project's status?",
  "What's overdue or at risk?",
  "Who owns delivery right now?",
];
const PORTFOLIO_PROMPTS = [
  "What's blocked right now?",
  "Which projects are behind schedule?",
  "Where are the ownership gaps?",
];

function toolName(part: ToolUIPart): string {
  return part.type.replace(/^tool-/, "");
}

function toolLabel(part: ToolUIPart, done: boolean): string {
  const entry = TOOL_LABELS[toolName(part)];
  if (entry) return done ? entry.done : entry.active;
  return done ? `ran ${toolName(part)}` : `running ${toolName(part)}`;
}

/** One step in a message's tool-call trace: a running or settled action the
 *  agent took en route to its answer. Rendered as a rail, not a chat bubble —
 *  the point is to make "the agent is actually doing work" legible. Only a
 *  plain pulsing dot marks an in-flight step; the orb itself is reserved for
 *  the `Reasoning` trigger above so at most one is ever on screen at a time. */
function TraceStep({ part, index }: { part: ToolUIPart; index: number }) {
  const failed = part.state === "output-error";
  const done = part.state === "output-available";
  return (
    <li
      className="rise-in flex items-center gap-ds-md py-ds-xxs"
      style={{ "--i": index } as React.CSSProperties}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 shrink-0 rounded-pill",
          failed
            ? "bg-danger-med"
            : done
              ? "bg-primary-med"
              : "animate-agent-pulse bg-primary-med/60",
        )}
      />
      <span
        className={cn(
          "text-caption-2",
          failed ? "text-danger-high" : "text-text-low",
        )}
      >
        {failed ? `couldn't finish ${toolName(part)}` : toolLabel(part, done)}
      </span>
    </li>
  );
}

/** A single turn, built on the AI Elements `Message`/`Reasoning` primitives
 *  but restyled to this app's report-rail voice (DESIGN.md's dossier
 *  pattern) rather than their default chat-bubble look — `from="assistant"`
 *  is passed unconditionally so `Message` never applies its right-aligned
 *  user-bubble classes; the actual role only drives the rail color and the
 *  "You"/"Agent" label. Tool calls render inside `Reasoning`, so "what did
 *  the agent check" collapses the same way a model's chain-of-thought would
 *  — with the orb standing in for the trigger's default brain icon while a
 *  step is still running. */
function Turn({
  role,
  toolParts,
  textParts,
}: {
  role: "user" | "assistant";
  toolParts: ToolUIPart[];
  textParts: { text: string; streaming: boolean }[];
}) {
  const isAgent = role === "assistant";
  const traceRunning = toolParts.some(
    (part) =>
      part.state !== "output-available" && part.state !== "output-error",
  );

  return (
    <Message className="rise-in ml-0 max-w-full justify-start" from="assistant">
      <MessageContent
        className={cn(
          "w-full max-w-full rounded-none border-l-2 bg-transparent px-0 py-ds-lg pl-ds-xl text-para shadow-none",
          isAgent ? "border-primary-med/40" : "border-outline-med",
        )}
      >
        <span className="annotation">{isAgent ? "Agent" : "You"}</span>

        {isAgent && toolParts.length > 0 && (
          <Reasoning className="mb-0 mt-ds-sm" isStreaming={traceRunning}>
            <ReasoningTrigger
              className="gap-ds-sm text-caption-2 text-text-low hover:text-text-high [&_svg]:size-3.5"
              getThinkingMessage={(streaming) => (
                <span className="flex items-center gap-ds-sm">
                  {streaming && (
                    <AgentThinkingOrb size={20} state="searching" />
                  )}
                  {streaming ? (
                    <Shimmer className="text-caption-2" duration={1.4}>
                      Checking live data…
                    </Shimmer>
                  ) : (
                    <span>
                      Checked {toolParts.length} thing
                      {toolParts.length === 1 ? "" : "s"}
                    </span>
                  )}
                </span>
              )}
            />
            <CollapsibleContent className="mt-ds-xs">
              <ul>
                {toolParts.map((part, i) => (
                  <TraceStep index={i} key={part.toolCallId} part={part} />
                ))}
              </ul>
            </CollapsibleContent>
          </Reasoning>
        )}

        {textParts.map((part, i) => (
          <span className="flex items-end gap-ds-xxs" key={i}>
            <MessageResponse
              className={cn(
                "text-text-high [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
                toolParts.length > 0 && i === 0 && "mt-ds-md",
              )}
            >
              {part.text}
            </MessageResponse>
            {part.streaming && (
              <span
                aria-hidden="true"
                className="animate-agent-pulse mb-0.5 inline-block h-3.5 w-[2px] shrink-0 bg-primary-med"
              />
            )}
          </span>
        ))}
      </MessageContent>
    </Message>
  );
}

export function AgentChatPanel({
  projectId,
  placeholder,
  conversationId,
  initialMessages,
  onFirstMessageSent,
  autoSendText,
}: AgentChatPanelProps) {
  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/v1/assistant",
        body: {
          ...(projectId ? { projectId } : {}),
          ...(conversationId ? { conversationId } : {}),
        },
      }),
  );
  const { messages, sendMessage, status, error, stop, regenerate } = useChat({
    transport,
    messages: initialMessages,
  });
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const busy = status === "submitted" || status === "streaming";
  const lastMessage = messages[messages.length - 1];
  // The synthetic "working" row only earns its place before the agent's own
  // message has started rendering anything — once it has parts, the trace
  // and/or streaming text already say "this is in progress".
  const awaitingFirstToken =
    busy &&
    (!lastMessage ||
      lastMessage.role === "user" ||
      lastMessage.parts.length === 0);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const isFirstMessage = messages.length === 0;
    sendMessage({ text: trimmed });
    setDraft("");
    if (isFirstMessage) onFirstMessageSent?.();
  }

  // A suggested prompt fills the composer for review/editing rather than
  // sending immediately — clicking one shouldn't skip the chance to tweak
  // the question before it goes out.
  function fillFromPrompt(prompt: string) {
    setDraft(prompt);
    textareaRef.current?.focus();
  }

  useEffect(() => {
    if (!autoSendText) return;
    // Deferred a tick so the send (and its setState calls) happens outside
    // this effect's own commit rather than synchronously within it.
    const timer = setTimeout(() => submit(autoSendText), 0);
    return () => clearTimeout(timer);
    // Fire exactly once, on mount, for this conversation's hand-off text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prompts = projectId ? PROJECT_PROMPTS : PORTFOLIO_PROMPTS;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="flex-1">
        <ConversationContent className="gap-0 p-0">
          {messages.length === 0 ? (
            <div className="relative flex min-h-full flex-col justify-end gap-ds-lg overflow-hidden rounded-lg">
              <AgentWaveBackdrop />
              <p className="relative text-caption-1 uppercase tracking-wide text-text-low">
                Try asking
              </p>
              <ul className="relative flex flex-wrap gap-ds-sm">
                {prompts.map((prompt) => (
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
          ) : (
            <div>
              {messages
                // useChat adds the assistant's turn to `messages` before any
                // parts have streamed in, so a bare 0-part placeholder would
                // render its own empty "Agent" row at the same time as the
                // awaitingFirstToken block below — two "Agent" labels for one
                // turn. Skip it here; awaitingFirstToken already covers it.
                .filter(
                  (message) =>
                    message.role !== "assistant" || message.parts.length > 0,
                )
                .map((message) => {
                  const toolParts = message.parts.filter(
                    (part): part is ToolUIPart => part.type.startsWith("tool-"),
                  );
                  const textParts = message.parts
                    .filter((part) => part.type === "text")
                    // Multi-step tool calling (stopWhen: stepCountIs(N)) emits
                    // one text part per step, and steps that only make a tool
                    // call carry an empty settled one ("") — rendering those
                    // adds blank paragraphs (margin + line-height with no
                    // content), which read as a dead gap before the real
                    // answer. A still-streaming part is kept even if empty so
                    // the response area doesn't flicker away right as typing
                    // starts.
                    .filter(
                      (part) =>
                        part.text.trim().length > 0 ||
                        part.state === "streaming",
                    )
                    .map((part) => ({
                      text: part.text,
                      streaming: part.state === "streaming",
                    }));
                  return (
                    <Turn
                      key={message.id}
                      role={message.role === "user" ? "user" : "assistant"}
                      textParts={textParts}
                      toolParts={toolParts}
                    />
                  );
                })}
              {awaitingFirstToken && (
                <div className="rise-in border-l-2 border-primary-med/40 py-ds-lg pl-ds-xl">
                  <span className="annotation">Agent</span>
                  <div className="mt-ds-sm flex items-center gap-ds-sm">
                    <AgentThinkingOrb
                      size={20}
                      state={status === "submitted" ? "listening" : "solving"}
                    />
                    <Shimmer className="text-caption-2" duration={1.4}>
                      {status === "submitted" ? "starting up…" : "thinking…"}
                    </Shimmer>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-ds-lg flex items-center justify-between gap-ds-lg rounded-lg border border-danger-outline bg-danger-wash px-ds-xl py-ds-lg">
              <p className="text-caption-2 text-danger-high">
                The agent couldn&rsquo;t finish that. Nothing was lost — your
                question is still in the log above.
              </p>
              <AppButton
                className="shrink-0"
                onClick={() => regenerate()}
                variant="secondary"
              >
                <RetryIcon />
                Retry
              </AppButton>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <PromptInput
        className="relative mt-ds-lg rounded-2xl bg-gradient-to-br from-primary-wash via-outline-med to-transparent p-px shadow-e1 [&_[data-slot=input-group]]:rounded-2xl [&_[data-slot=input-group]]:border-none [&_[data-slot=input-group]]:bg-surface-2/80 [&_[data-slot=input-group]]:shadow-none [&_[data-slot=input-group]]:backdrop-blur-md"
        onSubmit={(message) => {
          if (busy) {
            stop();
            return;
          }
          submit(message.text);
        }}
      >
        <PromptInputTextarea
          className="pl-ds-xl text-body-2 text-text-high placeholder:text-text-low"
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            placeholder ?? "Ask about status, risks, delays, or ownership…"
          }
          ref={textareaRef}
          value={draft}
        />
        <PromptInputFooter className="px-ds-xl pb-ds-lg">
          <p className="text-caption-2 text-text-low">
            Enter to send · Shift+Enter for a new line
          </p>
          <PromptInputSubmit
            aria-label={busy ? "Stop" : "Ask"}
            className="rounded-pill bg-primary-med text-primary-onaccent shadow-primary-button hover:bg-primary-high disabled:opacity-40 disabled:shadow-none"
            disabled={!busy && !draft.trim()}
            status={status}
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
