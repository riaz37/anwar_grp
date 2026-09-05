import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { requireProjectPermission, requireProjectParticipant } from "@/lib/project-authz";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";

const createScopeChangeSchema = z.object({
  reason: z.string().trim().min(1),
  deliveryImpact: z.string().trim().max(2000).optional(),
  newExpectedDeliveryDate: z.coerce.date().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    requireProjectPermission(user, "RECORD_SCOPE_CHANGE");
    const { id } = await params;
    await requireProjectParticipant(user, id);
    const body = createScopeChangeSchema.parse(await req.json());

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return fail("NOT_FOUND", "Project not found.", 404);
    }

    const [scopeChange] = await prisma.$transaction([
      prisma.scopeChange.create({
        data: {
          projectId: id,
          requestedById: user.userId,
          reason: body.reason,
          deliveryImpact: body.deliveryImpact,
          previousExpectedDeliveryDate: project.expectedDeliveryDate,
          newExpectedDeliveryDate: body.newExpectedDeliveryDate,
        },
      }),
      ...(body.newExpectedDeliveryDate
        ? [
            prisma.project.update({
              where: { id },
              data: {
                expectedDeliveryDate: body.newExpectedDeliveryDate,
                version: { increment: 1 },
              },
            }),
          ]
        : []),
    ]);

    await writeAudit({
      actorId: user.userId,
      action: "scope_change.create",
      entityType: "ScopeChange",
      entityId: scopeChange.id,
      metadata: { projectId: id },
    });

    return ok(scopeChange, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    await requireProjectParticipant(user, id);

    const scopeChanges = await prisma.scopeChange.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
    });

    return ok(scopeChanges);
  } catch (err) {
    return handleRouteError(err);
  }
}
