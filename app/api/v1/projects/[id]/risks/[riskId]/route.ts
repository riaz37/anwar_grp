import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { requireProjectPermission, requireProjectParticipant } from "@/lib/project-authz";
import { writeAudit } from "@/lib/audit";
import { computeRiskSeverity, recordRiskStatusChange } from "@/lib/risk-engine";
import { ok, fail, handleRouteError } from "@/lib/api-response";

const updateRiskSchema = z.object({
  status: z.enum(["OPEN", "MITIGATING", "RESOLVED", "ACCEPTED"]),
  note: z.string().trim().max(2000).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; riskId: string }> },
) {
  try {
    const user = await requireAuth();
    requireProjectPermission(user, "MANAGE_RISK_STATUS");
    const { id, riskId } = await params;
    await requireProjectParticipant(user, id);
    const body = updateRiskSchema.parse(await req.json());

    const risk = await prisma.risk.findUnique({ where: { id: riskId } });
    if (!risk || risk.projectId !== id) {
      return fail("NOT_FOUND", "Risk not found.", 404);
    }

    const { risk: updated } = await recordRiskStatusChange(
      riskId,
      body.status,
      user.userId,
      body.note,
    );

    await writeAudit({
      actorId: user.userId,
      action: "risk.status_change",
      entityType: "Risk",
      entityId: riskId,
      metadata: { projectId: id, toStatus: body.status },
    });

    return ok({
      id: updated.id,
      title: updated.title,
      description: updated.description,
      likelihood: updated.likelihood,
      impact: updated.impact,
      severity: computeRiskSeverity(updated.likelihood, updated.impact),
      status: updated.status,
      mitigationPlan: updated.mitigationPlan,
      ownerId: updated.ownerId,
      resolvedAt: updated.resolvedAt,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
