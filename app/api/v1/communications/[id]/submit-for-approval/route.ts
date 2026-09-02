import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma, Role, CommunicationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";
import { applicationScopeWhere } from "@/lib/phase2-scoping";

const ROLES: Role[] = [
  Role.TA_ADMIN,
  Role.RECRUITER,
  Role.DEPT_HEAD,
  Role.HIRING_MANAGER,
];

const bodySchema = z.object({ version: z.number().int().min(1) });

/**
 * POST /api/v1/communications/:id/submit-for-approval — Drafted ->
 * Awaiting Approval (BUILD_PLAN.md Sec 2.8's locked pipeline). Anyone
 * who could draft the communication may submit it; the narrower gate is
 * on the approve step (communications/:id/approve), per PDF's
 * "Candidate-facing messages must be approved by the recruiter before
 * sending."
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(ROLES);
    const { id } = await params;
    const body = bodySchema.parse(await req.json());

    const existing = await prisma.communication.findFirst({
      where: { id, application: applicationScopeWhere(user) },
    });
    if (!existing) {
      return fail("NOT_FOUND", "Communication not found.", 404);
    }
    if (existing.status !== CommunicationStatus.DRAFTED) {
      return fail(
        "INVALID_TRANSITION",
        `Cannot submit for approval from status ${existing.status}.`,
        400,
      );
    }

    try {
      const updated = await prisma.communication.update({
        where: { id, version: body.version },
        data: { status: CommunicationStatus.AWAITING_APPROVAL, version: { increment: 1 } },
      });

      await writeAudit({
        actorId: user.userId,
        action: "COMMUNICATION_SUBMIT_FOR_APPROVAL",
        entityType: "Communication",
        entityId: updated.id,
        metadata: { applicationId: updated.applicationId },
      });

      return ok(updated);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        return fail(
          "VERSION_CONFLICT",
          "This communication was updated by someone else. Reload and try again.",
          409,
        );
      }
      throw err;
    }
  } catch (err) {
    return handleRouteError(err);
  }
}
