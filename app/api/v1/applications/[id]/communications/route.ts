import { NextRequest } from "next/server";
import { z } from "zod";
import { Role, CommunicationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";
import { applicationScopeWhere } from "@/lib/phase2-scoping";
import { renderTemplate, SAFE_FIELD_REGISTRY } from "@/lib/message-templates";

const READ_ROLES: Role[] = [
  Role.TA_ADMIN,
  Role.RECRUITER,
  Role.DEPT_HEAD,
  Role.HIRING_MANAGER,
  Role.HR_LEADERSHIP,
  Role.AUDIT_USER,
  Role.TECH_ADMIN,
];
// Who may draft a candidate communication for an application — the
// recruiter (day-to-day) or their department/admin chain. Approval is a
// separate, narrower gate (see communications/:id/approve/route.ts).
const DRAFT_ROLES: Role[] = [
  Role.TA_ADMIN,
  Role.RECRUITER,
  Role.DEPT_HEAD,
  Role.HIRING_MANAGER,
];

// Context is restricted to exactly the safe-field registry keys — see
// lib/message-templates.ts's doc comment for the full security
// argument. There is no way to pass an "internal_notes" or
// "rejection_reason" key through this schema at all; zod strips unknown
// keys by default.
const contextSchema = z
  .object(
    Object.fromEntries(
      SAFE_FIELD_REGISTRY.map((field) => [field, z.string().trim().max(2000).optional()]),
    ),
  )
  .partial();

const draftCommunicationSchema = z.object({
  templateId: z.string().min(1),
  context: contextSchema.default({}),
});

/**
 * POST /api/v1/applications/:id/communications — drafts a communication
 * from a template + context (status=DRAFTED). Renders and snapshots the
 * content immediately (renderedSubject/renderedBody) so later template
 * edits never retroactively change what was actually sent/approved.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(DRAFT_ROLES);
    const { id } = await params;
    const body = draftCommunicationSchema.parse(await req.json());

    const application = await prisma.application.findFirst({
      where: { id, ...applicationScopeWhere(user) },
      select: { id: true },
    });
    if (!application) {
      return fail("NOT_FOUND", "Application not found.", 404);
    }

    const template = await prisma.messageTemplate.findUnique({
      where: { id: body.templateId },
    });
    if (!template || !template.isActive) {
      return fail("NOT_FOUND", "Message template not found or inactive.", 404);
    }

    const { renderedSubject, renderedBody } = renderTemplate(template, body.context);

    const communication = await prisma.communication.create({
      data: {
        applicationId: id,
        templateId: template.id,
        channel: template.channel,
        status: CommunicationStatus.DRAFTED,
        renderedSubject,
        renderedBody,
        draftedById: user.userId,
      },
    });

    await writeAudit({
      actorId: user.userId,
      action: "COMMUNICATION_DRAFT",
      entityType: "Communication",
      entityId: communication.id,
      metadata: { applicationId: id, templateId: template.id, channel: template.channel },
    });

    return ok(communication, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** GET: all communications drafted for an application, newest first —
 * useful for polling Drafted -> ... -> Sent/Delivered/Failed status. */
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

    const communications = await prisma.communication.findMany({
      where: { applicationId: id },
      include: {
        template: { select: { id: true, name: true, category: true } },
        draftedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok(communications);
  } catch (err) {
    return handleRouteError(err);
  }
}
