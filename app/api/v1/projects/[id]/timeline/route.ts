import { requireAuth } from "@/lib/authz";
import { requireProjectParticipant } from "@/lib/project-authz";
import { ok, handleRouteError } from "@/lib/api-response";
import { getProjectTimeline } from "@/lib/project-memory";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    await requireProjectParticipant(user, id);

    const typesParam = new URL(req.url).searchParams.get("types");
    const types = typesParam
      ? typesParam
          .split(",")
          .map((type) => type.trim())
          .filter(Boolean)
      : undefined;

    const timeline = await getProjectTimeline(id, { types });

    return ok(timeline);
  } catch (err) {
    return handleRouteError(err);
  }
}
