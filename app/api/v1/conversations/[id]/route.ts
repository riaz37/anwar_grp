import { z } from "zod";
import { requireAuth } from "@/lib/authz";
import { requireProjectPermission } from "@/lib/project-authz";
import { ok, fail, handleRouteError } from "@/lib/api-response";
import {
  deleteConversation,
  getConversationMessages,
  getConversationOwnedBy,
  renameConversation,
} from "@/lib/chat";

const renameSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    requireProjectPermission(user, "VIEW_AGENT_INSIGHTS");
    const { id } = await params;

    const conversation = await getConversationOwnedBy(id, user.userId);
    if (!conversation) {
      return fail("NOT_FOUND", "Conversation not found.", 404);
    }

    const messages = await getConversationMessages(id);
    return ok({ conversation, messages });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    requireProjectPermission(user, "VIEW_AGENT_INSIGHTS");
    const { id } = await params;
    const body = renameSchema.parse(await req.json());

    const conversation = await renameConversation(id, user.userId, body.title);
    if (!conversation) {
      return fail("NOT_FOUND", "Conversation not found.", 404);
    }
    return ok({ conversation });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    requireProjectPermission(user, "VIEW_AGENT_INSIGHTS");
    const { id } = await params;

    const deleted = await deleteConversation(id, user.userId);
    if (!deleted) {
      return fail("NOT_FOUND", "Conversation not found.", 404);
    }
    return ok({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
