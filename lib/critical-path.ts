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
  /** Every item this one is blocked on. Milestones and tasks can each have
   *  zero, one, or many predecessors — this is a real dependency graph, not
   *  a single-parent chain. */
  dependsOnIds: string[];
  /** 0-100 for tasks; null for milestones, which stay binary (done or not)
   *  per the "one active milestone" design below. */
  progressPercent: number | null;
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
  progressPercent: number | null;
  dependsOnIds: string[];
}

/**
 * Computes the chain of milestones/tasks whose due-date chain is the
 * binding constraint on a project's `expectedDeliveryDate`
 * (AGENTIC_DASHBOARD_PLAN.md Group F) — a topological longest-path walk
 * over the project's ItemDependency edges, not a generic CPM/PERT solver.
 *
 * Dependency edges come from the `ItemDependency` table (see
 * lib/dependency-graph.ts, which validates every edge at write time —
 * no self-loops, no cross-project edges, no cycles). Each node here can
 * have any number of predecessors.
 */
export async function getCriticalPath(projectId: string): Promise<CriticalPathResult> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { expectedDeliveryDate: true },
  });

  const [milestones, tasks, dependencies] = await Promise.all([
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
    prisma.itemDependency.findMany({ where: { projectId } }),
  ]);

  const dependsOnByNodeId = new Map<string, string[]>();
  for (const edge of dependencies) {
    const list = dependsOnByNodeId.get(edge.dependentId) ?? [];
    list.push(edge.dependsOnId);
    dependsOnByNodeId.set(edge.dependentId, list);
  }

  const nodes: Node[] = [
    ...milestones.map((m): Node => ({
      id: m.id,
      type: "MILESTONE",
      label: m.name,
      date: m.dueDate,
      ownerName: m.owner.name,
      status: m.status,
      progressPercent: null,
      dependsOnIds: dependsOnByNodeId.get(m.id) ?? [],
    })),
    ...tasks.map((t): Node => ({
      id: t.id,
      type: "TASK",
      label: t.action,
      date: t.deadline,
      ownerName: t.owner.name,
      status: t.status,
      progressPercent: t.progressPercent,
      dependsOnIds: dependsOnByNodeId.get(t.id) ?? [],
    })),
  ];

  const { criticalPathIds } = computeCriticalPath(
    nodes.map((n) => ({ id: n.id, date: n.date, dependsOnIds: n.dependsOnIds })),
  );

  const items: CriticalPathItem[] = nodes.map((n) => ({
    id: n.id,
    type: n.type,
    label: n.label,
    date: n.date ? n.date.toISOString() : null,
    ownerName: n.ownerName,
    status: n.status,
    progressPercent: n.progressPercent,
    dependsOnIds: n.dependsOnIds,
    isCriticalPath: criticalPathIds.has(n.id),
  }));

  return {
    items,
    criticalPathIds: [...criticalPathIds],
    expectedDeliveryDate: project.expectedDeliveryDate.toISOString(),
  };
}

export interface CriticalPathNodeInput {
  id: string;
  date: Date | null;
  /** Predecessor ids; ids that don't correspond to another node in this
   *  call are ignored (defensive — e.g. a stale edge to a deleted item). */
  dependsOnIds: string[];
}

/**
 * Pure topological longest-path computation, no DB access — kept separate
 * from getCriticalPath so it's unit-testable without Prisma.
 *
 * Kahn's algorithm for topo order, then a longest-path-by-date DP over that
 * order: each node's effective date is the later of its own date or its
 * latest predecessor's effective date. The critical path is the chain
 * ending at whichever node has the latest effective date (ties broken by
 * the longer chain), walked back via each node's *binding* predecessor —
 * the one whose effective date actually set its successor's.
 *
 * If the input edges contain a cycle (should be impossible: every stored
 * edge is validated by lib/dependency-graph.ts before insert), Kahn's
 * algorithm simply leaves those nodes unprocessed; they're treated as
 * unscheduled rather than causing an infinite loop or a thrown error, so a
 * bad row can never crash a Gantt render.
 */
