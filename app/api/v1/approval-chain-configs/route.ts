import { NextRequest } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";
import { parsePagination } from "@/lib/pagination";
import { APPROVAL_CHAIN_CONFIG_ADMIN_ROLES } from "@/lib/approval-chain";

// Any authenticated role in the recruitment pipeline may READ chain
// configs (a recruiter needs to see what chain will apply before
// initiating a request) — only TA_ADMIN/TECH_ADMIN may CREATE one, since
// this is org configuration (BUILD_PLAN.md Sec 2.9: "adding/changing a
// chain is a data change, not a deploy").
const READ_ROLES: Role[] = [
  Role.TA_ADMIN,
  Role.RECRUITER,
  Role.DEPT_HEAD,
  Role.HIRING_MANAGER,
  Role.HR_LEADERSHIP,
  Role.AUDIT_USER,
  Role.TECH_ADMIN,
];

const createChainConfigSchema = z.object({
  businessUnitId: z.string().min(1),
  departmentId: z.string().min(1),
  positionLevel: z.string().trim().min(1).max(100),
  // Ordered by array position — index 0 is step 0 (the first approver).
  approverRolesOrdered: z.array(z.nativeEnum(Role)).min(1).max(10),
});

/**
 * POST /api/v1/approval-chain-configs — creates a new active chain for
 * (businessUnitId, departmentId, positionLevel), deactivating any prior
 * active chain for the same triple in the same transaction (see
 * prisma/schema.prisma's ApprovalChainConfig doc comment — uniqueness of
 * "one active chain per triple" is enforced here in application logic,
 * not a DB constraint, so historical/inactive rows can accumulate).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(APPROVAL_CHAIN_CONFIG_ADMIN_ROLES);
    const body = createChainConfigSchema.parse(await req.json());

    const [businessUnit, department] = await Promise.all([
      prisma.businessUnit.findUnique({ where: { id: body.businessUnitId } }),
      prisma.department.findUnique({ where: { id: body.departmentId } }),
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

    const created = await prisma.$transaction(async (tx) => {
      const prior = await tx.approvalChainConfig.findFirst({
        where: {
          businessUnitId: body.businessUnitId,
          departmentId: body.departmentId,
          positionLevel: body.positionLevel,
          isActive: true,
        },
      });

      const version = (prior?.version ?? 0) + 1;

      if (prior) {
        await tx.approvalChainConfig.update({
          where: { id: prior.id },
          data: { isActive: false },
        });
      }

      const config = await tx.approvalChainConfig.create({
        data: {
          businessUnitId: body.businessUnitId,
          departmentId: body.departmentId,
          positionLevel: body.positionLevel,
          isActive: true,
          version,
          createdById: user.userId,
          steps: {
            create: body.approverRolesOrdered.map((approverRole, sequence) => ({
              sequence,
              approverRole,
            })),
          },
        },
        include: { steps: { orderBy: { sequence: "asc" } } },
      });

      return config;
    });

    await writeAudit({
      actorId: user.userId,
      action: "APPROVAL_CHAIN_CONFIG_CREATE",
      entityType: "ApprovalChainConfig",
      entityId: created.id,
      metadata: {
        businessUnitId: created.businessUnitId,
        departmentId: created.departmentId,
        positionLevel: created.positionLevel,
        approverRolesOrdered: body.approverRolesOrdered,
        version: created.version,
      },
    });

    return ok(created, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

const listQuerySchema = z.object({
  businessUnitId: z.string().optional(),
  departmentId: z.string().optional(),
  positionLevel: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

/** GET /api/v1/approval-chain-configs — list, filterable. */
export async function GET(req: NextRequest) {
  try {
    await requireRole(READ_ROLES);
    const { searchParams } = req.nextUrl;
    const filters = listQuerySchema.parse({
      businessUnitId: searchParams.get("businessUnitId") ?? undefined,
      departmentId: searchParams.get("departmentId") ?? undefined,
      positionLevel: searchParams.get("positionLevel") ?? undefined,
      isActive: searchParams.get("isActive") ?? undefined,
    });
    const { skip, take, page, limit } = parsePagination(searchParams);

    const where = {
      ...(filters.businessUnitId && { businessUnitId: filters.businessUnitId }),
      ...(filters.departmentId && { departmentId: filters.departmentId }),
      ...(filters.positionLevel && { positionLevel: filters.positionLevel }),
      ...(filters.isActive !== undefined && { isActive: filters.isActive }),
    };

    const [total, configs] = await Promise.all([
      prisma.approvalChainConfig.count({ where }),
      prisma.approvalChainConfig.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { steps: { orderBy: { sequence: "asc" } } },
      }),
    ]);

    return ok(configs, { meta: { total, page, limit } });
  } catch (err) {
    return handleRouteError(err);
  }
}
