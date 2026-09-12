import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasProjectPermission } from "@/lib/project-authz";
import {
  getConversationMessages,
  getConversationOwnedBy,
  listConversations,
} from "@/lib/chat";
import { ChatShell } from "@/components/chat/ChatShell";

export const metadata: Metadata = { title: "Chat" };
export const dynamic = "force-dynamic";

export default async function ChatConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasProjectPermission(session.role, "VIEW_AGENT_INSIGHTS")) {
    redirect("/home");
  }

  const { id } = await params;
  const conversation = await getConversationOwnedBy(id, session.userId);
  if (!conversation) notFound();

  const [conversations, messages] = await Promise.all([
    listConversations(session.userId),
    getConversationMessages(id),
  ]);

  return (
    <ChatShell
      activeConversationId={id}
      conversations={conversations}
      initialMessages={messages}
    />
  );
}
