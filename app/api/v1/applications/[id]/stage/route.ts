import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma, Role, ApplicationStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";
import { applicationScopeWhere } from "@/lib/phase2-scoping";
import { isValidStageTransition } from "@/lib/application-stages";
import { buildDefaultChecklistItems } from "@/lib/joining-checklist";

const STAGE_CHANGE_ROLES: Role[] = [
  Role.TA_ADMIN,
  Role.RECRUITER,
  Role.DEPT_HEAD,
  Role.HIRING_MANAGER,
];

const stageChangeSchema = z.object({
  version: z.number().int().min(1),
  toStage: z.nativeEnum(ApplicationStage),
  notes: z.string().trim().max(2000).optional(),
  // "What happens next" is updated atomically with the stage change
  // (BUILD_PLAN.md treats these as one update) — all optional/nullable
  // so a stage change can also just clear a stale next action.
  nextAction: z.string().trim().max(500).nullable().optional(),
  nextActionOwnerId: z.string().min(1).nullable().optional(),
  nextActionDueDate: z.coerce.date().nullable().optional(),
});

/**
 * PATCH /api/v1/applications/:id/stage
 *
 * Version-locked. Validates the transition is one of the allowed
 * pipeline moves (lib/application-stages.ts), writes a StageHistory row
 * AND an audit log entry, and updates nextAction/nextActionOwnerId/
 * nextActionDueDate in the same call/transaction.
 *
 * Phase 6: also seeds the default joining checklist (the fixed 13-item
 * PDF list, lib/joining-checklist.ts) the first time an application
 * transitions INTO JOINING, if it has no checklist items yet — see the
 * transaction body below. This was chosen over lazily seeding on first
 * GET /joining-checklist so the checklist exists immediately once an
 * application reaches JOINING, matching the PDF's "assign joining
 * tasks" framing as something that happens as part of reaching that
 * stage, not on-demand.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(STAGE_CHANGE_ROLES);
    const { id } = await params;
    const body = stageChangeSchema.parse(await req.json());

    const existing = await prisma.application.findFirst({
      where: { id, ...applicationScopeWhere(user) },
    });
    if (!existing) {
      return fail("NOT_FOUND", "Application not found.", 404);
    }

    if (!isValidStageTransition(existing.currentStage, body.toStage)) {
      return fail(
        "INVALID_TRANSITION",
        `Cannot move an application from ${existing.currentStage} to ${body.toStage}.`,
        400,
      );
    }

    if (body.nextActionOwnerId) {
      const owner = await prisma.user.findUnique({
        where: { id: body.nextActionOwnerId },
      });
      if (!owner) {
        return fail("NOT_FOUND", "Next-action owner not found.", 404);
      }
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const application = await tx.application.update({
          where: { id, version: body.version },
          data: {
            currentStage: body.toStage,
            version: { increment: 1 },
            ...(body.nextAction !== undefined && { nextAction: body.nextAction }),
            ...(body.nextActionOwnerId !== undefined && {
              nextActionOwnerId: body.nextActionOwnerId,
            }),
            ...(body.nextActionDueDate !== undefined && {
              nextActionDueDate: body.nextActionDueDate,
            }),
          },
        });

        await tx.stageHistory.create({
          data: {
            applicationId: application.id,
            fromStage: existing.currentStage,
            toStage: body.toStage,
            changedById: user.userId,
            notes: body.notes,
          },
        });

        // Phase 6: seed the default joining checklist (PDF's fixed
        // 13-item list, lib/joining-checklist.ts) the first time this
        // application reaches JOINING — but only if it doesn't already
        // have checklist items (e.g. a JOINING -> ON_HOLD -> JOINING
        // loop shouldn't re-seed and duplicate items).
        if (
          body.toStage === ApplicationStage.JOINING &&
          existing.currentStage !== ApplicationStage.JOINING
        ) {
          const existingItemCount = await tx.joiningChecklistItem.count({
            where: { applicationId: application.id },
          });
          if (existingItemCount === 0) {
            await tx.joiningChecklistItem.createMany({
              data: buildDefaultChecklistItems({
                applicationId: application.id,
                defaultOwnerId: application.assignedRecruiterId,
                createdById: user.userId,
              }),
            });
          }
        }

        return application;
      });

      await writeAudit({
        actorId: user.userId,
        action: "APPLICATION_STAGE_CHANGE",
        entityType: "Application",
        entityId: updated.id,
        metadata: {
          from: existing.currentStage,
          to: body.toStage,
          nextAction: updated.nextAction,
          nextActionOwnerId: updated.nextActionOwnerId,
          nextActionDueDate: updated.nextActionDueDate,
        },
      });

      return ok(updated);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        return fail(
          "VERSION_CONFLICT",
          "This application was updated by someone else. Reload and try again.",
          409,
        );
      }
      throw err;
    }
  } catch (err) {
    return handleRouteError(err);
  }
}
