import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { ok, handleRouteError } from "@/lib/api-response";
import { parsePagination } from "@/lib/pagination";
import { criteriaListSchema } from "@/lib/evaluation-forms";

/**
 * Evaluation form templates (BUILD_PLAN.md Sec 3.1 item 4; PDF
 * "Interview Evaluation" — configurable criteria per role type).
 *
 * Any role that can end up filling out or reading an evaluation needs
 * to browse templates to pick/see which one applies; only TA_ADMIN/
 * TECH_ADMIN can create them — mirrors app/api/v1/message-templates'
 * "configuration is a data change reviewed by admins" gate.
 */
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
const CREATE_ROLES: Role[] = [Role.TA_ADMIN, Role.TECH_ADMIN];

const listQuerySchema = z.object({
  roleType: z.string().trim().min(1).optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

/** GET /api/v1/evaluation-form-templates?roleType=&isActive= */
export async function GET(req: NextRequest) {
  try {
    await requireRole(READ_ROLES);
    const { searchParams } = req.nextUrl;
    const filters = listQuerySchema.parse({
      roleType: searchParams.get("roleType") ?? undefined,
      isActive: searchParams.get("isActive") ?? undefined,
    });
    const { skip, take, page, limit } = parsePagination(searchParams);

    const where: Prisma.EvaluationFormTemplateWhereInput = {
      ...(filters.roleType && { roleType: filters.roleType }),
      ...(filters.isActive !== undefined && {
        isActive: filters.isActive === "true",
      }),
    };

    const [total, templates] = await Promise.all([
      prisma.evaluationFormTemplate.count({ where }),
      prisma.evaluationFormTemplate.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    return ok(templates, { meta: { total, page, limit } });
  } catch (err) {
    return handleRouteError(err);
  }
}

const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  roleType: z.string().trim().min(1).max(100),
  criteria: criteriaListSchema,
  isActive: z.boolean().default(true),
});

/**
 * POST: creates a new evaluation form template. `criteria` is validated
 * via lib/evaluation-forms.ts's criteriaListSchema (unique keys,
 * scoreMax bounds) — a malformed criteria list is rejected outright
 * (unlike message-templates' allowedFields, which silently drops
 * unknown entries; here every criterion is admin-authored, there's no
 * "unsafe field" registry to filter against, so a validation error is
 * the right response).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(CREATE_ROLES);
    const body = createTemplateSchema.parse(await req.json());

    const template = await prisma.evaluationFormTemplate.create({
      data: {
        name: body.name,
        roleType: body.roleType,
        criteria: body.criteria,
        isActive: body.isActive,
        createdById: user.userId,
      },
    });

    await writeAudit({
      actorId: user.userId,
      action: "EVALUATION_FORM_TEMPLATE_CREATE",
      entityType: "EvaluationFormTemplate",
      entityId: template.id,
      metadata: { roleType: template.roleType },
    });

    return ok(template, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
