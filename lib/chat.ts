import "server-only";
import type { UIMessage } from "ai";
import { ChatMessageRole, Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/** UIMessage parts are a plain, JSON-serializable tree (text/tool/reasoning
 *  parts) but TS types them structurally rather than as `Prisma.InputJsonValue`
 *  — this cast just tells Prisma what's already true. */
function toJsonInput(parts: UIMessage["parts"]): Prisma.InputJsonValue {
  return parts as unknown as Prisma.InputJsonValue;
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: Date;
}

const TITLE_MAX_LENGTH = 60;

function titleFromFirstMessage(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= TITLE_MAX_LENGTH) return trimmed || "New chat";
  return `${trimmed.slice(0, TITLE_MAX_LENGTH - 1)}…`;
}

function firstTextPart(message: UIMessage): string {
  const part = message.parts.find((p) => p.type === "text");
  return part && "text" in part ? part.text : "";
}

export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  return prisma.chatConversation.findMany({
    where: { userId },
    select: { id: true, title: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function createConversation(userId: string): Promise<ConversationSummary> {
  return prisma.chatConversation.create({
    data: { userId, title: "New chat" },
    select: { id: true, title: true, updatedAt: true },
  });
}

export async function getConversationOwnedBy(conversationId: string, userId: string) {
  return prisma.chatConversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true, title: true, updatedAt: true, createdAt: true },
  });
}

export async function getConversationMessages(conversationId: string): Promise<UIMessage[]> {
  const rows = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    role: row.role === ChatMessageRole.USER ? "user" : "assistant",
    parts: row.parts as UIMessage["parts"],
  }));
}

export async function renameConversation(
  conversationId: string,
  userId: string,
  title: string,
): Promise<ConversationSummary | null> {
  const result = await prisma.chatConversation.updateMany({
    where: { id: conversationId, userId },
    data: { title },
  });
  if (result.count === 0) return null;
  return getConversationOwnedBy(conversationId, userId);
}

export async function deleteConversation(conversationId: string, userId: string): Promise<boolean> {
  const result = await prisma.chatConversation.deleteMany({
    where: { id: conversationId, userId },
  });
  return result.count > 0;
}

/**
 * Stores the user's turn and, when this is the conversation's first message,
 * derives its title from it — mirrors ChatGPT auto-titling a new thread from
 * the opening prompt rather than leaving every entry as "New chat".
 */
export async function persistUserMessage(
  conversationId: string,
  message: UIMessage,
): Promise<void> {
  const existingCount = await prisma.chatMessage.count({ where: { conversationId } });

  await prisma.chatMessage.upsert({
    where: { id: message.id },
    create: {
      id: message.id,
      conversationId,
      role: ChatMessageRole.USER,
      parts: toJsonInput(message.parts),
    },
    update: { parts: toJsonInput(message.parts) },
  });

  if (existingCount === 0) {
    const text = firstTextPart(message);
    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { title: titleFromFirstMessage(text), updatedAt: new Date() },
    });
  } else {
    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  }
}

export async function persistAssistantMessage(
  conversationId: string,
  message: UIMessage,
): Promise<void> {
  await prisma.chatMessage.upsert({
    where: { id: message.id },
    create: {
      id: message.id,
      conversationId,
      role: ChatMessageRole.ASSISTANT,
      parts: toJsonInput(message.parts),
    },
    update: { parts: toJsonInput(message.parts) },
  });
  await prisma.chatConversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
}
