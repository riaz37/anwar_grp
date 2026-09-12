import "server-only";
import type { MilestoneStatus, TaskStatus } from "@prisma/client";
import { prisma } from "./prisma";

export type CriticalPathItemType = "MILESTONE" | "TASK";

export interface CriticalPathItem {
  id: string;
  type: CriticalPathItemType;
  label: string;
  /** ISO date string, or null for an ad hoc task with no deadline. */
  date: string | null;
  ownerName: string;
  status: MilestoneStatus | TaskStatus;
  /** The item this one's date is chained off, or null if it's a chain root. */
  dependsOnId: string | null;
  isCriticalPath: boolean;
}

export interface CriticalPathResult {
  items: CriticalPathItem[];
  criticalPathIds: string[];
  expectedDeliveryDate: string;
}

interface Node {
  id: string;
  type: CriticalPathItemType;
  label: string;
  date: Date | null;
  ownerName: string;
  status: MilestoneStatus | TaskStatus;
  dependsOnId: string | null;
}

/**
 * Computes the chain of milestones/tasks whose due-date chain is the
 * binding constraint on a project's `expectedDeliveryDate`
 * (AGENTIC_DASHBOARD_PLAN.md Group F) — a simple longest-path-by-date
 * walk, not a generic CPM/PERT solver.
 *
 * Dependency edges:
 * - Milestones have no explicit dependency field (the schema's "One Next
 *   Milestone" design means there's only ever one active milestone at a
 *   time), so due-date order stands in for the sequential spine: each
 *   milestone depends on the one immediately before it.
 * - A task depends on `relatedMilestoneId` when set; an ad hoc task with
 *   neither a milestone link nor its own deadline can't participate in a
 *   date chain at all and is returned with `date: null`.
 *
 * The critical path is the chain ending at the node with the latest
 * effective date (own date, or its dependency's effective date if later)
 * — walked back to its root via `dependsOnId`.
 */
export async function getCriticalPath(projectId: string): Promise<CriticalPathResult> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { expectedDeliveryDate: true },
  });

  const [milestones, tasks] = await Promise.all([
    prisma.milestone.findMany({
      where: { projectId },
      orderBy: { dueDate: "asc" },
      include: { owner: { select: { name: true } } },
    }),
    prisma.projectTask.findMany({
      where: { projectId },
      orderBy: { deadline: "asc" },
      include: { owner: { select: { name: true } } },
    }),
  ]);

  const nodes: Node[] = [];

  let previousMilestoneId: string | null = null;
  for (const m of milestones) {
    nodes.push({
      id: m.id,
      type: "MILESTONE",
      label: m.name,
      date: m.dueDate,
      ownerName: m.owner.name,
      status: m.status,
      dependsOnId: previousMilestoneId,
    });
    previousMilestoneId = m.id;
  }

  for (const t of tasks) {
    nodes.push({
      id: t.id,
      type: "TASK",
      label: t.action,
      date: t.deadline,
      ownerName: t.owner.name,
      status: t.status,
      dependsOnId: t.relatedMilestoneId,
    });
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const datedNodes = nodes
    .filter((n): n is Node & { date: Date } => n.date !== null)
    // Ascending date order guarantees every node's dependency (an earlier
    // milestone, or the milestone a task is related to) is resolved first.
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const effectiveDate = new Map<string, number>();
  const chainLength = new Map<string, number>();

  for (const node of datedNodes) {
    const dep = node.dependsOnId ? nodeById.get(node.dependsOnId) : undefined;
    const depEffective = dep ? effectiveDate.get(dep.id) : undefined;
    const ownTime = node.date.getTime();
    effectiveDate.set(
      node.id,
      depEffective !== undefined ? Math.max(ownTime, depEffective) : ownTime,
    );
    chainLength.set(node.id, dep ? (chainLength.get(dep.id) ?? 1) + 1 : 1);
  }

  let terminalId: string | null = null;
  for (const node of datedNodes) {
    if (!terminalId) {
      terminalId = node.id;
      continue;
    }
    const currentEff = effectiveDate.get(terminalId) ?? 0;
    const nodeEff = effectiveDate.get(node.id) ?? 0;
    const currentLen = chainLength.get(terminalId) ?? 0;
    const nodeLen = chainLength.get(node.id) ?? 0;
    if (nodeEff > currentEff || (nodeEff === currentEff && nodeLen > currentLen)) {
      terminalId = node.id;
    }
  }

  const criticalPathIds = new Set<string>();
  let cursor = terminalId;
  while (cursor) {
    criticalPathIds.add(cursor);
    cursor = nodeById.get(cursor)?.dependsOnId ?? null;
  }

  const items: CriticalPathItem[] = nodes.map((n) => ({
    id: n.id,
    type: n.type,
    label: n.label,
    date: n.date ? n.date.toISOString() : null,
    ownerName: n.ownerName,
    status: n.status,
    dependsOnId: n.dependsOnId,
    isCriticalPath: criticalPathIds.has(n.id),
  }));

  return {
    items,
    criticalPathIds: [...criticalPathIds],
    expectedDeliveryDate: project.expectedDeliveryDate.toISOString(),
  };
}
