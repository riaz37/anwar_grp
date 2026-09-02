import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma, Role, CommunicationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole, AuthzError } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";
import { applicationScopeWhere } from "@/lib/phase2-scoping";
import { enqueueCommunicationSend } from "@/lib/queue";

// Role gate is intentionally narrower than drafting: PDF's Communication
// section says "Candidate-facing messages must be approved by the
// recruiter before sending." Role decision (documented, since the PDF
// doesn't spell out exactly who "the recruiter" means when a DEPT_HEAD
// or HIRING_MANAGER drafted it): approval may be performed by (a) the
// application's assigned recruiter specifically, regardless of who
// drafted it, or (b) TA_ADMIN as an administrative override (e.g. the
// assigned recruiter is unavailable). DEPT_HEAD/HIRING_MANAGER can draft
// but cannot approve — approval is the recruiter's accountability, per
// the PDF's literal wording.
const ROLES: Role[] = [Role.TA_ADMIN, Role.RECRUITER];

const bodySchema = z.object({ version: z.number().int().min(1) });

/**
 * POST /api/v1/communications/:id/approve — Awaiting Approval ->
 * Approved, then enqueues the async send job (BUILD_PLAN.md Sec 2.8:
 * the queue is fed from the API route on this transition, never from
 * the worker itself).
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
      include: { application: { select: { assignedRecruiterId: true } } },
    });
    if (!existing) {
      return fail("NOT_FOUND", "Communication not found.", 404);
    }
    if (
      user.role === Role.RECRUITER &&
      existing.application.assignedRecruiterId !== user.userId
    ) {
      throw new AuthzError(
        "Only the application's assigned recruiter (or a TA admin) may approve this communication.",
        403,
        "FORBIDDEN",
      );
    }
    if (existing.status !== CommunicationStatus.AWAITING_APPROVAL) {
      return fail(
        "INVALID_TRANSITION",
        `Cannot approve from status ${existing.status}.`,
        400,
      );
    }

    try {
      const updated = await prisma.communication.update({
        where: { id, version: body.version },
        data: {
          status: CommunicationStatus.APPROVED,
          approvedById: user.userId,
          version: { increment: 1 },
        },
      });

      await enqueueCommunicationSend(updated.id);

      await writeAudit({
        actorId: user.userId,
        action: "COMMUNICATION_APPROVE",
        entityType: "Communication",
        entityId: updated.id,
        metadata: { applicationId: updated.applicationId, channel: updated.channel },
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
