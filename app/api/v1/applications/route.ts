import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma, Role, ApplicationStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { ok, handleRouteError } from "@/lib/api-response";
import { parsePagination } from "@/lib/pagination";
import { canReadOrgWide, applicationScopeWhere } from "@/lib/phase2-scoping";

const READ_ROLES: Role[] = [
  Role.TA_ADMIN,
  Role.RECRUITER,
  Role.DEPT_HEAD,
  Role.HIRING_MANAGER,
  Role.HR_LEADERSHIP,
  Role.AUDIT_USER,
  Role.TECH_ADMIN,
];

const listQuerySchema = z.object({
  assignedRecruiterId: z.string().optional(),
  currentStage: z.nativeEnum(ApplicationStage).optional(),
  requisitionId: z.string().optional(),
});

/**
 * GET: what the recruiter dashboard queries (assignedRecruiterId /
 * currentStage / requisitionId filters). Scoping: org-wide roles see
 * everything; RECRUITER defaults to their own assigned applications;
 * DEPT_HEAD/HIRING_MANAGER default to applications under requisitions
 * in their department. See lib/phase2-scoping.ts.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireRole(READ_ROLES);
    const { searchParams } = req.nextUrl;
    const filters = listQuerySchema.parse({
      assignedRecruiterId: searchParams.get("assignedRecruiterId") ?? undefined,
      currentStage: searchParams.get("currentStage") ?? undefined,
      requisitionId: searchParams.get("requisitionId") ?? undefined,
    });
    const { skip, take, page, limit } = parsePagination(searchParams);

    const where: Prisma.ApplicationWhereInput = {
      ...applicationScopeWhere(user),
      ...(filters.currentStage && { currentStage: filters.currentStage }),
      ...(filters.requisitionId && { requisitionId: filters.requisitionId }),
      ...(filters.assignedRecruiterId &&
        canReadOrgWide(user) && {
          assignedRecruiterId: filters.assignedRecruiterId,
        }),
    };

    const [total, applications] = await Promise.all([
      prisma.application.count({ where }),
      prisma.application.findMany({
        where,
        skip,
        take,
        include: {
          candidate: { select: { id: true, name: true, email: true } },
          requisition: { select: { id: true, position: true } },
          assignedRecruiter: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    return ok(applications, { meta: { total, page, limit } });
  } catch (err) {
    return handleRouteError(err);
  }
}
