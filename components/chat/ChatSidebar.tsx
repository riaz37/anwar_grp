"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/primitives/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/primitives/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ConversationSummary } from "@/lib/chat";

interface ChatSidebarProps {
  conversations: ConversationSummary[];
  activeConversationId?: string;
  onNewChat: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  /** Fired when a conversation link is followed — lets the mobile Sheet
   *  instance close itself on navigation. */
  onNavigate?: () => void;
}

/** Left rail of the dedicated chat page (ChatGPT's conversation list), nested
 *  inside the app's own SideRail — the "three-panel" layout: primary nav,
 *  conversation history, thread. */
export function ChatSidebar({
  conversations,
  activeConversationId,
  onNewChat,
  onRename,
  onDelete,
  onNavigate,
}: ChatSidebarProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  function startRename(conversation: ConversationSummary) {
    setRenamingId(conversation.id);
    setDraftTitle(conversation.title);
  }

  function commitRename() {
    const trimmed = draftTitle.trim();
    if (renamingId && trimmed) onRename(renamingId, trimmed);
    setRenamingId(null);
  }

  return (
    <div className="flex h-full w-full flex-col bg-surface-1">
      <div className="shrink-0 p-ds-lg">
        <button
          className="flex w-full items-center gap-ds-md rounded-lg border border-outline-med px-ds-lg py-ds-md text-body-2 font-medium text-text-high transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none"
          onClick={onNewChat}
          type="button"
        >
          <Plus aria-hidden="true" className="size-4" />
          New chat
        </button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav aria-label="Conversations" className="flex flex-col gap-ds-xxs px-ds-lg pb-ds-lg">
          {conversations.length === 0 && (
            <p className="px-ds-md py-ds-lg text-caption-2 text-text-low">
              No conversations yet.
            </p>
          )}
          {conversations.map((conversation) => {
            const active = conversation.id === activeConversationId;
            const renaming = renamingId === conversation.id;
            return (
              <div
                className={cn(
                  "group/item relative flex items-center rounded-lg",
                  active ? "bg-primary-wash" : "hover:bg-surface-2",
                )}
                key={conversation.id}
              >
                {renaming ? (
                  <input
                    autoFocus
                    className="w-full min-w-0 rounded-lg bg-transparent px-ds-md py-ds-md text-body-2 text-text-high outline-none"
                    onBlur={commitRename}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    value={draftTitle}
                  />
                ) : (
                  <Link
                    className={cn(
                      "min-w-0 flex-1 truncate rounded-lg px-ds-md py-ds-md text-body-2",
                      active ? "text-primary-high" : "text-text-med",
                    )}
                    href={`/chat/${conversation.id}`}
                    onClick={onNavigate}
                  >
                    {conversation.title}
                  </Link>
                )}

                {!renaming && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        aria-label={`Conversation options for ${conversation.title}`}
                        className="mr-ds-xs flex size-7 shrink-0 items-center justify-center rounded-lg text-text-low opacity-0 transition-opacity hover:bg-surface-3 hover:text-text-high focus-visible:opacity-100 group-hover/item:opacity-100"
                        type="button"
                      >
                        <MoreHorizontal aria-hidden="true" className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => startRename(conversation)}>
                        <Pencil aria-hidden="true" className="size-3.5" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => onDelete(conversation.id)}
                        variant="destructive"
                      >
                        <Trash2 aria-hidden="true" className="size-3.5" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </nav>
      </ScrollArea>
    </div>
  );
}
