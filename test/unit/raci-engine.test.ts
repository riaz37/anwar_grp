import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";
import { getOwnershipGaps, getProjectRaci } from "@/lib/raci-engine";
import { STAGE_ORDER } from "@/lib/project-stages";
import { cleanupFixtureOrg, createFixtureOrg, createFixtureProject } from "../integration/setup-fixtures";

const IDEA = STAGE_ORDER[0];
const DISCOVERY = STAGE_ORDER[1];
const DEVELOPMENT = STAGE_ORDER[STAGE_ORDER.indexOf("DEVELOPMENT")];
const STAGE_BEFORE_DEVELOPMENT = STAGE_ORDER[STAGE_ORDER.indexOf("DEVELOPMENT") - 1];
const APPROVAL = STAGE_ORDER[STAGE_ORDER.indexOf("APPROVAL")];
const STAGE_BEFORE_APPROVAL = STAGE_ORDER[STAGE_ORDER.indexOf("APPROVAL") - 1];

describe("getOwnershipGaps", () => {
  let org: Awaited<ReturnType<typeof createFixtureOrg>>;
  let outsider: User | undefined;

  beforeEach(async () => {
    org = await createFixtureOrg();
    outsider = undefined;
  });

  afterEach(async () => {
    await cleanupFixtureOrg(org);
    if (outsider) {
      await prisma.user.delete({ where: { id: outsider.id } });
    }
  });

  it("MISSING_ANALYST: triggers when analystId is null and the stage is past IDEA", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });
    await prisma.project.update({ where: { id: project.id }, data: { currentStage: DISCOVERY } });

    const gaps = await getOwnershipGaps(project.id);
    expect(gaps.map((g) => g.type)).toContain("MISSING_ANALYST");
  });

  it("MISSING_ANALYST: absent when the project is still at IDEA, even with no analyst", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });

    const gaps = await getOwnershipGaps(project.id);
    expect(gaps.map((g) => g.type)).not.toContain("MISSING_ANALYST");
  });

  it("MISSING_ANALYST: absent once an analyst is assigned, even past IDEA", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
      analystId: org.analyst.id,
    });
    await prisma.project.update({ where: { id: project.id }, data: { currentStage: DISCOVERY } });

    const gaps = await getOwnershipGaps(project.id);
    expect(gaps.map((g) => g.type)).not.toContain("MISSING_ANALYST");
  });

  it("MISSING_DEVELOPER: triggers when developerId is null and the stage is at/past DEVELOPMENT", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
      analystId: org.analyst.id,
    });
    await prisma.project.update({ where: { id: project.id }, data: { currentStage: DEVELOPMENT } });

    const gaps = await getOwnershipGaps(project.id);
    expect(gaps.map((g) => g.type)).toContain("MISSING_DEVELOPER");
  });

  it("MISSING_DEVELOPER: absent before DEVELOPMENT, even with no developer", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
      analystId: org.analyst.id,
    });
    await prisma.project.update({
      where: { id: project.id },
      data: { currentStage: STAGE_BEFORE_DEVELOPMENT },
    });

    const gaps = await getOwnershipGaps(project.id);
    expect(gaps.map((g) => g.type)).not.toContain("MISSING_DEVELOPER");
  });

  it("MISSING_DEVELOPER: absent once a developer is assigned at/past DEVELOPMENT", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
      analystId: org.analyst.id,
      developerId: org.developer.id,
    });
    await prisma.project.update({ where: { id: project.id }, data: { currentStage: DEVELOPMENT } });

    const gaps = await getOwnershipGaps(project.id);
    expect(gaps.map((g) => g.type)).not.toContain("MISSING_DEVELOPER");
  });

  it("BLOCKER_RESPONSIBLE_NOT_PARTICIPANT: triggers when an unresolved blocker's responsible person is not a project participant", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
      analystId: org.analyst.id,
      developerId: org.developer.id,
    });
    outsider = await prisma.user.create({
      data: {
        email: `outsider-${Math.random().toString(36).slice(2, 8)}@test.local`,
        name: "Outsider",
        role: "DEVELOPER",
        passwordHash: "unused-in-tests",
      },
    });
    const blocker = await prisma.blocker.create({
      data: {
        projectId: project.id,
        description: "Waiting on an external team.",
        impact: "Blocks delivery.",
        responsiblePersonId: outsider.id,
        raisedById: org.analyst.id,
      },
    });

    const gaps = await getOwnershipGaps(project.id);
    const gap = gaps.find((g) => g.type === "BLOCKER_RESPONSIBLE_NOT_PARTICIPANT");
    expect(gap).toBeDefined();
    expect(gap?.subjectId).toBe(blocker.id);
  });

  it("BLOCKER_RESPONSIBLE_NOT_PARTICIPANT: absent when the responsible person is a project participant", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
      analystId: org.analyst.id,
      developerId: org.developer.id,
    });
    await prisma.blocker.create({
      data: {
        projectId: project.id,
        description: "Internal blocker.",
        impact: "Blocks delivery.",
        responsiblePersonId: org.developer.id,
        raisedById: org.analyst.id,
      },
    });

    const gaps = await getOwnershipGaps(project.id);
    expect(gaps.map((g) => g.type)).not.toContain("BLOCKER_RESPONSIBLE_NOT_PARTICIPANT");
  });

  it("NO_CONSULTED_OR_INFORMED: triggers when no stakeholders exist at/past APPROVAL", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
      analystId: org.analyst.id,
      developerId: org.developer.id,
    });
    await prisma.project.update({ where: { id: project.id }, data: { currentStage: APPROVAL } });

    const gaps = await getOwnershipGaps(project.id);
    expect(gaps.map((g) => g.type)).toContain("NO_CONSULTED_OR_INFORMED");
  });

  it("NO_CONSULTED_OR_INFORMED: absent before APPROVAL, even with zero stakeholders", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
      analystId: org.analyst.id,
      developerId: org.developer.id,
    });
    await prisma.project.update({
      where: { id: project.id },
      data: { currentStage: STAGE_BEFORE_APPROVAL },
    });

    const gaps = await getOwnershipGaps(project.id);
    expect(gaps.map((g) => g.type)).not.toContain("NO_CONSULTED_OR_INFORMED");
  });

  it("NO_CONSULTED_OR_INFORMED: absent at/past APPROVAL once at least one CONSULTED or INFORMED stakeholder exists", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
      analystId: org.analyst.id,
      developerId: org.developer.id,
    });
    await prisma.project.update({ where: { id: project.id }, data: { currentStage: APPROVAL } });
    await prisma.projectStakeholder.create({
      data: { projectId: project.id, userId: org.businessOwner.id, raciRole: "INFORMED" },
    });

    const gaps = await getOwnershipGaps(project.id);
    expect(gaps.map((g) => g.type)).not.toContain("NO_CONSULTED_OR_INFORMED");
  });
});

