import { NextRequest } from "next/server";
import { z } from "zod";
import { Role, ApplicationStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";

const READ_ROLES: Role[] = [
  Role.TA_ADMIN,
  Role.RECRUITER,
  Role.DEPT_HEAD,
  Role.HIRING_MANAGER,
  Role.HR_LEADERSHIP,
  Role.AUDIT_USER,
  Role.TECH_ADMIN,
];
const CREATE_ROLES: Role[] = [Role.TA_ADMIN, Role.RECRUITER];

const createApplicationSchema = z.object({
  requisitionId: z.string().min(1),
  assignedRecruiterId: z.string().min(1),
});

/**
 * POST: link an existing candidate to a requisition. currentStage
 * always starts at NEW; the first StageHistory row (fromStage: null ->
 * toStage: NEW) is written in the same transaction so every
 * application's history is complete from creation, not just from its
 * first stage *change* (BUILD_PLAN.md Sec 2.3 "Every stage change must
 * create a permanent history record" — creation counts as the first
 * one).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(CREATE_ROLES);
    const { id: candidateId } = await params;
    const body = createApplicationSchema.parse(await req.json());

    const [candidate, requisition, recruiter] = await Promise.all([
      prisma.candidate.findUnique({ where: { id: candidateId } }),
      prisma.requisition.findUnique({ where: { id: body.requisitionId } }),
      prisma.user.findUnique({ where: { id: body.assignedRecruiterId } }),
    ]);
    if (!candidate) return fail("NOT_FOUND", "Candidate not found.", 404);
    if (!requisition) return fail("NOT_FOUND", "Requisition not found.", 404);
    if (!recruiter) return fail("NOT_FOUND", "Assigned recruiter not found.", 404);

    const application = await prisma.$transaction(async (tx) => {
      const created = await tx.application.create({
        data: {
          candidateId,
          requisitionId: body.requisitionId,
          assignedRecruiterId: body.assignedRecruiterId,
          currentStage: ApplicationStage.NEW,
        },
      });

      await tx.stageHistory.create({
        data: {
          applicationId: created.id,
          fromStage: null,
          toStage: ApplicationStage.NEW,
          changedById: user.userId,
          notes: "Application created.",
        },
      });

      return created;
    });

    await writeAudit({
      actorId: user.userId,
      action: "APPLICATION_CREATE",
      entityType: "Application",
      entityId: application.id,
      metadata: {
        candidateId,
        requisitionId: body.requisitionId,
      },
    });

    return ok(application, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** GET: list applications for this candidate. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole(READ_ROLES);
    const { id: candidateId } = await params;

    const applications = await prisma.application.findMany({
      where: { candidateId },
      include: {
        requisition: { select: { id: true, position: true } },
        assignedRecruiter: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok(applications);
  } catch (err) {
    return handleRouteError(err);
  }
}
