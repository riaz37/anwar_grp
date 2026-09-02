import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma, Role, CommunicationChannel, MessageTemplateCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { ok, handleRouteError } from "@/lib/api-response";
import { parsePagination } from "@/lib/pagination";
import { sanitizeAllowedFields } from "@/lib/message-templates";

// Anyone who might draft a candidate communication needs to be able to
// browse templates to pick one from; only TA_ADMIN/TECH_ADMIN can
// create/version them (BUILD_PLAN.md Sec 2.10: WhatsApp templates in
// particular are a Meta-approval artifact, not something a recruiter
// free-types — treating email templates the same way for one consistent
// review gate).
const READ_ROLES: Role[] = [
  Role.TA_ADMIN,
  Role.RECRUITER,
  Role.DEPT_HEAD,
  Role.HIRING_MANAGER,
  Role.HR_LEADERSHIP,
  Role.AUDIT_USER,
  Role.TECH_ADMIN,
];
const CREATE_ROLES: Role[] = [Role.TA_ADMIN, Role.TECH_ADMIN];

const listQuerySchema = z.object({
  channel: z.nativeEnum(CommunicationChannel).optional(),
  category: z.nativeEnum(MessageTemplateCategory).optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

export async function GET(req: NextRequest) {
  try {
    await requireRole(READ_ROLES);
    const { searchParams } = req.nextUrl;
    const filters = listQuerySchema.parse({
      channel: searchParams.get("channel") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      isActive: searchParams.get("isActive") ?? undefined,
    });
    const { skip, take, page, limit } = parsePagination(searchParams);

    const where: Prisma.MessageTemplateWhereInput = {
      ...(filters.channel && { channel: filters.channel }),
      ...(filters.category && { category: filters.category }),
      ...(filters.isActive !== undefined && { isActive: filters.isActive === "true" }),
    };

    const [total, templates] = await Promise.all([
      prisma.messageTemplate.count({ where }),
      prisma.messageTemplate.findMany({
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
  channel: z.nativeEnum(CommunicationChannel),
  category: z.nativeEnum(MessageTemplateCategory),
  subject: z.string().trim().max(300).optional(),
  bodyTemplate: z.string().trim().min(1).max(8000),
  allowedFields: z.array(z.string().min(1)).default([]),
});

/**
 * POST: creates a new (version 1) template. Configuration change, not a
 * deploy — TA_ADMIN/TECH_ADMIN only, mirroring BUILD_PLAN.md Sec 2.9's
 * "adding/changing a chain is a data change" philosophy applied here to
 * message templates.
 *
 * `allowedFields` is sanitized against the hardcoded safe-field
 * registry (lib/message-templates.ts) BEFORE it's persisted — an admin
 * cannot even successfully save a template claiming an unsafe field
 * (e.g. "internal_notes"), let alone have it render. Any submitted
 * field not in the registry is silently dropped and reported back in
 * `meta.droppedFields` so the admin knows their input was filtered.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(CREATE_ROLES);
    const body = createTemplateSchema.parse(await req.json());

    const sanitizedFields = sanitizeAllowedFields(body.allowedFields);
    const droppedFields = body.allowedFields.filter(
      (f) => !sanitizedFields.includes(f as never),
    );

    const template = await prisma.messageTemplate.create({
      data: {
        name: body.name,
        channel: body.channel,
        category: body.category,
        subject: body.channel === CommunicationChannel.EMAIL ? body.subject : undefined,
        bodyTemplate: body.bodyTemplate,
        allowedFields: sanitizedFields,
        createdById: user.userId,
      },
    });

    await writeAudit({
      actorId: user.userId,
      action: "MESSAGE_TEMPLATE_CREATE",
      entityType: "MessageTemplate",
      entityId: template.id,
      metadata: { channel: template.channel, category: template.category, droppedFields },
    });

    return ok(template, { status: 201, meta: { droppedFields } });
  } catch (err) {
    return handleRouteError(err);
  }
}
