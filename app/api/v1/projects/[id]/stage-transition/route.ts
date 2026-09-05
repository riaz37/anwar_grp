import { NextRequest } from "next/server";
import { z } from "zod";
import { ProjectStage } from "@prisma/client";
import { requireAuth } from "@/lib/authz";
import { requireProjectPermission, requireProjectParticipant } from "@/lib/project-authz";
import { transitionProjectStage, StageTransitionError } from "@/lib/project-stages";
import { ok, fail, handleRouteError } from "@/lib/api-response";

const transitionSchema = z.object({
  toStage: z.nativeEnum(ProjectStage),
  notes: z.string().trim().max(2000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    requireProjectPermission(user, "TRANSITION_STAGE");
    const { id } = await params;
    await requireProjectParticipant(user, id);
    const body = transitionSchema.parse(await req.json());

    const updated = await transitionProjectStage({
      projectId: id,
      toStage: body.toStage,
      actor: user,
      notes: body.notes,
    });

    return ok(updated);
  } catch (err) {
    if (err instanceof StageTransitionError) {
      return fail("STAGE_TRANSITION_INVALID", err.message, 422);
    }
    return handleRouteError(err);
  }
}
