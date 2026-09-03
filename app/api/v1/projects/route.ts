import { NextRequest } from "next/server";
import { z } from "zod";
import { ProjectHealth, ProjectStage, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { requireProjectPermission } from "@/lib/project-authz";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";
import { parsePagination } from "@/lib/pagination";

const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  businessUnitId: z.string().min(1),
  departmentId: z.string().min(1),
  businessProblem: z.string().trim().min(1),
  expectedOutcome: z.string().trim().min(1),
  ownerId: z.string().min(1),
  analystId: z.string().min(1).optional(),
  developerId: z.string().min(1).optional(),
  expectedDeliveryDate: z.coerce.date(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    requireProjectPermission(user, "CREATE_PROJECT");
    const body = createProjectSchema.parse(await req.json());

    const [businessUnit, department, owner, analyst, developer] =
      await Promise.all([
        prisma.businessUnit.findUnique({ where: { id: body.businessUnitId } }),
        prisma.department.findUnique({ where: { id: body.departmentId } }),
        prisma.user.findUnique({ where: { id: body.ownerId } }),
        body.analystId
          ? prisma.user.findUnique({ where: { id: body.analystId } })
          : Promise.resolve(null),
        body.developerId
          ? prisma.user.findUnique({ where: { id: body.developerId } })
          : Promise.resolve(null),
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
    if (!owner) {
      return fail("NOT_FOUND", "Owner not found.", 404);
    }
    if (body.analystId && !analyst) {
      return fail("NOT_FOUND", "Analyst not found.", 404);
    }
    if (body.developerId && !developer) {
      return fail("NOT_FOUND", "Developer not found.", 404);
    }

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          name: body.name,
          businessUnitId: body.businessUnitId,
          departmentId: body.departmentId,
          businessProblem: body.businessProblem,
          expectedOutcome: body.expectedOutcome,
          ownerId: body.ownerId,
          analystId: body.analystId,
          developerId: body.developerId,
          expectedDeliveryDate: body.expectedDeliveryDate,
        },
      });

      await tx.projectStageHistory.create({
        data: {
          projectId: created.id,
          fromStage: null,
          toStage: ProjectStage.IDEA,
          actorId: user.userId,
        },
      });

      return created;
    });

    await writeAudit({
      actorId: user.userId,
      action: "project.create",
      entityType: "Project",
      entityId: project.id,
      metadata: { name: project.name },
    });

    return ok(project, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

const listQuerySchema = z.object({
  businessUnitId: z.string().optional(),
  departmentId: z.string().optional(),
  currentStage: z.nativeEnum(ProjectStage).optional(),
  health: z.nativeEnum(ProjectHealth).optional(),
  ownerId: z.string().optional(),
  analystId: z.string().optional(),
  developerId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = req.nextUrl;
    const filters = listQuerySchema.parse({
      businessUnitId: searchParams.get("businessUnitId") ?? undefined,
      departmentId: searchParams.get("departmentId") ?? undefined,
      currentStage: searchParams.get("currentStage") ?? undefined,
      health: searchParams.get("health") ?? undefined,
      ownerId: searchParams.get("ownerId") ?? undefined,
      analystId: searchParams.get("analystId") ?? undefined,
      developerId: searchParams.get("developerId") ?? undefined,
    });
    const { skip, take, page, limit } = parsePagination(searchParams);

    const where: Prisma.ProjectWhereInput = {
      ...(filters.businessUnitId && { businessUnitId: filters.businessUnitId }),
      ...(filters.departmentId && { departmentId: filters.departmentId }),
      ...(filters.currentStage && { currentStage: filters.currentStage }),
      ...(filters.health && { health: filters.health }),
      ...(filters.ownerId && { ownerId: filters.ownerId }),
      ...(filters.analystId && { analystId: filters.analystId }),
      ...(filters.developerId && { developerId: filters.developerId }),
    };

    const [total, projects] = await Promise.all([
      prisma.project.count({ where }),
      prisma.project.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    return ok(projects, { meta: { total, page, limit } });
  } catch (err) {
    return handleRouteError(err);
  }
}
