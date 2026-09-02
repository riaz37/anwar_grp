import { NextRequest } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
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
// Who may add ad hoc checklist items beyond the auto-seeded default set
// (see lib/joining-checklist.ts and the stage-transition route). Same
// roles allowed to change an application's stage — joining coordination
// is a recruiter/TA-admin/hiring-manager/dept-head responsibility.
const WRITE_ROLES: Role[] = [
  Role.TA_ADMIN,
  Role.RECRUITER,
  Role.DEPT_HEAD,
  Role.HIRING_MANAGER,
];

/**
 * GET /api/v1/applications/:id/joining-checklist — lists all checklist
 * items for the application, ordered by createdAt so the default-
 * seeded template items keep a stable order.
 */
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

    const items = await prisma.joiningChecklistItem.findMany({
      where: { applicationId: id },
      include: {
        owner: { select: { id: true, name: true, role: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return ok(items);
  } catch (err) {
    return handleRouteError(err);
  }
}

const createSchema = z.object({
  label: z.string().trim().min(1).max(200),
  ownerId: z.string().min(1),
  dueDate: z.coerce.date().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

/**
 * POST /api/v1/applications/:id/joining-checklist — adds ONE ad hoc
 * checklist item to the application (beyond the default-seeded set —
 * see the stage-transition route's doc comment for when/how the default
 * 13-item template is auto-created). Not a bulk-create endpoint by
 * design — keeping this a single-item add mirrors how every other
 * "add one more thing to a list" endpoint in this API works, and the
 * PDF's "simple checklist" framing doesn't call for a bulk-import flow.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(WRITE_ROLES);
    const { id } = await params;
    const body = createSchema.parse(await req.json());

    const application = await prisma.application.findFirst({
      where: { id, ...applicationScopeWhere(user) },
      select: { id: true },
    });
    if (!application) {
      return fail("NOT_FOUND", "Application not found.", 404);
    }

    const owner = await prisma.user.findUnique({ where: { id: body.ownerId } });
    if (!owner) {
      return fail("NOT_FOUND", "Checklist item owner not found.", 404);
    }

    const item = await prisma.joiningChecklistItem.create({
      data: {
        applicationId: id,
        label: body.label,
        ownerId: body.ownerId,
        dueDate: body.dueDate ?? undefined,
        notes: body.notes ?? undefined,
        createdById: user.userId,
      },
      include: {
        owner: { select: { id: true, name: true, role: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    await writeAudit({
      actorId: user.userId,
      action: "JOINING_CHECKLIST_ITEM_CREATE",
      entityType: "JoiningChecklistItem",
      entityId: item.id,
      metadata: { applicationId: id, label: item.label, ownerId: item.ownerId },
    });

    return ok(item, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
