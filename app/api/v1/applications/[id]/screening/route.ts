import { NextRequest } from "next/server";
import { z } from "zod";
import { Role, ScreeningAttendance } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";
import { applicationScopeWhere } from "@/lib/phase2-scoping";

const READ_ROLES: Role[] = [
  Role.TA_ADMIN,
  Role.RECRUITER,
  Role.DEPT_HEAD,
  Role.HIRING_MANAGER,
  Role.HR_LEADERSHIP,
  Role.AUDIT_USER,
  Role.TECH_ADMIN,
];
const WRITE_ROLES: Role[] = [
  Role.TA_ADMIN,
  Role.RECRUITER,
  Role.DEPT_HEAD,
  Role.HIRING_MANAGER,
];

const createScreeningSchema = z.object({
  eligibility: z.boolean(),
  screeningComments: z.string().trim().max(4000).optional(),
  telephoneAssessmentOutcome: z.string().trim().max(500).optional(),
  availability: z.string().trim().max(500).optional(),
  recommendation: z.string().trim().max(2000).optional(),
  assessmentType: z.string().trim().max(200).optional(),
  assessmentScore: z.number().min(0).max(1000).optional(),
  attendance: z.nativeEnum(ScreeningAttendance).optional(),
  evaluatorRecommendation: z.string().trim().max(2000).optional(),
  // See lib/phase3-document-authz.ts: uploaded with
  // ownerType=SCREENING_ASSESSMENT, ownerId=<this applicationId>.
  assessmentDocumentId: z.string().min(1).optional(),
});

/**
 * POST /api/v1/applications/:id/screening — records a screening/
 * assessment outcome (PDF Sec "Screening and Assessment").
 *
 * Design decision (documented at length on the ScreeningAssessment
 * model in schema.prisma): recording a screening here does NOT itself
 * transition Application.currentStage. Eligibility here can resolve to
 * several different next moves (advance, hold, reject) that the
 * existing PATCH /applications/:id/stage endpoint already models
 * explicitly — auto-transitioning here would hide that decision inside
 * a record-creation call. The recruiter uses this record as input to a
 * separate, explicit stage-transition call.
 *
 * No update path is exposed — additional screening rounds are recorded
 * as additional rows (GET returns them newest-first), never mutated in
 * place.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(WRITE_ROLES);
    const { id } = await params;
    const body = createScreeningSchema.parse(await req.json());

    const application = await prisma.application.findFirst({
      where: { id, ...applicationScopeWhere(user) },
      select: { id: true },
    });
    if (!application) {
      return fail("NOT_FOUND", "Application not found.", 404);
    }

    const screening = await prisma.screeningAssessment.create({
      data: {
        applicationId: id,
        eligibility: body.eligibility,
        screeningComments: body.screeningComments,
        telephoneAssessmentOutcome: body.telephoneAssessmentOutcome,
        availability: body.availability,
        recommendation: body.recommendation,
        assessmentType: body.assessmentType,
        assessmentScore: body.assessmentScore,
        attendance: body.attendance,
        evaluatorRecommendation: body.evaluatorRecommendation,
        assessmentDocumentId: body.assessmentDocumentId,
        createdById: user.userId,
      },
    });

    await writeAudit({
      actorId: user.userId,
      action: "SCREENING_ASSESSMENT_CREATE",
      entityType: "ScreeningAssessment",
      entityId: screening.id,
      metadata: { applicationId: id, eligibility: body.eligibility },
    });

    return ok(screening, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** GET: all screening/assessment records for an application, newest first. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(READ_ROLES);
    const { id } = await params;

    const application = await prisma.application.findFirst({
      where: { id, ...applicationScopeWhere(user) },
      select: { id: true },
    });
    if (!application) {
      return fail("NOT_FOUND", "Application not found.", 404);
    }

    const records = await prisma.screeningAssessment.findMany({
      where: { applicationId: id },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });

    return ok(records);
  } catch (err) {
    return handleRouteError(err);
  }
}
