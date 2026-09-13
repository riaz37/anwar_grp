import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createAgentTools } from "@/lib/agent-tools";
import {
  asSession,
  cleanupFixtureOrg,
  createFixtureOrg,
  createFixtureProject,
} from "./setup-fixtures";

// notifyProjectStakeholders sends a real email via Resend otherwise.
vi.mock("@/lib/email", () => ({
  sendProjectNotificationEmail: vi.fn(async (input: { recipients: unknown[] }) => input.recipients.length),
}));

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

  it("notifyProjectStakeholders uses the route-bound projectId over a mistyped model-supplied one", async () => {
    const viewedProject = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });

    const tools = createAgentTools(asSession(org.teamLead), {
      boundProjectId: viewedProject.id,
    });
    const result = await runTool(
      tools.notifyProjectStakeholders.execute!(
        { projectId: "not-a-real-id", message: "Update.", audience: ["owner"] },
        toolOptions,
      ),
    );

    expect(result.sent).toBe(true);
    expect(result.recipients).toEqual([org.teamLead.name]);
  });

  it("notifyProjectStakeholders falls back to the model-supplied projectId when nothing is bound", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });

    const tools = createAgentTools(asSession(org.teamLead));
    const result = await runTool(
      tools.notifyProjectStakeholders.execute!(
        { projectId: project.id, message: "Update.", audience: ["owner"] },
        toolOptions,
      ),
    );

    expect(result.sent).toBe(true);
  });

  it("notifyProjectStakeholders still enforces participant scoping when a projectId is bound", async () => {
    // A malicious/buggy caller can't use boundProjectId to reach a project
    // the session isn't actually a participant on — isProjectParticipant
    // still runs against ctx (the developer), regardless of who bound the id.
    const otherProject = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
      analystId: org.analyst.id,
      // developer intentionally not assigned
    });

    const tools = createAgentTools(asSession(org.developer), {
      boundProjectId: otherProject.id,
    });
    const result = await runTool(
      tools.notifyProjectStakeholders.execute!(
        { message: "Update.", audience: ["owner"] },
        toolOptions,
      ),
    );

    expect(result.sent).toBe(false);
    expect(result.reason).toBe("Project not found or not accessible.");
  });

  it("notifyProjectStakeholders returns a clear reason when neither bound nor model projectId is present", async () => {
    const tools = createAgentTools(asSession(org.teamLead));
    const result = await runTool(
      tools.notifyProjectStakeholders.execute!(
        { message: "Update.", audience: ["owner"] },
        toolOptions,
      ),
    );

    expect(result.sent).toBe(false);
    expect(result.reason).toBe("No project specified.");
  });

  it("notifyProjectStakeholders dedupes recipients that match more than one requested audience", async () => {
    // owner and analyst are the same person here — the audience list asks
    // for both, but they should only be emailed once.
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
      analystId: org.teamLead.id,
    });

    const tools = createAgentTools(asSession(org.teamLead), {
      boundProjectId: project.id,
    });
    const result = await runTool(
      tools.notifyProjectStakeholders.execute!(
        { message: "Update.", audience: ["owner", "analyst"] },
        toolOptions,
      ),
    );

    expect(result.recipientCount).toBe(1);
    expect(result.recipients).toEqual([org.teamLead.name]);
  });

  it("notifyProjectStakeholders notifies a role audience (management) scoped to the project's business unit", async () => {
    const managementUser = await prisma.user.create({
      data: {
        email: `management-${Math.random().toString(36).slice(2, 8)}@test.local`,
        name: "Test MANAGEMENT",
        role: "MANAGEMENT",
        passwordHash: "unused-in-tests",
        businessUnitId: org.businessUnit.id,
        departmentId: org.department.id,
      },
    });
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });

    const tools = createAgentTools(asSession(org.teamLead), {
      boundProjectId: project.id,
    });
    const result = await runTool(
      tools.notifyProjectStakeholders.execute!(
        { message: "Update.", audience: ["management"] },
        toolOptions,
      ),
    );

    expect(result.sent).toBe(true);
    expect(result.recipients).toEqual([managementUser.name]);

    await prisma.user.delete({ where: { id: managementUser.id } });
  });

  it("notifyProjectStakeholders reports no matching recipients instead of throwing when the audience has nobody to notify", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
      // no analyst/developer assigned, and no MANAGEMENT user exists in this fixture org
    });

    const tools = createAgentTools(asSession(org.teamLead), {
      boundProjectId: project.id,
    });
    const result = await runTool(
      tools.notifyProjectStakeholders.execute!(
        { message: "Update.", audience: ["analyst", "developer", "management"] },
        toolOptions,
      ),
    );

    expect(result.sent).toBe(false);
    expect(result.recipientCount).toBe(0);
    expect(result.reason).toBe("No matching recipients found for the requested audience.");
  });
});
