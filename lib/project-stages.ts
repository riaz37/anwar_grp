import "server-only";
import { prisma } from "./prisma";
import { ProjectStage } from "@prisma/client";
import { isStageGateSatisfied, seedStageGateChecklist } from "./checklist-engine";
import { recomputeProjectHealth } from "./project-health";
import { writeAudit } from "./audit";
import type { SessionPayload } from "./session";

/**
 * Assignment Sec 3, verbatim order. Every forward transition moves
 * exactly one step — stages cannot be skipped, and there is no
 * backward transition (a project that needs to redo work stays in its
 * current stage and reopens checklist items instead).
 */
export const STAGE_ORDER: ProjectStage[] = [
  "IDEA",
  "DISCOVERY",
  "REQUIREMENTS_DESIGN",
  "APPROVAL",
  "DEVELOPMENT",
  "INTERNAL_TESTING",
  "BUSINESS_TESTING_UAT",
  "DEPLOYMENT",
  "STABILIZATION",
  "COMPLETED",
];

export class StageTransitionError extends Error {}

export function nextStage(stage: ProjectStage): ProjectStage | null {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx === -1 || idx === STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

/**
 * The only way Project.currentStage should ever change. Enforces:
 *  - forward-only, one stage at a time (no skipping, no going back)
 *  - all required=true StageGateChecklistItem rows for the *current*
 *    stage must be checked (a stage with no template is vacuously
 *    satisfied — see lib/checklist-engine.ts)
 * On success: writes an evidence-snapshotted ProjectStageHistory row,
 * advances currentStage, seeds the new stage's checklist template (if
 * any), recomputes health, and writes an audit log entry.
 */
export async function transitionProjectStage(params: {
  projectId: string;
  toStage: ProjectStage;
  actor: SessionPayload;
  notes?: string;
}) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: params.projectId },
  });

  const fromIdx = STAGE_ORDER.indexOf(project.currentStage);
  const toIdx = STAGE_ORDER.indexOf(params.toStage);

  if (toIdx === -1) {
    throw new StageTransitionError(`Unknown stage: ${params.toStage}`);
  }
  if (toIdx <= fromIdx) {
    throw new StageTransitionError(
      "A project can only move forward — it cannot re-enter its current or a prior stage.",
    );
  }
  if (toIdx !== fromIdx + 1) {
    throw new StageTransitionError(
      "Stages cannot be skipped — advance one stage at a time.",
    );
  }

  const gateSatisfied = await isStageGateSatisfied(
    project.id,
    project.currentStage,
  );
  if (!gateSatisfied) {
    throw new StageTransitionError(
      `All required checklist items for ${project.currentStage} must be checked before advancing.`,
    );
  }

  const evidenceSnapshot = await prisma.stageGateChecklistItem.findMany({
    where: { projectId: project.id, stage: project.currentStage },
  });

  const [, updatedProject] = await prisma.$transaction([
    prisma.projectStageHistory.create({
      data: {
        projectId: project.id,
        fromStage: project.currentStage,
        toStage: params.toStage,
        actorId: params.actor.userId,
        notes: params.notes,
        evidenceSnapshot: JSON.parse(JSON.stringify(evidenceSnapshot)),
      },
    }),
    prisma.project.update({
      where: { id: project.id },
      data: { currentStage: params.toStage, version: { increment: 1 } },
    }),
  ]);

  await seedStageGateChecklist(project.id, params.toStage);
  await recomputeProjectHealth(project.id);
  await writeAudit({
    actorId: params.actor.userId,
    action: "project.stage_transition",
    entityType: "Project",
    entityId: project.id,
    metadata: {
      fromStage: project.currentStage,
      toStage: params.toStage,
      notes: params.notes ?? null,
    },
  });

  return updatedProject;
}
