import { getCurrentUser } from "@/lib/authz";
import { destroySession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { ok, handleRouteError } from "@/lib/api-response";

export async function POST() {
  try {
    const user = await getCurrentUser();

    await destroySession();

    if (user) {
      await writeAudit({
        actorId: user.userId,
        action: "AUTH_LOGOUT",
        entityType: "User",
        entityId: user.userId,
        metadata: null,
      });
    }

    return ok({ loggedOut: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
