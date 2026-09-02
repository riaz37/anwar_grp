import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma, Role, RequisitionApprovalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";
import { parsePagination } from "@/lib/pagination";
import { canReadOrgWide, requisitionScopeWhere } from "@/lib/phase2-scoping";

/**
 * Roles allowed to CREATE a requisition: TA_ADMIN (owns the TA process
 * end-to-end) and RECRUITER (the person who will actually run it and
 * gets set as assignedRecruiterId). DEPT_HEAD/HIRING_MANAGER *request*
 * headcount in real orgs but don't operate the requisition record —
 * modeling a separate "request" object is out of Phase 2 scope, so for
 * MVP they ask TA/Recruiting to open one (documented judgment call, see
 * final report).
 */
const CREATE_ROLES: Role[] = [Role.TA_ADMIN, Role.RECRUITER];

const createRequisitionSchema = z.object({
  businessUnitId: z.string().min(1),
  departmentId: z.string().min(1),
  position: z.string().trim().min(1).max(200),
  vacancyCount: z.number().int().min(1),
  positionLevel: z.string().trim().min(1).max(100),
  hiringManagerId: z.string().min(1),
  assignedRecruiterId: z.string().min(1),
  targetJoiningDate: z.coerce.date(),
  erfRrfDocumentId: z.string().min(1).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(CREATE_ROLES);
    const body = createRequisitionSchema.parse(await req.json());

    const [businessUnit, department, hiringManager, recruiter] =
      await Promise.all([
        prisma.businessUnit.findUnique({ where: { id: body.businessUnitId } }),
        prisma.department.findUnique({ where: { id: body.departmentId } }),
        prisma.user.findUnique({ where: { id: body.hiringManagerId } }),
        prisma.user.findUnique({ where: { id: body.assignedRecruiterId } }),
      ]);

    if (!businessUnit) {
      return fail("NOT_FOUND", "Business unit not found.", 404);
    }
    if (!department || department.businessUnitId !== businessUnit.id) {
      return fail(
        "VALIDATION_ERROR",
        "Department not found in the given business unit.",
        400,
      );
    }
    if (!hiringManager) {
      return fail("NOT_FOUND", "Hiring manager not found.", 404);
    }
    if (!recruiter) {
      return fail("NOT_FOUND", "Assigned recruiter not found.", 404);
    }

    const requisition = await prisma.requisition.create({
      data: {
        businessUnitId: body.businessUnitId,
        departmentId: body.departmentId,
        position: body.position,
        vacancyCount: body.vacancyCount,
        positionLevel: body.positionLevel,
        hiringManagerId: body.hiringManagerId,
        assignedRecruiterId: body.assignedRecruiterId,
        targetJoiningDate: body.targetJoiningDate,
        erfRrfDocumentId: body.erfRrfDocumentId,
        notes: body.notes,
        approvalStatus: RequisitionApprovalStatus.DRAFT,
      },
    });

    await writeAudit({
      actorId: user.userId,
      action: "REQUISITION_CREATE",
      entityType: "Requisition",
      entityId: requisition.id,
      metadata: { position: requisition.position },
    });

    return ok(requisition, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

const listQuerySchema = z.object({
  businessUnitId: z.string().optional(),
  departmentId: z.string().optional(),
  approvalStatus: z.nativeEnum(RequisitionApprovalStatus).optional(),
  assignedRecruiterId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole([
      Role.TA_ADMIN,
      Role.RECRUITER,
      Role.DEPT_HEAD,
      Role.HIRING_MANAGER,
      Role.HR_LEADERSHIP,
      Role.AUDIT_USER,
      Role.TECH_ADMIN,
    ]);
    const { searchParams } = req.nextUrl;
    const filters = listQuerySchema.parse({
      businessUnitId: searchParams.get("businessUnitId") ?? undefined,
      departmentId: searchParams.get("departmentId") ?? undefined,
      approvalStatus: searchParams.get("approvalStatus") ?? undefined,
      assignedRecruiterId: searchParams.get("assignedRecruiterId") ?? undefined,
    });
    const { skip, take, page, limit } = parsePagination(searchParams);

    // A requested assignedRecruiterId narrows further, but only within
    // what the caller's role can already see (org-wide roles can look
    // at anyone; a RECRUITER filtering for someone else's id would just
    // combine with their own default scope via AND and get zero rows —
    // acceptable, since they have no business seeing another
    // recruiter's queue by default).
    const where: Prisma.RequisitionWhereInput = {
      ...requisitionScopeWhere(user),
      ...(filters.businessUnitId && { businessUnitId: filters.businessUnitId }),
      ...(filters.departmentId && { departmentId: filters.departmentId }),
      ...(filters.approvalStatus && { approvalStatus: filters.approvalStatus }),
      ...(filters.assignedRecruiterId &&
        canReadOrgWide(user) && {
          assignedRecruiterId: filters.assignedRecruiterId,
        }),
    };

    const [total, requisitions] = await Promise.all([
      prisma.requisition.count({ where }),
      prisma.requisition.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return ok(requisitions, { meta: { total, page, limit } });
  } catch (err) {
    return handleRouteError(err);
  }
}
