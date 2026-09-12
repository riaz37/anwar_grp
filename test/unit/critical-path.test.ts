import { describe, expect, it } from "vitest";
import { computeCriticalPath, type CriticalPathNodeInput } from "@/lib/critical-path";

function day(offset: number): Date {
  return new Date(Date.UTC(2026, 0, 1 + offset));
}

describe("computeCriticalPath", () => {
  it("walks a single-predecessor chain, matching the old date-order behavior", () => {
    const nodes: CriticalPathNodeInput[] = [
      { id: "a", date: day(1), dependsOnIds: [] },
      { id: "b", date: day(2), dependsOnIds: ["a"] },
      { id: "c", date: day(3), dependsOnIds: ["b"] },
    ];
    const { criticalPathIds } = computeCriticalPath(nodes);
    expect(criticalPathIds).toEqual(new Set(["a", "b", "c"]));
  });

  it("resolves a multi-predecessor node to its binding (later) predecessor", () => {
    // c depends on both a (day 1) and b (day 5) — b is binding.
    const nodes: CriticalPathNodeInput[] = [
      { id: "a", date: day(1), dependsOnIds: [] },
      { id: "b", date: day(5), dependsOnIds: [] },
      { id: "c", date: day(6), dependsOnIds: ["a", "b"] },
    ];
    const { criticalPathIds } = computeCriticalPath(nodes);
    expect(criticalPathIds).toEqual(new Set(["b", "c"]));
    expect(criticalPathIds.has("a")).toBe(false);
  });

  it("excludes a disconnected, undated node from the critical path", () => {
    const nodes: CriticalPathNodeInput[] = [
      { id: "a", date: day(1), dependsOnIds: [] },
      { id: "b", date: day(2), dependsOnIds: ["a"] },
      { id: "ad-hoc", date: null, dependsOnIds: [] },
    ];
    const { criticalPathIds } = computeCriticalPath(nodes);
    expect(criticalPathIds).toEqual(new Set(["a", "b"]));
  });

  it("picks the longer chain when two terminal nodes tie on effective date", () => {
    // Two independent chains ending on the same date; the three-node chain
    // should win over the one-node chain.
    const nodes: CriticalPathNodeInput[] = [
      { id: "x1", date: day(1), dependsOnIds: [] },
      { id: "x2", date: day(2), dependsOnIds: ["x1"] },
      { id: "x3", date: day(3), dependsOnIds: ["x2"] },
      { id: "y1", date: day(3), dependsOnIds: [] },
    ];
    const { criticalPathIds } = computeCriticalPath(nodes);
    expect(criticalPathIds).toEqual(new Set(["x1", "x2", "x3"]));
  });

  it("degrades gracefully instead of hanging on a cyclic edge set", () => {
    // Constructed directly to bypass the insert-time cycle guard
    // (lib/dependency-graph.ts) and exercise the algorithm's own defense.
    const nodes: CriticalPathNodeInput[] = [
      { id: "a", date: day(1), dependsOnIds: ["c"] },
      { id: "b", date: day(2), dependsOnIds: ["a"] },
      { id: "c", date: day(3), dependsOnIds: ["b"] },
    ];
    const { criticalPathIds } = computeCriticalPath(nodes);
    // No node in a 3-cycle ever reaches in-degree 0, so none are scheduled.
    expect(criticalPathIds.size).toBe(0);
  });
});
