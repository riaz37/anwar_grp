import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  StageTransitionError,
  transitionProjectStage,
} from "@/lib/project-stages";
import {
  computeProjectHealth,
  milestoneRequiresDelayReason,
  recomputeProjectHealth,
} from "@/lib/project-health";
import {
  isStageGateSatisfied,
  seedStageGateChecklist,
  toggleChecklistItem,
} from "@/lib/checklist-engine";
import {
  asSession,
  cleanupFixtureOrg,
  createFixtureOrg,
  createFixtureProject,
} from "./setup-fixtures";

let org: Awaited<ReturnType<typeof createFixtureOrg>>;

beforeEach(async () => {
  org = await createFixtureOrg();
});

afterEach(async () => {
  await cleanupFixtureOrg(org);
});

describe("transitionProjectStage", () => {
  it("blocks advancing out of DISCOVERY while a required checklist item is unchecked", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });
    await transitionProjectStage({
      projectId: project.id,
      toStage: "DISCOVERY",
      actor: asSession(org.analyst),
    });

    await expect(
      transitionProjectStage({
        projectId: project.id,
        toStage: "REQUIREMENTS_DESIGN",
        actor: asSession(org.analyst),
      }),
    ).rejects.toThrow(StageTransitionError);

    const unchanged = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
    expect(unchanged.currentStage).toBe("DISCOVERY");
  });

  it("allows advancing once every required checklist item for the current stage is checked", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });
    await transitionProjectStage({
      projectId: project.id,
      toStage: "DISCOVERY",
      actor: asSession(org.analyst),
    });

    const items = await prisma.stageGateChecklistItem.findMany({
      where: { projectId: project.id, stage: "DISCOVERY" },
    });
    expect(items).toHaveLength(4);
    for (const item of items) {
      await toggleChecklistItem({ itemId: item.id, checked: true, checkedById: org.analyst.id });
    }

    expect(await isStageGateSatisfied(project.id, "DISCOVERY")).toBe(true);

    const updated = await transitionProjectStage({
      projectId: project.id,
      toStage: "REQUIREMENTS_DESIGN",
      actor: asSession(org.analyst),
    });
    expect(updated.currentStage).toBe("REQUIREMENTS_DESIGN");

    const history = await prisma.projectStageHistory.findMany({
      where: { projectId: project.id },
      orderBy: { changedAt: "asc" },
    });
    expect(history.map((h) => h.toStage)).toEqual(["DISCOVERY", "REQUIREMENTS_DESIGN"]);
    expect(history[1].fromStage).toBe("DISCOVERY");
  });

  it("rejects skipping a stage — forward-only, one step at a time", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });

    await expect(
      transitionProjectStage({
        projectId: project.id,
        toStage: "APPROVAL",
        actor: asSession(org.analyst),
      }),
    ).rejects.toThrow(StageTransitionError);
  });

  it("rejects moving backward into a prior or the current stage", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });
    await transitionProjectStage({
      projectId: project.id,
      toStage: "DISCOVERY",
      actor: asSession(org.analyst),
    });

    await expect(
      transitionProjectStage({
        projectId: project.id,
        toStage: "DISCOVERY",
        actor: asSession(org.analyst),
      }),
    ).rejects.toThrow(StageTransitionError);

    await expect(
      transitionProjectStage({
        projectId: project.id,
        toStage: "IDEA",
        actor: asSession(org.analyst),
      }),
    ).rejects.toThrow(StageTransitionError);
  });

  it("advances freely through a stage with no fixed checklist template (e.g. APPROVAL)", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });
    // Walk to APPROVAL, checking each gated stage's items along the way.
    for (const stage of ["DISCOVERY", "REQUIREMENTS_DESIGN"] as const) {
      await transitionProjectStage({ projectId: project.id, toStage: stage, actor: asSession(org.analyst) });
      const items = await prisma.stageGateChecklistItem.findMany({
        where: { projectId: project.id, stage },
      });
      for (const item of items) {
        await toggleChecklistItem({ itemId: item.id, checked: true, checkedById: org.analyst.id });
      }
    }

    // APPROVAL has no template — should transition through with zero checklist items.
    const updated = await transitionProjectStage({
      projectId: project.id,
      toStage: "APPROVAL",
      actor: asSession(org.businessOwner),
    });
    expect(updated.currentStage).toBe("APPROVAL");
    expect(await isStageGateSatisfied(project.id, "APPROVAL")).toBe(true);
  });
});

