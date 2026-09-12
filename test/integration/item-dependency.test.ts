import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { assertValidDependencyEdge, DependencyValidationError } from "@/lib/dependency-graph";
import {
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

async function createFixtureTask(projectId: string, ownerId: string, action: string) {
  return prisma.projectTask.create({ data: { projectId, ownerId, action } });
}

describe("assertValidDependencyEdge", () => {
  it("allows a valid edge between a task and a milestone in the same project and persists it", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });
    const milestone = await prisma.milestone.create({
      data: {
        projectId: project.id,
        name: "Milestone A",
        ownerId: org.teamLead.id,
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      },
    });
    const task = await createFixtureTask(project.id, org.developer.id, "Do the thing");

    await expect(
      assertValidDependencyEdge({
        projectId: project.id,
        dependentType: "TASK",
        dependentId: task.id,
        dependsOnType: "MILESTONE",
        dependsOnId: milestone.id,
      }),
    ).resolves.toBeUndefined();

    const edge = await prisma.itemDependency.create({
      data: {
        projectId: project.id,
        dependentType: "TASK",
        dependentId: task.id,
        dependsOnType: "MILESTONE",
        dependsOnId: milestone.id,
      },
    });
    expect(edge.id).toBeTruthy();
  });

  it("rejects a self-loop", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });
    const task = await createFixtureTask(project.id, org.developer.id, "Solo task");

    await expect(
      assertValidDependencyEdge({
        projectId: project.id,
        dependentType: "TASK",
        dependentId: task.id,
        dependsOnType: "TASK",
        dependsOnId: task.id,
      }),
    ).rejects.toThrow(DependencyValidationError);
  });

  it("rejects an edge to an item in a different project", async () => {
    const projectA = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });
    const projectB = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });
    const taskA = await createFixtureTask(projectA.id, org.developer.id, "Task in A");
    const taskB = await createFixtureTask(projectB.id, org.developer.id, "Task in B");

    await expect(
      assertValidDependencyEdge({
        projectId: projectA.id,
        dependentType: "TASK",
        dependentId: taskA.id,
        dependsOnType: "TASK",
        dependsOnId: taskB.id,
      }),
    ).rejects.toThrow(DependencyValidationError);
  });

  it("rejects an edge that would close a cycle", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });
    const a = await createFixtureTask(project.id, org.developer.id, "A");
    const b = await createFixtureTask(project.id, org.developer.id, "B");
    const c = await createFixtureTask(project.id, org.developer.id, "C");

    // A -> B -> C (B depends on A, C depends on B)
    await prisma.itemDependency.create({
      data: {
        projectId: project.id,
        dependentType: "TASK",
        dependentId: b.id,
        dependsOnType: "TASK",
        dependsOnId: a.id,
      },
    });
    await prisma.itemDependency.create({
      data: {
        projectId: project.id,
        dependentType: "TASK",
        dependentId: c.id,
        dependsOnType: "TASK",
        dependsOnId: b.id,
      },
    });

    // A -> C would close the loop back to A.
    await expect(
      assertValidDependencyEdge({
        projectId: project.id,
        dependentType: "TASK",
        dependentId: a.id,
        dependsOnType: "TASK",
        dependsOnId: c.id,
      }),
    ).rejects.toThrow(DependencyValidationError);
  });

  it("rejects a duplicate edge", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });
    const a = await createFixtureTask(project.id, org.developer.id, "A");
    const b = await createFixtureTask(project.id, org.developer.id, "B");

    await prisma.itemDependency.create({
      data: {
        projectId: project.id,
        dependentType: "TASK",
        dependentId: b.id,
        dependsOnType: "TASK",
        dependsOnId: a.id,
      },
    });

    await expect(
      assertValidDependencyEdge({
        projectId: project.id,
        dependentType: "TASK",
        dependentId: b.id,
        dependsOnType: "TASK",
        dependsOnId: a.id,
      }),
    ).rejects.toThrow(DependencyValidationError);
  });
});

describe("ProjectTask.progressPercent", () => {
  it("persists and defaults to 0", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });
    const task = await createFixtureTask(project.id, org.developer.id, "Track progress");
    expect(task.progressPercent).toBe(0);

    const updated = await prisma.projectTask.update({
      where: { id: task.id },
      data: { progressPercent: 42 },
    });
    expect(updated.progressPercent).toBe(42);
  });
});
