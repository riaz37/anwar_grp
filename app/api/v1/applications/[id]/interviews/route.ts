import { NextRequest } from "next/server";
import { z } from "zod";
import { Role, ApplicationStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";
import { applicationScopeWhere } from "@/lib/phase2-scoping";
import { isValidStageTransition } from "@/lib/application-stages";
import { isPanelistOnApplication } from "@/lib/phase3-scoping";

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

const scheduleInterviewSchema = z.object({
  roundNumber: z.number().int().min(1),
  scheduledAt: z.coerce.date(),
  durationMinutes: z.number().int().min(1).max(24 * 60),
  location: z.string().trim().max(500).optional(),
  onlineLink: z.string().trim().url().max(1000).optional(),
  candidateInstructions: z.string().trim().max(4000).optional(),
  panelUserIds: z.array(z.string().min(1)).min(1),
  evaluationFormId: z.string().min(1).optional(),
});

/**
 * POST /api/v1/applications/:id/interviews — schedules a round.
 *
 * Design decision (mirrored on the Interview model in schema.prisma):
 * scheduling DOES attempt to auto-transition Application.currentStage
 * to INTERVIEW, because "an interview has been scheduled" maps
 * unambiguously onto the pipeline stage with no competing outcome
 * (unlike recording a screening, which can resolve several different
 * ways). The transition is attempted via the same
 * lib/application-stages.ts table the manual stage-change endpoint
 * uses; if it isn't a valid transition from the application's current
 * stage (e.g. scheduling round 2+ while already at INTERVIEW, or a
 * FEEDBACK_PENDING loop-back per that file's comment), scheduling still
 * proceeds — it just does not force a stage change or write an extra
 * StageHistory row in that case.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(WRITE_ROLES);
    const { id } = await params;
    const body = scheduleInterviewSchema.parse(await req.json());

    if (!body.location && !body.onlineLink) {
      return fail(
        "VALIDATION_ERROR",
        "Provide at least one of location or onlineLink.",
        400,
      );
    }

    const application = await prisma.application.findFirst({
      where: { id, ...applicationScopeWhere(user) },
    });
    if (!application) {
      return fail("NOT_FOUND", "Application not found.", 404);
    }

    const panelUsers = await prisma.user.findMany({
      where: { id: { in: body.panelUserIds } },
      select: { id: true },
    });
    if (panelUsers.length !== new Set(body.panelUserIds).size) {
      return fail("NOT_FOUND", "One or more panel user ids do not exist.", 404);
    }

    const shouldTransitionStage = isValidStageTransition(
      application.currentStage,
      ApplicationStage.INTERVIEW,
    );

    const interview = await prisma.$transaction(async (tx) => {
      const created = await tx.interview.create({
        data: {
          applicationId: id,
          roundNumber: body.roundNumber,
          scheduledAt: body.scheduledAt,
          durationMinutes: body.durationMinutes,
          location: body.location,
          onlineLink: body.onlineLink,
          candidateInstructions: body.candidateInstructions,
          evaluationFormId: body.evaluationFormId,
          createdById: user.userId,
          panelists: {
            create: body.panelUserIds.map((userId) => ({ userId })),
          },
        },
        include: { panelists: { include: { user: { select: { id: true, name: true } } } } },
      });

      if (shouldTransitionStage) {
        await tx.application.update({
          where: { id, version: application.version },
          data: {
            currentStage: ApplicationStage.INTERVIEW,
            version: { increment: 1 },
          },
        });
        await tx.stageHistory.create({
          data: {
            applicationId: id,
            fromStage: application.currentStage,
            toStage: ApplicationStage.INTERVIEW,
            changedById: user.userId,
            notes: `Auto-transitioned on scheduling interview round ${body.roundNumber}.`,
          },
        });
      }

      return created;
    });

    await writeAudit({
      actorId: user.userId,
      action: "INTERVIEW_SCHEDULE",
      entityType: "Interview",
      entityId: interview.id,
      metadata: {
        applicationId: id,
        roundNumber: body.roundNumber,
        scheduledAt: body.scheduledAt,
        panelUserIds: body.panelUserIds,
        autoTransitionedStage: shouldTransitionStage,
      },
    });

    return ok(interview, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** GET: all interview rounds for an application, chronological. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(READ_ROLES);
    const { id } = await params;

    let application = await prisma.application.findFirst({
      where: { id, ...applicationScopeWhere(user) },
      select: { id: true },
    });
    if (!application && user.role === Role.PANEL_MEMBER) {
      // See lib/phase3-scoping.ts: panel members aren't in the default
      // application scope, but can view an application's interviews if
      // they're assigned as a panelist on one of them.
      const isPanelist = await isPanelistOnApplication(user, id);
      if (isPanelist) {
        application = await prisma.application.findUnique({
          where: { id },
          select: { id: true },
        });
      }
    }
    if (!application) {
      return fail("NOT_FOUND", "Application not found.", 404);
    }

    const interviews = await prisma.interview.findMany({
      where: { applicationId: id },
      include: {
        panelists: { include: { user: { select: { id: true, name: true } } } },
        rescheduleHistory: { orderBy: { changedAt: "asc" } },
      },
      orderBy: { roundNumber: "asc" },
    });

    return ok(interviews);
  } catch (err) {
    return handleRouteError(err);
  }
}
