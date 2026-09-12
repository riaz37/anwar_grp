import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getProjectTimeline } from "@/lib/project-memory";
import { recordRiskStatusChange } from "@/lib/risk-engine";
import { upsertFlag } from "@/lib/agent-flags";
import { cleanupFixtureOrg, createFixtureOrg, createFixtureProject } from "../integration/setup-fixtures";

describe("getProjectTimeline", () => {
  let org: Awaited<ReturnType<typeof createFixtureOrg>>;

  beforeEach(async () => {
    org = await createFixtureOrg();
  });

  afterEach(async () => {
    await cleanupFixtureOrg(org);
  });

  it("merges entries from all six source tables into one correctly-sorted, correctly-typed list", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
      analystId: org.analyst.id,
      developerId: org.developer.id,
    });

    // Space entries out in time (oldest first) so descending sort order is unambiguous.
    await prisma.projectStageHistory.create({
      data: {
        projectId: project.id,
        fromStage: null,
        toStage: "IDEA",
        actorId: org.teamLead.id,
        changedAt: new Date(Date.now() - 9 * 60 * 1000),
      },
    });

    const milestone = await prisma.milestone.create({
      data: {
        projectId: project.id,
        name: "First milestone",
        ownerId: org.developer.id,
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 8 * 60 * 1000),
      },
    });
    await prisma.delayReason.create({
      data: {
        projectId: project.id,
        milestoneId: milestone.id,
        category: "RESOURCE_UNAVAILABLE",
        recordedById: org.analyst.id,
        createdAt: new Date(Date.now() - 7 * 60 * 1000),
      },
    });

    const blocker = await prisma.blocker.create({
      data: {
        projectId: project.id,
        description: "A blocker.",
        impact: "Some impact.",
        responsiblePersonId: org.developer.id,
        raisedById: org.analyst.id,
        createdAt: new Date(Date.now() - 6 * 60 * 1000),
      },
    });
    await prisma.blocker.update({
      where: { id: blocker.id },
      data: {
        resolvedAt: new Date(Date.now() - 5 * 60 * 1000),
        resolvedById: org.developer.id,
        resolutionNotes: "Fixed.",
      },
    });

    await prisma.scopeChange.create({
      data: {
        projectId: project.id,
        requestedById: org.businessOwner.id,
        reason: "Scope expanded.",
        createdAt: new Date(Date.now() - 4 * 60 * 1000),
      },
    });

    const risk = await prisma.risk.create({
      data: {
        projectId: project.id,
        title: "A risk",
        description: "A risk description.",
        likelihood: "HIGH",
        impact: "HIGH",
        ownerId: org.teamLead.id,
        raisedById: org.analyst.id,
        createdAt: new Date(Date.now() - 3 * 60 * 1000),
      },
    });
    await recordRiskStatusChange(risk.id, "MITIGATING", org.teamLead.id, "Mitigating now.");

    const flag = await upsertFlag({
      projectId: project.id,
      flagType: "STUCK_MILESTONE",
      subjectId: milestone.id,
      narration: "Milestone is overdue.",
      narrationSource: "RULE_FALLBACK",
      severity: 2,
    });
    await prisma.agentFlag.update({
      where: { id: flag.id },
      data: { resolvedAt: new Date(), resolutionReason: "CONDITION_CLEARED" },
    });

    const timeline = await getProjectTimeline(project.id);

    const types = timeline.map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining([
      "STAGE_CHANGE",
      "DELAY_REASON",
      "BLOCKER_RAISED",
      "BLOCKER_RESOLVED",
      "SCOPE_CHANGE",
      "RISK_RAISED",
      "RISK_STATUS_CHANGE",
      "AGENT_FLAG_RAISED",
      "AGENT_FLAG_RESOLVED",
    ]));

    const timestamps = timeline.map((e) => e.timestamp.getTime());
    const sorted = [...timestamps].sort((a, b) => b - a);
    expect(timestamps).toEqual(sorted);

    const stageChange = timeline.find((e) => e.type === "STAGE_CHANGE");
    expect(stageChange?.summary).toContain("IDEA");

    const flagResolved = timeline.find((e) => e.type === "AGENT_FLAG_RESOLVED");
    expect(flagResolved?.summary).toContain("CONDITION_CLEARED");
  });

  it("filters to only the requested types when opts.types is passed", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });
    await prisma.scopeChange.create({
      data: { projectId: project.id, requestedById: org.teamLead.id, reason: "Scope change." },
    });

    const timeline = await getProjectTimeline(project.id, { types: ["SCOPE_CHANGE"] });
    expect(timeline).toHaveLength(1);
    expect(timeline[0].type).toBe("SCOPE_CHANGE");
  });
});
