import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";
import type { SessionPayload } from "@/lib/session";

/**
 * Fixture builder for integration tests: real rows in the dev Postgres
 * (same DB `prisma/seed.ts` uses), namespaced per test run via a random
 * suffix so parallel/CI runs never collide, and torn down afterward.
 */
export async function createFixtureOrg() {
  const suffix = Math.random().toString(36).slice(2, 10);
  const businessUnit = await prisma.businessUnit.create({
    data: { name: `Test BU ${suffix}` },
  });
  const department = await prisma.department.create({
    data: { name: `Test Dept ${suffix}`, businessUnitId: businessUnit.id },
  });

  async function makeUser(role: Role) {
    return prisma.user.create({
      data: {
        email: `${role.toLowerCase()}-${suffix}@test.local`,
        name: `Test ${role}`,
        role,
        passwordHash: "unused-in-tests",
        businessUnitId: businessUnit.id,
        departmentId: department.id,
      },
    });
  }

  const analyst = await makeUser("AI_ANALYST");
  const developer = await makeUser("DEVELOPER");
  const businessOwner = await makeUser("BUSINESS_OWNER");
  const teamLead = await makeUser("AI_TEAM_LEAD");

  return { businessUnit, department, analyst, developer, businessOwner, teamLead };
}

export function asSession(user: { id: string; role: Role }): SessionPayload {
  return {
    sessionId: "test-session",
    userId: user.id,
    role: user.role,
    departmentId: null,
    businessUnitId: null,
    email: "test@test.local",
    name: "Test User",
    isActive: true,
  };
}

export async function createFixtureProject(params: {
  businessUnitId: string;
  departmentId: string;
  ownerId: string;
  analystId?: string;
  developerId?: string;
}) {
  return prisma.project.create({
    data: {
      name: `Test Project ${Math.random().toString(36).slice(2, 8)}`,
      businessUnitId: params.businessUnitId,
      departmentId: params.departmentId,
      businessProblem: "A test business problem.",
      expectedOutcome: "A test expected outcome.",
      ownerId: params.ownerId,
      analystId: params.analystId,
      developerId: params.developerId,
      expectedDeliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
}

/** Deletes everything under a fixture org (cascades through project children). */
export async function cleanupFixtureOrg(org: Awaited<ReturnType<typeof createFixtureOrg>>) {
  const projects = await prisma.project.findMany({
    where: { businessUnitId: org.businessUnit.id },
    select: { id: true },
  });
  const projectIds = projects.map((p) => p.id);

  if (projectIds.length > 0) {
    await prisma.delayReason.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.scopeChange.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.blocker.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.projectTask.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.milestone.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.stageGateChecklistItem.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.projectStageHistory.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  }

  await prisma.user.deleteMany({
    where: { id: { in: [org.analyst.id, org.developer.id, org.businessOwner.id, org.teamLead.id] } },
  });
  await prisma.department.delete({ where: { id: org.department.id } });
  await prisma.businessUnit.delete({ where: { id: org.businessUnit.id } });
}
