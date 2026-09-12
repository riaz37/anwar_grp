import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { autoResolveStaleFlags, upsertFlag } from "@/lib/agent-flags";
import { cleanupFixtureOrg, createFixtureOrg, createFixtureProject } from "../integration/setup-fixtures";

describe("upsertFlag", () => {
  let org: Awaited<ReturnType<typeof createFixtureOrg>>;

  beforeEach(async () => {
    org = await createFixtureOrg();
  });

  afterEach(async () => {
    await cleanupFixtureOrg(org);
  });

  it("throttles: calling it twice with the same (projectId, flagType, subjectId) updates rather than duplicates", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });

    await upsertFlag({
      projectId: project.id,
      flagType: "STUCK_MILESTONE",
      subjectId: "milestone-1",
      narration: "First narration.",
      narrationSource: "RULE_FALLBACK",
      severity: 1,
    });
    await upsertFlag({
      projectId: project.id,
      flagType: "STUCK_MILESTONE",
      subjectId: "milestone-1",
      narration: "Second narration.",
      narrationSource: "LLM",
      severity: 3,
    });

    const flags = await prisma.agentFlag.findMany({
      where: { projectId: project.id, flagType: "STUCK_MILESTONE", subjectId: "milestone-1" },
    });
    expect(flags).toHaveLength(1);
    expect(flags[0].narration).toBe("Second narration.");
    expect(flags[0].severity).toBe(3);
    expect(flags[0].narrationSource).toBe("LLM");
  });
});

describe("autoResolveStaleFlags", () => {
  let org: Awaited<ReturnType<typeof createFixtureOrg>>;

  beforeEach(async () => {
    org = await createFixtureOrg();
  });

  afterEach(async () => {
    await cleanupFixtureOrg(org);
  });

  it("resolves flags whose subject is no longer in the still-open list and leaves others untouched", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });

    const staleFlag = await upsertFlag({
      projectId: project.id,
      flagType: "STUCK_MILESTONE",
      subjectId: "milestone-stale",
      narration: "Stale.",
      narrationSource: "RULE_FALLBACK",
      severity: 2,
    });
    const stillOpenFlag = await upsertFlag({
      projectId: project.id,
      flagType: "STUCK_BLOCKER",
      subjectId: "blocker-still-open",
      narration: "Still open.",
      narrationSource: "RULE_FALLBACK",
      severity: 2,
    });

    const resolvedCount = await autoResolveStaleFlags(project.id, [
      { flagType: "STUCK_BLOCKER", subjectId: "blocker-still-open" },
    ]);
    expect(resolvedCount).toBe(1);

    const resolved = await prisma.agentFlag.findUniqueOrThrow({ where: { id: staleFlag.id } });
    expect(resolved.resolvedAt).not.toBeNull();
    expect(resolved.resolutionReason).toBe("CONDITION_CLEARED");

    const untouched = await prisma.agentFlag.findUniqueOrThrow({ where: { id: stillOpenFlag.id } });
    expect(untouched.resolvedAt).toBeNull();
    expect(untouched.resolutionReason).toBeNull();
  });

  it("resolves nothing and returns 0 when every open flag's subject is still in the still-open list", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });
    const flag = await upsertFlag({
      projectId: project.id,
      flagType: "OWNERSHIP_GAP",
      subjectId: project.id,
      narration: "Gap.",
      narrationSource: "RULE_FALLBACK",
      severity: 1,
    });

    const resolvedCount = await autoResolveStaleFlags(project.id, [
      { flagType: "OWNERSHIP_GAP", subjectId: project.id },
    ]);
    expect(resolvedCount).toBe(0);

    const untouched = await prisma.agentFlag.findUniqueOrThrow({ where: { id: flag.id } });
    expect(untouched.resolvedAt).toBeNull();
  });
});
