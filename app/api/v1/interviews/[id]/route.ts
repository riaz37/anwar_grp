import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma, Role, InterviewStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";
import { applicationScopeWhere } from "@/lib/phase2-scoping";
import { isPanelistOnInterview } from "@/lib/phase3-scoping";
import type { SessionPayload } from "@/lib/session";

const READ_ROLES: Role[] = [
  Role.TA_ADMIN,
  Role.RECRUITER,
  Role.DEPT_HEAD,
  Role.HIRING_MANAGER,
  Role.HR_LEADERSHIP,
  Role.AUDIT_USER,
  Role.TECH_ADMIN,
  Role.PANEL_MEMBER,
];
const WRITE_ROLES: Role[] = [
  Role.TA_ADMIN,
  Role.RECRUITER,
  Role.DEPT_HEAD,
  Role.HIRING_MANAGER,
];

async function findVisibleInterview(user: SessionPayload, id: string) {
  const interview = await prisma.interview.findUnique({
    where: { id },
    include: {
      panelists: { include: { user: { select: { id: true, name: true } } } },
      rescheduleHistory: { orderBy: { changedAt: "asc" } },
    },
  });
  if (!interview) return null;

  const inScope = await prisma.application.findFirst({
    where: { id: interview.applicationId, ...applicationScopeWhere(user) },
    select: { id: true },
  });
  if (inScope) return interview;

  if (user.role === Role.PANEL_MEMBER) {
    const isPanelist = await isPanelistOnInterview(user, id);
    if (isPanelist) return interview;
  }
  return null;
}

/** GET: interview detail, including panel + reschedule history. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(READ_ROLES);
    const { id } = await params;

    const interview = await findVisibleInterview(user, id);
    if (!interview) {
      return fail("NOT_FOUND", "Interview not found.", 404);
    }

    return ok(interview);
  } catch (err) {
    return handleRouteError(err);
  }
}

const patchSchema = z
  .object({
    version: z.number().int().min(1),
    scheduledAt: z.coerce.date().optional(),
    reason: z.string().trim().max(2000).optional(),
    durationMinutes: z.number().int().min(1).max(24 * 60).optional(),
    location: z.string().trim().max(500).nullable().optional(),
    onlineLink: z.string().trim().url().max(1000).nullable().optional(),
    candidateInstructions: z.string().trim().max(4000).nullable().optional(),
    status: z.nativeEnum(InterviewStatus).optional(),
  })
  .refine(
    (body) => body.scheduledAt || body.status || body.durationMinutes || body.location !== undefined || body.onlineLink !== undefined || body.candidateInstructions !== undefined,
    { message: "At least one field to update must be provided." },
  );

/**
 * PATCH /api/v1/interviews/:id — reschedule (changing scheduledAt
 * requires writing an InterviewRescheduleHistory row, per PDF's
 * explicit "Rescheduling history" requirement) and/or status change
 * (e.g. cancel via status=CANCELLED). Version-locked like every other
 * mutable resource in this API.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(WRITE_ROLES);
    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    const existing = await prisma.interview.findFirst({
      where: { id, application: applicationScopeWhere(user) },
    });
    if (!existing) {
      return fail("NOT_FOUND", "Interview not found.", 404);
    }

    const isReschedule =
      body.scheduledAt && body.scheduledAt.getTime() !== existing.scheduledAt.getTime();

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const interview = await tx.interview.update({
          where: { id, version: body.version },
          data: {
            version: { increment: 1 },
            ...(body.scheduledAt && { scheduledAt: body.scheduledAt }),
            ...(body.durationMinutes !== undefined && {
              durationMinutes: body.durationMinutes,
            }),
            ...(body.location !== undefined && { location: body.location }),
            ...(body.onlineLink !== undefined && { onlineLink: body.onlineLink }),
            ...(body.candidateInstructions !== undefined && {
              candidateInstructions: body.candidateInstructions,
            }),
            ...(body.status && { status: body.status }),
            ...(isReschedule &&
              !body.status && { status: InterviewStatus.RESCHEDULED }),
          },
        });

        if (isReschedule) {
          await tx.interviewRescheduleHistory.create({
            data: {
              interviewId: id,
              previousScheduledAt: existing.scheduledAt,
              newScheduledAt: body.scheduledAt!,
              reason: body.reason,
              changedById: user.userId,
            },
          });
        }

        return interview;
      });

      await writeAudit({
        actorId: user.userId,
        action: isReschedule ? "INTERVIEW_RESCHEDULE" : "INTERVIEW_UPDATE",
        entityType: "Interview",
        entityId: updated.id,
        metadata: {
          applicationId: updated.applicationId,
          previousScheduledAt: existing.scheduledAt,
          newScheduledAt: updated.scheduledAt,
          status: updated.status,
        },
      });

      return ok(updated);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        return fail(
          "VERSION_CONFLICT",
          "This interview was updated by someone else. Reload and try again.",
          409,
        );
      }
      throw err;
    }
  } catch (err) {
    return handleRouteError(err);
  }
}
