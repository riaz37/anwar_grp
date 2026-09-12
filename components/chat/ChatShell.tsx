"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { History } from "lucide-react";
import type { UIMessage } from "ai";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/primitives/sheet";
import { ChatSidebar } from "./ChatSidebar";
import { ChatEmptyState } from "./ChatEmptyState";
import { ChatThread } from "./ChatThread";
import { PENDING_MESSAGE_KEY_PREFIX } from "./pending-message";
import type { ConversationSummary } from "@/lib/chat";

interface ConversationApiResponse {
  success: boolean;
  data: { conversation: ConversationSummary } | null;
}

async function apiJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`Request to ${input} failed (${res.status})`);
  return res.json();
}

/**
 * Dedicated ChatGPT-style chat page: conversation-list sidebar + active
 * thread, both driven client-side so switching or creating conversations
 * never triggers a full page reload (matches the reference layout linked
 * in the request — a persistent history rail beside a centered thread).
 */
export function ChatShell({
  conversations: initialConversations,
  activeConversationId,
  initialMessages,
}: {
  conversations: ConversationSummary[];
  activeConversationId?: string;
  initialMessages?: UIMessage[];
}) {
  const router = useRouter();
  const [conversations, setConversations] = useState(initialConversations);
  const [creating, setCreating] = useState(false);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);

  async function refreshConversations() {
    const json = await apiJson<{ success: boolean; data: { conversations: ConversationSummary[] } }>(
      "/api/v1/conversations",
    );
    if (json.success) setConversations(json.data.conversations);
  }

  function handleNewChat() {
    setMobileHistoryOpen(false);
    router.push("/chat");
  }

  async function handleStartNewChat(text: string) {
    if (creating) return;
    setCreating(true);
    try {
      const json = await apiJson<ConversationApiResponse>("/api/v1/conversations", {
        method: "POST",
      });
      if (!json.success || !json.data) throw new Error("Failed to create conversation");
      const { id } = json.data.conversation;
      window.sessionStorage.setItem(`${PENDING_MESSAGE_KEY_PREFIX}${id}`, text);
      router.push(`/chat/${id}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(id: string, title: string) {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    await apiJson(`/api/v1/conversations/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
  }

  async function handleDelete(id: string) {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    await apiJson(`/api/v1/conversations/${id}`, { method: "DELETE" });
    if (id === activeConversationId) router.push("/chat");
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="hidden h-full w-64 shrink-0 border-r border-outline-low md:flex lg:w-72">
        <ChatSidebar
          activeConversationId={activeConversationId}
          conversations={conversations}
          onDelete={handleDelete}
          onNewChat={handleNewChat}
          onNavigate={() => setMobileHistoryOpen(false)}
          onRename={handleRename}
        />
      </div>

      <Sheet onOpenChange={setMobileHistoryOpen} open={mobileHistoryOpen}>
        <SheetContent className="w-72 p-0" side="left">
          <SheetHeader className="sr-only">
            <SheetTitle>Conversations</SheetTitle>
          </SheetHeader>
          <ChatSidebar
            activeConversationId={activeConversationId}
            conversations={conversations}
            onDelete={handleDelete}
            onNewChat={handleNewChat}
            onNavigate={() => setMobileHistoryOpen(false)}
            onRename={handleRename}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center border-b border-outline-low px-ds-lg py-ds-md md:hidden">
          <button
            aria-label="Conversation history"
            className="flex size-9 items-center justify-center rounded-lg text-text-med hover:bg-surface-2 hover:text-text-high focus-visible:outline-none"
            onClick={() => setMobileHistoryOpen(true)}
            type="button"
          >
            <History aria-hidden="true" className="size-5" />
          </button>
        </div>

        {activeConversationId ? (
          <ChatThread
            conversationId={activeConversationId}
            initialMessages={initialMessages ?? []}
            key={activeConversationId}
            onFirstMessageSent={() => {
              // The title is derived server-side from the very first
              // persisted user message, which lands before the model even
              // starts streaming — but the exact timing still races this
              // request, so retry a couple of times rather than once.
              setTimeout(refreshConversations, 600);
              setTimeout(refreshConversations, 2000);
            }}
          />
        ) : (
          <ChatEmptyState busy={creating} onSend={handleStartNewChat} />
        )}
      </div>
    </div>
  );
}
