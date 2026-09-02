import { NextRequest } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";
import { applicationScopeWhere } from "@/lib/phase2-scoping";
import { isPanelistOnInterview } from "@/lib/phase3-scoping";

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

/**
 * GET /api/v1/interviews/:id/panel — the assigned panel, standalone
 * from the interview-detail payload for panel-management UIs that only
 * need this slice.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(READ_ROLES);
    const { id } = await params;

    const interview = await prisma.interview.findUnique({
      where: { id },
      select: { id: true, applicationId: true },
    });
    if (!interview) {
      return fail("NOT_FOUND", "Interview not found.", 404);
    }

    const inScope = await prisma.application.findFirst({
      where: { id: interview.applicationId, ...applicationScopeWhere(user) },
      select: { id: true },
    });
    if (!inScope) {
      const isPanelist =
        user.role === Role.PANEL_MEMBER && (await isPanelistOnInterview(user, id));
      if (!isPanelist) {
        return fail("NOT_FOUND", "Interview not found.", 404);
      }
    }

    const panelists = await prisma.interviewPanelist.findMany({
      where: { interviewId: id },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { assignedAt: "asc" },
    });

    return ok(panelists);
  } catch (err) {
    return handleRouteError(err);
  }
}

const replacePanelSchema = z.object({
  panelUserIds: z.array(z.string().min(1)).min(1),
});

/**
 * PUT /api/v1/interviews/:id/panel — replaces the full panel roster
 * (simplest correct semantics for "manage panel assignment" — add/
 * remove-by-diff is left to the client, which just resends the desired
 * full list).
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(WRITE_ROLES);
    const { id } = await params;
    const body = replacePanelSchema.parse(await req.json());

    const interview = await prisma.interview.findFirst({
      where: { id, application: applicationScopeWhere(user) },
      select: { id: true, applicationId: true },
    });
    if (!interview) {
      return fail("NOT_FOUND", "Interview not found.", 404);
    }

    const panelUsers = await prisma.user.findMany({
      where: { id: { in: body.panelUserIds } },
      select: { id: true },
    });
    if (panelUsers.length !== new Set(body.panelUserIds).size) {
      return fail("NOT_FOUND", "One or more panel user ids do not exist.", 404);
    }

    const panelists = await prisma.$transaction(async (tx) => {
      await tx.interviewPanelist.deleteMany({ where: { interviewId: id } });
      await tx.interviewPanelist.createMany({
        data: body.panelUserIds.map((userId) => ({ interviewId: id, userId })),
      });
      return tx.interviewPanelist.findMany({
        where: { interviewId: id },
        include: { user: { select: { id: true, name: true } } },
      });
    });

    await writeAudit({
      actorId: user.userId,
      action: "INTERVIEW_PANEL_UPDATE",
      entityType: "Interview",
      entityId: id,
      metadata: { applicationId: interview.applicationId, panelUserIds: body.panelUserIds },
    });

    return ok(panelists);
  } catch (err) {
    return handleRouteError(err);
  }
}
