"use client";

import { useState } from "react";
import type { UIMessage } from "ai";
import { AgentChatPanel } from "@/components/agent/AgentChatPanel";
import { PENDING_MESSAGE_KEY_PREFIX } from "./pending-message";

/** One conversation's thread. Reads (and clears) a pending first message left
 *  in sessionStorage by the empty-state composer's hand-off, so a brand new
 *  conversation lands here already sending, instead of on a blank composer. */
export function ChatThread({
  conversationId,
  initialMessages,
  onFirstMessageSent,
}: {
  conversationId: string;
  initialMessages: UIMessage[];
  onFirstMessageSent: () => void;
}) {
  const [pendingText] = useState(() => {
    if (typeof window === "undefined") return undefined;
    const key = `${PENDING_MESSAGE_KEY_PREFIX}${conversationId}`;
    const value = window.sessionStorage.getItem(key);
    if (value) window.sessionStorage.removeItem(key);
    return value ?? undefined;
  });

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl min-h-0 flex-1 flex-col px-ds-2xl py-ds-lg">
      <AgentChatPanel
        autoSendText={pendingText}
        conversationId={conversationId}
        initialMessages={initialMessages}
        onFirstMessageSent={onFirstMessageSent}
      />
    </div>
  );
}
