import { requireAuth } from "@/lib/authz";
import { requireProjectPermission } from "@/lib/project-authz";
import { ok, handleRouteError } from "@/lib/api-response";
import { createConversation, listConversations } from "@/lib/chat";

export async function GET() {
  try {
    const user = await requireAuth();
    requireProjectPermission(user, "VIEW_AGENT_INSIGHTS");

    const conversations = await listConversations(user.userId);
    return ok({ conversations });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST() {
  try {
    const user = await requireAuth();
    requireProjectPermission(user, "VIEW_AGENT_INSIGHTS");

    const conversation = await createConversation(user.userId);
    return ok({ conversation }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
