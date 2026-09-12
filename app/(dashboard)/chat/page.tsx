import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasProjectPermission } from "@/lib/project-authz";
import { listConversations } from "@/lib/chat";
import { ChatShell } from "@/components/chat/ChatShell";

export const metadata: Metadata = { title: "Chat" };
export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasProjectPermission(session.role, "VIEW_AGENT_INSIGHTS")) {
    redirect("/home");
  }

  const conversations = await listConversations(session.userId);

  return <ChatShell conversations={conversations} />;
}
