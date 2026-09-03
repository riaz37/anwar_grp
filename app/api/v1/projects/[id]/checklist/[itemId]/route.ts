import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/authz";
import { requireProjectPermission } from "@/lib/project-authz";
import { prisma } from "@/lib/prisma";
import { toggleChecklistItem } from "@/lib/checklist-engine";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";

const toggleSchema = z.object({
  checked: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const user = await requireAuth();
    requireProjectPermission(user, "TOGGLE_CHECKLIST_ITEM");
    const { id, itemId } = await params;
    const body = toggleSchema.parse(await req.json());

    const item = await prisma.stageGateChecklistItem.findUnique({
      where: { id: itemId },
    });
    if (!item || item.projectId !== id) {
      return fail("NOT_FOUND", "Checklist item not found.", 404);
    }

    const updated = await toggleChecklistItem({
      itemId,
      checked: body.checked,
      checkedById: user.userId,
    });

    await writeAudit({
      actorId: user.userId,
      action: "project.checklist_item_toggle",
      entityType: "StageGateChecklistItem",
      entityId: updated.id,
      metadata: { projectId: id, checked: body.checked, label: updated.label },
    });

    return ok(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}
