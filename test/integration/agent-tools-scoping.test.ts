import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createAgentTools } from "@/lib/agent-tools";
import {
  asSession,
  cleanupFixtureOrg,
  createFixtureOrg,
  createFixtureProject,
} from "./setup-fixtures";

/**
 * Covers the participant-scoping added to createAgentTools: opening
 * VIEW_AGENT_INSIGHTS to AI_ANALYST/DEVELOPER/BUSINESS_OWNER only helps if
 * the tools themselves refuse to hand back another team's project data —
 * this is the same isProjectParticipant boundary the rest of the app
 * already enforces on reads, applied here to the agent's tool calls.
 */

const toolOptions = { toolCallId: "test-call", messages: [] };

/** Tool `execute` types as `T | AsyncIterable<T>`; every tool here always resolves a plain T. */
async function runTool<T>(call: T | AsyncIterable<T> | PromiseLike<T>): Promise<T> {
  return (await call) as T;
}

let org: Awaited<ReturnType<typeof createFixtureOrg>>;

beforeEach(async () => {
  org = await createFixtureOrg();
});

afterEach(async () => {
  await cleanupFixtureOrg(org);
});

describe("agent tool scoping", () => {
  it("getProjectStatus returns found:false for a project the developer is not assigned to", async () => {
    const otherProject = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
      analystId: org.analyst.id,
      // developer intentionally not assigned
    });

    const tools = createAgentTools(asSession(org.developer));
    const result = await runTool(
      tools.getProjectStatus.execute!({ projectId: otherProject.id }, toolOptions),
    );

    expect(result.found).toBe(false);
  });

  it("getProjectStatus returns found:true for a project the developer is assigned to", async () => {
    const ownProject = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
      developerId: org.developer.id,
    });

    const tools = createAgentTools(asSession(org.developer));
    const result = await runTool(
      tools.getProjectStatus.execute!({ projectId: ownProject.id }, toolOptions),
    );

    expect(result.found).toBe(true);
    expect(result.projectId).toBe(ownProject.id);
  });

  it("getProjectStatus lets a portfolio-wide role (AI_TEAM_LEAD) see any project", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.businessOwner.id,
      analystId: org.analyst.id,
      developerId: org.developer.id,
    });

    const tools = createAgentTools(asSession(org.teamLead));
    const result = await runTool(
      tools.getProjectStatus.execute!({ projectId: project.id }, toolOptions),
    );

    expect(result.found).toBe(true);
  });

  it("listOpenFlags with no projectId only returns flags for projects the caller participates in", async () => {
    const ownProject = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
      developerId: org.developer.id,
    });
    const otherProject = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
      analystId: org.analyst.id,
    });

    await prisma.agentFlag.createMany({
      data: [
        {
          projectId: ownProject.id,
          flagType: "STUCK_BLOCKER",
          subjectId: "own-subject",
          narration: "Own project flag.",
          narrationSource: "RULE_FALLBACK",
          severity: 1,
        },
        {
          projectId: otherProject.id,
          flagType: "STUCK_BLOCKER",
          subjectId: "other-subject",
          narration: "Other project flag.",
          narrationSource: "RULE_FALLBACK",
          severity: 1,
        },
      ],
    });

    const tools = createAgentTools(asSession(org.developer));
    const result = await runTool(tools.listOpenFlags.execute!({}, toolOptions));

    expect(result.flags.map((f) => f.projectId)).toEqual([ownProject.id]);
  });

  it("listOpenFlags with an explicit projectId the caller can't see returns nothing", async () => {
    const otherProject = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
      analystId: org.analyst.id,
    });
    await prisma.agentFlag.create({
      data: {
        projectId: otherProject.id,
        flagType: "STUCK_BLOCKER",
        subjectId: "other-subject",
        narration: "Other project flag.",
        narrationSource: "RULE_FALLBACK",
        severity: 1,
      },
    });

    const tools = createAgentTools(asSession(org.developer));
    const result = await runTool(
      tools.listOpenFlags.execute!({ projectId: otherProject.id }, toolOptions),
    );

    expect(result.count).toBe(0);
  });
});