describe("computeProjectHealth", () => {
  it("is ON_TRACK with no blockers and no near/overdue milestones", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });
    expect(await computeProjectHealth(project.id)).toBe("ON_TRACK");
  });

  it("is AT_RISK when a non-DONE milestone is due within the at-risk window", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });
    await prisma.milestone.create({
      data: {
        projectId: project.id,
        name: "Due soon",
        ownerId: org.developer.id,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    expect(await computeProjectHealth(project.id)).toBe("AT_RISK");
  });

  it("is DELAYED when a non-DONE milestone is overdue", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });
    await prisma.milestone.create({
      data: {
        projectId: project.id,
        name: "Overdue",
        ownerId: org.developer.id,
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });
    expect(await computeProjectHealth(project.id)).toBe("DELAYED");
  });

  it("is BLOCKED when an unresolved blocker exists, even with an overdue milestone (BLOCKED takes priority)", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });
    await prisma.milestone.create({
      data: {
        projectId: project.id,
        name: "Overdue",
        ownerId: org.developer.id,
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });
    await prisma.blocker.create({
      data: {
        projectId: project.id,
        description: "Something is blocking us.",
        impact: "Big impact.",
        raisedById: org.developer.id,
      },
    });
    expect(await computeProjectHealth(project.id)).toBe("BLOCKED");
  });

  it("falls back to DELAYED (not ON_TRACK) once the blocker resolves but the milestone is still overdue", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });
    await prisma.milestone.create({
      data: {
        projectId: project.id,
        name: "Overdue",
        ownerId: org.developer.id,
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });
    const blocker = await prisma.blocker.create({
      data: {
        projectId: project.id,
        description: "Something is blocking us.",
        impact: "Big impact.",
        raisedById: org.developer.id,
      },
    });
    expect(await recomputeProjectHealth(project.id)).toBe("BLOCKED");

    await prisma.blocker.update({
      where: { id: blocker.id },
      data: { resolvedAt: new Date(), resolvedById: org.developer.id },
    });
    expect(await recomputeProjectHealth(project.id)).toBe("DELAYED");
  });

  it("ignores DONE milestones entirely, however far in the past their due date", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });
    await prisma.milestone.create({
      data: {
        projectId: project.id,
        name: "Done long ago",
        ownerId: org.developer.id,
        dueDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        status: "DONE",
        completedAt: new Date(Date.now() - 59 * 24 * 60 * 60 * 1000),
      },
    });
    expect(await computeProjectHealth(project.id)).toBe("ON_TRACK");
  });
});

describe("milestoneRequiresDelayReason", () => {
  it("is true for an overdue, non-DONE milestone with no DelayReason on record", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });
    const milestone = await prisma.milestone.create({
      data: {
        projectId: project.id,
        name: "Overdue",
        ownerId: org.developer.id,
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });
    expect(await milestoneRequiresDelayReason(milestone.id)).toBe(true);
  });

  it("is false once a DelayReason has been recorded for that milestone", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });
    const milestone = await prisma.milestone.create({
      data: {
        projectId: project.id,
        name: "Overdue",
        ownerId: org.developer.id,
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });
    await prisma.delayReason.create({
      data: {
        projectId: project.id,
        milestoneId: milestone.id,
        category: "RESOURCE_UNAVAILABLE",
        recordedById: org.analyst.id,
      },
    });
    expect(await milestoneRequiresDelayReason(milestone.id)).toBe(false);
  });

  it("is false for a milestone that isn't overdue", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });
    const milestone = await prisma.milestone.create({
      data: {
        projectId: project.id,
        name: "Future",
        ownerId: org.developer.id,
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    expect(await milestoneRequiresDelayReason(milestone.id)).toBe(false);
  });
});

describe("seedStageGateChecklist", () => {
  it("is idempotent — calling it twice for the same project/stage does not duplicate items", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });
    await seedStageGateChecklist(project.id, "DISCOVERY");
    await seedStageGateChecklist(project.id, "DISCOVERY");
    const items = await prisma.stageGateChecklistItem.findMany({
      where: { projectId: project.id, stage: "DISCOVERY" },
    });
    expect(items).toHaveLength(4);
  });
});