export function computeCriticalPath(nodes: CriticalPathNodeInput[]): {
  criticalPathIds: Set<string>;
} {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const dependsOnIds = new Map<string, string[]>(
    nodes.map((n) => [n.id, n.dependsOnIds.filter((id) => nodeIds.has(id) && id !== n.id)]),
  );

  const successors = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const node of nodes) {
    inDegree.set(node.id, dependsOnIds.get(node.id)?.length ?? 0);
  }
  for (const node of nodes) {
    for (const dep of dependsOnIds.get(node.id) ?? []) {
      const list = successors.get(dep) ?? [];
      list.push(node.id);
      successors.set(dep, list);
    }
  }

  const queue: string[] = [];
  for (const node of nodes) {
    if ((inDegree.get(node.id) ?? 0) === 0) queue.push(node.id);
  }

  const topoOrder: string[] = [];
  const remainingInDegree = new Map(inDegree);
  while (queue.length > 0) {
    const id = queue.shift() as string;
    topoOrder.push(id);
    for (const successorId of successors.get(id) ?? []) {
      const next = (remainingInDegree.get(successorId) ?? 0) - 1;
      remainingInDegree.set(successorId, next);
      if (next === 0) queue.push(successorId);
    }
  }
  // Nodes left out of topoOrder are part of a cycle in the stored data;
  // drop them rather than process them out of dependency order.
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const effectiveDate = new Map<string, number>();
  const chainLength = new Map<string, number>();

  for (const id of topoOrder) {
    const node = nodeById.get(id);
    if (!node) continue;
    const ownTime = node.date?.getTime() ?? Number.NEGATIVE_INFINITY;
    const deps = dependsOnIds.get(id) ?? [];
    let best = ownTime;
    let bestChain = deps.length === 0 ? 1 : 0;
    for (const dep of deps) {
      const depEff = effectiveDate.get(dep) ?? Number.NEGATIVE_INFINITY;
      if (depEff > best) best = depEff;
      const candidateChain = (chainLength.get(dep) ?? 0) + 1;
      if (candidateChain > bestChain) bestChain = candidateChain;
    }
    effectiveDate.set(id, best);
    chainLength.set(id, bestChain);
  }

  let terminalId: string | null = null;
  for (const id of topoOrder) {
    const eff = effectiveDate.get(id) ?? Number.NEGATIVE_INFINITY;
    if (eff === Number.NEGATIVE_INFINITY) continue;
    if (!terminalId) {
      terminalId = id;
      continue;
    }
    const currentEff = effectiveDate.get(terminalId) ?? Number.NEGATIVE_INFINITY;
    const currentLen = chainLength.get(terminalId) ?? 0;
    const len = chainLength.get(id) ?? 0;
    if (eff > currentEff || (eff === currentEff && len > currentLen)) {
      terminalId = id;
    }
  }

  const criticalPathIds = new Set<string>();
  let cursor: string | null = terminalId;
  while (cursor) {
    criticalPathIds.add(cursor);
    const deps = dependsOnIds.get(cursor) ?? [];
    if (deps.length === 0) break;
    // The binding predecessor: whichever dependency has the latest effective
    // date (tie-broken by the longer chain) — the same comparison used to
    // pick the terminal node above, applied one hop at a time so
    // reconstruction always continues down a single connected path.
    let next = deps[0];
    for (const dep of deps.slice(1)) {
      const depEff = effectiveDate.get(dep) ?? Number.NEGATIVE_INFINITY;
      const nextEff = effectiveDate.get(next) ?? Number.NEGATIVE_INFINITY;
      const depLen = chainLength.get(dep) ?? 0;
      const nextLen = chainLength.get(next) ?? 0;
      if (depEff > nextEff || (depEff === nextEff && depLen > nextLen)) {
        next = dep;
      }
    }
    cursor = next;
  }

  return { criticalPathIds };
}
