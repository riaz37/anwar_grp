import { NextRequest, after } from "next/server";
import { z } from "zod";
import { AuthzError, requireAuth } from "@/lib/authz";
import { requireProjectPermission, requireProjectParticipant } from "@/lib/project-authz";
import { prisma } from "@/lib/prisma";
import { toggleChecklistItem } from "@/lib/checklist-engine";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";

const toggleSchema = z.object({
  checked: z.boolean(),
});

// This single checklist item is the system's only record that the
// Business Owner actually approved the solution (assignment Sec 9:
// "Business Owner ... perform UAT; approve the completed solution").
// TOGGLE_CHECKLIST_ITEM is deliberately broad (AI_ANALYST/DEVELOPER/
// BUSINESS_OWNER/AI_TEAM_LEAD can all check off ordinary evidence
// items), but this specific label must not be self-certifiable by the
// people who built/tested the thing being approved — otherwise a
// Developer or AI Analyst could unilaterally clear the UAT gate and
// deploy without the Business Owner ever acting.
const BUSINESS_APPROVAL_LABEL = "Business approval received";
const BUSINESS_APPROVAL_ROLES = ["BUSINESS_OWNER", "AI_TEAM_LEAD"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const user = await requireAuth();
    requireProjectPermission(user, "TOGGLE_CHECKLIST_ITEM");
    const { id, itemId } = await params;
    await requireProjectParticipant(user, id);
    const body = toggleSchema.parse(await req.json());

    const item = await prisma.stageGateChecklistItem.findUnique({
      where: { id: itemId },
    });
    if (!item || item.projectId !== id) {
      return fail("NOT_FOUND", "Checklist item not found.", 404);
    }

    if (
      item.label === BUSINESS_APPROVAL_LABEL &&
      !(BUSINESS_APPROVAL_ROLES as readonly string[]).includes(user.role)
    ) {
      throw new AuthzError(
        "Only the Business Owner (or AI Team Lead) can record business approval.",
        403,
        "FORBIDDEN",
      );
    }

    const updated = await toggleChecklistItem({
      itemId,
      checked: body.checked,
      checkedById: user.userId,
    });

    // Deferred: the client doesn't need to wait on the audit write to see
    // its own change take effect. Cuts one cross-region round trip off the
    // perceived latency of every checklist toggle.
    after(() =>
      writeAudit({
        actorId: user.userId,
        action: "project.checklist_item_toggle",
        entityType: "StageGateChecklistItem",
        entityId: updated.id,
        metadata: { projectId: id, checked: body.checked, label: updated.label },
      }),
    );

    return ok(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