describe("getProjectRaci", () => {
  let org: Awaited<ReturnType<typeof createFixtureOrg>>;

  beforeEach(async () => {
    org = await createFixtureOrg();
  });

  afterEach(async () => {
    await cleanupFixtureOrg(org);
  });

  it("assembles Accountable from Project.owner, Responsible from analyst/developer/blocker responsible parties, and Consulted/Informed from ProjectStakeholder rows", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
      analystId: org.analyst.id,
      developerId: org.developer.id,
    });
    await prisma.blocker.create({
      data: {
        projectId: project.id,
        description: "A blocker needing a specific owner.",
        impact: "Some impact.",
        responsiblePersonId: org.businessOwner.id,
        raisedById: org.analyst.id,
      },
    });
    await prisma.projectStakeholder.create({
      data: { projectId: project.id, userId: org.businessOwner.id, raciRole: "CONSULTED" },
    });

    const raci = await getProjectRaci(project.id);

    expect(raci.accountable?.userId).toBe(org.teamLead.id);
    expect(raci.responsible.map((r) => r.userId)).toEqual(
      expect.arrayContaining([org.analyst.id, org.developer.id, org.businessOwner.id]),
    );
    expect(raci.consulted.map((c) => c.userId)).toEqual([org.businessOwner.id]);
    expect(raci.informed).toEqual([]);
  });

  it("returns empty Responsible/Consulted/Informed lists when no analyst/developer/blockers/stakeholders exist", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });

    const raci = await getProjectRaci(project.id);
    expect(raci.accountable?.userId).toBe(org.teamLead.id);
    expect(raci.responsible).toEqual([]);
    expect(raci.consulted).toEqual([]);
    expect(raci.informed).toEqual([]);
  });
});
