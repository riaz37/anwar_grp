import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { requireProjectPermission, requireProjectParticipant } from "@/lib/project-authz";
import { writeAudit } from "@/lib/audit";
import { computeRiskSeverity } from "@/lib/risk-engine";
import { ok, fail, handleRouteError } from "@/lib/api-response";

const createRiskSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  likelihood: z.enum(["LOW", "MEDIUM", "HIGH"]),
  impact: z.enum(["LOW", "MEDIUM", "HIGH"]),
  ownerId: z.string().min(1),
  mitigationPlan: z.string().trim().max(2000).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    await requireProjectParticipant(user, id);

    const risks = await prisma.risk.findMany({
      where: { projectId: id },
      include: { owner: true, raisedBy: true },
      orderBy: { createdAt: "desc" },
    });

    return ok(
      risks.map((risk) => ({
        id: risk.id,
        title: risk.title,
        description: risk.description,
        likelihood: risk.likelihood,
        impact: risk.impact,
        severity: computeRiskSeverity(risk.likelihood, risk.impact),
        status: risk.status,
        mitigationPlan: risk.mitigationPlan,
        ownerId: risk.ownerId,
        ownerName: risk.owner.name,
        raisedByName: risk.raisedBy.name,
        identifiedAt: risk.identifiedAt,
        resolvedAt: risk.resolvedAt,
        createdAt: risk.createdAt,
      })),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    requireProjectPermission(user, "RECORD_RISK");
    const { id } = await params;
    await requireProjectParticipant(user, id);
    const body = createRiskSchema.parse(await req.json());

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return fail("NOT_FOUND", "Project not found.", 404);
    }

    const owner = await prisma.user.findUnique({ where: { id: body.ownerId } });
    if (!owner) {
      return fail("NOT_FOUND", "Owner not found.", 404);
    }

    const risk = await prisma.risk.create({
      data: {
        projectId: id,
        title: body.title,
        description: body.description,
        likelihood: body.likelihood,
        impact: body.impact,
        ownerId: body.ownerId,
        raisedById: user.userId,
        mitigationPlan: body.mitigationPlan,
      },
    });

    await writeAudit({
      actorId: user.userId,
      action: "risk.create",
      entityType: "Risk",
      entityId: risk.id,
      metadata: { projectId: id },
    });

    return ok(risk, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
