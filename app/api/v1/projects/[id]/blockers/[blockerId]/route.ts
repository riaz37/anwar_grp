import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { requireProjectPermission } from "@/lib/project-authz";
import { writeAudit } from "@/lib/audit";
import { recomputeProjectHealth } from "@/lib/project-health";
import { ok, fail, handleRouteError } from "@/lib/api-response";

const updateBlockerSchema = z.object({
  description: z.string().trim().min(1).optional(),
  impact: z.string().trim().min(1).optional(),
  requiredAction: z.string().trim().max(2000).optional(),
  resolve: z.boolean().optional(),
  resolutionNotes: z.string().trim().max(2000).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; blockerId: string }> },
) {
  try {
    const user = await requireAuth();
    const { id, blockerId } = await params;
    const body = updateBlockerSchema.parse(await req.json());

    const blocker = await prisma.blocker.findUnique({ where: { id: blockerId } });
    if (!blocker || blocker.projectId !== id) {
      return fail("NOT_FOUND", "Blocker not found.", 404);
    }

    let updated;
    let auditAction: string;

    if (body.resolve) {
      requireProjectPermission(user, "RESOLVE_BLOCKER");
      updated = await prisma.blocker.update({
        where: { id: blockerId },
        data: {
          resolvedAt: new Date(),
          resolvedById: user.userId,
          resolutionNotes: body.resolutionNotes,
        },
      });
      auditAction = "blocker.resolve";
    } else {
      requireProjectPermission(user, "RECORD_BLOCKER");
      updated = await prisma.blocker.update({
        where: { id: blockerId },
        data: {
          ...(body.description !== undefined && { description: body.description }),
          ...(body.impact !== undefined && { impact: body.impact }),
          ...(body.requiredAction !== undefined && {
            requiredAction: body.requiredAction,
          }),
        },
      });
      auditAction = "blocker.update";
    }

    await recomputeProjectHealth(id);

    await writeAudit({
      actorId: user.userId,
      action: auditAction,
      entityType: "Blocker",
      entityId: blockerId,
      metadata: { projectId: id },
    });

    return ok(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
