import { NextRequest } from "next/server";
import { z } from "zod";
import { DelayReasonCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { requireProjectPermission } from "@/lib/project-authz";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";

const delayReasonSchema = z.object({
  category: z.nativeEnum(DelayReasonCategory),
  note: z.string().trim().max(2000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> },
) {
  try {
    const user = await requireAuth();
    requireProjectPermission(user, "RECORD_DELAY_REASON");
    const { id, milestoneId } = await params;
    const body = delayReasonSchema.parse(await req.json());

    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
    });
    if (!milestone || milestone.projectId !== id) {
      return fail("NOT_FOUND", "Milestone not found.", 404);
    }

    const delayReason = await prisma.delayReason.create({
      data: {
        projectId: id,
        milestoneId,
        category: body.category,
        note: body.note,
        recordedById: user.userId,
      },
    });

    await writeAudit({
      actorId: user.userId,
      action: "delay_reason.create",
      entityType: "DelayReason",
      entityId: delayReason.id,
      metadata: { projectId: id, milestoneId },
    });

    return ok(delayReason, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
