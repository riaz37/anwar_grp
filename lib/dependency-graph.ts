import "server-only";
import type { DependencyItemType } from "@prisma/client";
import { prisma } from "./prisma";

export interface DependencyEdge {
  dependentType: DependencyItemType;
  dependentId: string;
  dependsOnType: DependencyItemType;
  dependsOnId: string;
}

export type DependencyValidationCode =
  | "SELF_LOOP"
  | "DEPENDENT_NOT_FOUND"
  | "DEPENDS_ON_NOT_FOUND"
  | "DUPLICATE_EDGE"
  | "CYCLE";

export class DependencyValidationError extends Error {
  constructor(
    public readonly code: DependencyValidationCode,
    message: string,
  ) {
    super(message);
    this.name = "DependencyValidationError";
  }
}

function nodeKey(type: DependencyItemType, id: string): string {
  return `${type}:${id}`;
}

/**
 * Pure cycle check, no DB access: would adding `candidate` to `edges` create
 * a cycle? Forward-walks from the candidate's `dependsOn` node — if that walk
 * reaches the candidate's `dependent` node, the new edge would close a loop.
 * Exported separately from assertValidDependencyEdge so a client that has
 * already fetched a project's edge list can pre-check a pick before the
 * round trip to the server-side check below (the source of truth).
 */
export function wouldCreateCycle(
  edges: DependencyEdge[],
  candidate: Pick<DependencyEdge, "dependentType" | "dependentId" | "dependsOnType" | "dependsOnId">,
): boolean {
  const dependentKey = nodeKey(candidate.dependentType, candidate.dependentId);
  const dependsOnKey = nodeKey(candidate.dependsOnType, candidate.dependsOnId);
  if (dependentKey === dependsOnKey) return true;

  // dependent -> its existing predecessors, so a walk can follow the "depends
  // on" chain backward from any node to its ancestors.
  const predecessorsOf = new Map<string, string[]>();
  for (const edge of edges) {
    const dependent = nodeKey(edge.dependentType, edge.dependentId);
    const dependsOn = nodeKey(edge.dependsOnType, edge.dependsOnId);
    const list = predecessorsOf.get(dependent) ?? [];
    list.push(dependsOn);
    predecessorsOf.set(dependent, list);
  }

  // The candidate edge means dependentKey would depend on dependsOnKey. That
  // closes a cycle only if dependsOnKey already (transitively) depends on
  // dependentKey — walk dependsOnKey's ancestor chain looking for it.
  const visited = new Set<string>();
  const stack = [dependsOnKey];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (current === dependentKey) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const predecessor of predecessorsOf.get(current) ?? []) {
      stack.push(predecessor);
    }
  }
  return false;
}

async function itemExistsInProject(
  type: DependencyItemType,
  id: string,
  projectId: string,
): Promise<boolean> {
  if (type === "MILESTONE") {
    const milestone = await prisma.milestone.findFirst({
      where: { id, projectId },
      select: { id: true },
    });
    return milestone !== null;
  }
  const task = await prisma.projectTask.findFirst({
    where: { id, projectId },
    select: { id: true },
  });
  return task !== null;
}

/**
 * Validates a proposed dependency edge before it's inserted: no self-loop,
 * both items exist in the given project, no duplicate, and no cycle. Throws
 * DependencyValidationError on any failure. Shares its cycle-check shape
 * with the topological walk in lib/critical-path.ts, which trusts that
 * every stored edge already passed this check.
 */
export async function assertValidDependencyEdge(params: {
  projectId: string;
  dependentType: DependencyItemType;
  dependentId: string;
  dependsOnType: DependencyItemType;
  dependsOnId: string;
}): Promise<void> {
  const { projectId, dependentType, dependentId, dependsOnType, dependsOnId } = params;

  if (dependentType === dependsOnType && dependentId === dependsOnId) {
    throw new DependencyValidationError("SELF_LOOP", "An item cannot depend on itself.");
  }

  const [dependentExists, dependsOnExists] = await Promise.all([
    itemExistsInProject(dependentType, dependentId, projectId),
    itemExistsInProject(dependsOnType, dependsOnId, projectId),
  ]);
  if (!dependentExists) {
    throw new DependencyValidationError(
      "DEPENDENT_NOT_FOUND",
      "The dependent item was not found in this project.",
    );
  }
  if (!dependsOnExists) {
    throw new DependencyValidationError(
      "DEPENDS_ON_NOT_FOUND",
      "The item to depend on was not found in this project.",
    );
  }

  const existingEdges = await prisma.itemDependency.findMany({
    where: { projectId },
    select: { dependentType: true, dependentId: true, dependsOnType: true, dependsOnId: true },
  });

  const isDuplicate = existingEdges.some(
    (edge) =>
      edge.dependentType === dependentType &&
      edge.dependentId === dependentId &&
      edge.dependsOnType === dependsOnType &&
      edge.dependsOnId === dependsOnId,
  );
  if (isDuplicate) {
    throw new DependencyValidationError("DUPLICATE_EDGE", "This dependency already exists.");
  }

  if (wouldCreateCycle(existingEdges, { dependentType, dependentId, dependsOnType, dependsOnId })) {
    throw new DependencyValidationError(
      "CYCLE",
      "This dependency would create a cycle.",
    );
  }
}
