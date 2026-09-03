import "server-only";
import { prisma } from "./prisma";
import { ProjectHealth } from "@prisma/client";

/** A milestone due within this many days (and not yet DONE) puts the project AT_RISK. */
export const AT_RISK_WINDOW_DAYS = 3;

export function isMilestoneOverdue(milestone: {
  dueDate: Date;
  status: string;
}): boolean {
  return milestone.status !== "DONE" && milestone.dueDate.getTime() < Date.now();
}

export function isMilestoneAtRisk(milestone: {
  dueDate: Date;
  status: string;
}): boolean {
  if (milestone.status === "DONE") return false;
  const msUntilDue = milestone.dueDate.getTime() - Date.now();
  return msUntilDue >= 0 && msUntilDue <= AT_RISK_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Pure computation of what a project's health *should* be right now,
 * from its current blockers and milestones. Priority order (highest
 * wins): BLOCKED > DELAYED > AT_RISK > ON_TRACK — an active blocker
 * always dominates a merely-overdue milestone, since a blocker
 * represents something nobody can act on unilaterally.
 */
export async function computeProjectHealth(
  projectId: string,
): Promise<ProjectHealth> {
  const activeBlockerCount = await prisma.blocker.count({
    where: { projectId, resolvedAt: null },
  });
  if (activeBlockerCount > 0) return "BLOCKED";

  const milestones = await prisma.milestone.findMany({
    where: { projectId, status: { not: "DONE" } },
    select: { dueDate: true, status: true },
  });

  if (milestones.some((m) => isMilestoneOverdue(m))) return "DELAYED";
  if (milestones.some((m) => isMilestoneAtRisk(m))) return "AT_RISK";
  return "ON_TRACK";
}

/** Recomputes and persists Project.health. Call after any write that could change it. */
export async function recomputeProjectHealth(
  projectId: string,
): Promise<ProjectHealth> {
  const health = await computeProjectHealth(projectId);
  await prisma.project.update({
    where: { id: projectId },
    data: { health },
  });
  return health;
}

/**
 * Milestones that are overdue but have never had a DelayReason
 * recorded against them — per assignment Sec 8, an overdue milestone
 * must have its delay reason captured, not just render red. Routes
 * that mutate a milestone should call this and reject (422) if the
 * request doesn't also supply a delay reason for a milestone that
 * needs one.
 */
export async function milestoneRequiresDelayReason(
  milestoneId: string,
): Promise<boolean> {
  const milestone = await prisma.milestone.findUniqueOrThrow({
    where: { id: milestoneId },
  });
  if (!isMilestoneOverdue(milestone)) return false;

  const existingReason = await prisma.delayReason.findFirst({
    where: { milestoneId },
  });
  return existingReason === null;
}
