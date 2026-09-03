import "server-only";
import { prisma } from "./prisma";
import { ProjectStage } from "@prisma/client";
import { STAGE_GATE_TEMPLATES } from "./stage-gate-templates";

export { STAGE_GATE_TEMPLATES } from "./stage-gate-templates";
export type { ChecklistTemplateItem } from "./stage-gate-templates";

/**
 * Seeds the fixed template for `stage` onto `projectId`, if that stage
 * has one and it hasn't already been seeded. Idempotent — safe to call
 * every time a project enters a stage (on creation for IDEA's
 * successor stages is not needed since IDEA has no template; called
 * from lib/project-stages.ts on every forward transition).
 */
export async function seedStageGateChecklist(
  projectId: string,
  stage: ProjectStage,
): Promise<void> {
  const template = STAGE_GATE_TEMPLATES[stage];
  if (!template || template.length === 0) return;

  const existing = await prisma.stageGateChecklistItem.count({
    where: { projectId, stage },
  });
  if (existing > 0) return;

  await prisma.stageGateChecklistItem.createMany({
    data: template.map((item) => ({
      projectId,
      stage,
      label: item.label,
      required: item.required,
    })),
  });
}

/**
 * A stage with no checklist items at all is vacuously satisfied — only
 * stages with a fixed template (see above) actually gate the
 * transition out of them.
 */
export async function isStageGateSatisfied(
  projectId: string,
  stage: ProjectStage,
): Promise<boolean> {
  const outstanding = await prisma.stageGateChecklistItem.count({
    where: { projectId, stage, required: true, checked: false },
  });
  return outstanding === 0;
}

export interface ChecklistReadiness {
  total: number;
  checked: number;
  percent: number;
}

export async function computeChecklistReadiness(
  projectId: string,
  stage: ProjectStage,
): Promise<ChecklistReadiness> {
  const items = await prisma.stageGateChecklistItem.findMany({
    where: { projectId, stage },
  });
  const total = items.length;
  const checked = items.filter((item) => item.checked).length;
  return {
    total,
    checked,
    percent: total === 0 ? 100 : Math.round((checked / total) * 100),
  };
}

/**
 * Toggles one checklist item's checked state. Returns the updated row.
 * Caller (route handler) is responsible for authz and audit logging.
 */
export async function toggleChecklistItem(params: {
  itemId: string;
  checked: boolean;
  checkedById: string | null;
}) {
  return prisma.stageGateChecklistItem.update({
    where: { id: params.itemId },
    data: {
      checked: params.checked,
      checkedById: params.checked ? params.checkedById : null,
      checkedAt: params.checked ? new Date() : null,
    },
  });
}
