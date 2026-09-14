import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { cleanupFixtureOrg, createFixtureOrg, createFixtureProject } from "./setup-fixtures";

// Per AGENTIC_DASHBOARD_PLAN.md Decision 3: the monitoring loop's rule-based
// layer must not depend on LLM provider uptime. Stub the narration client
// to simulate a failed/unreachable LLM call for the whole suite so this test
// never makes a real network call and locks in the RULE_FALLBACK guarantee.
vi.mock("@/lib/llm-client", () => ({
  generateFlagNarration: vi.fn(async () => ({ text: "", source: "RULE_FALLBACK" as const })),
}));

// RESEND_API_KEY is configured in this repo's .env for real use (agent
// alert emails) — without this mock, this test would send a real email
// on every run via the monitor's new email-alert step.
vi.mock("@/lib/email", () => ({
  sendFlagAlertEmail: vi.fn(async () => {}),
}));

const { runAgentMonitor } = await import("@/app/api/internal/agent-monitor/route");

const STUCK_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000;

describe("runAgentMonitor", () => {
  let org: Awaited<ReturnType<typeof createFixtureOrg>>;

  beforeEach(async () => {
    org = await createFixtureOrg();
  });

  afterEach(async () => {
    await cleanupFixtureOrg(org);
  });

  it("flags an overdue milestone, does not duplicate on re-run, and auto-resolves once the milestone is done", async () => {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });
    const milestone = await prisma.milestone.create({
      data: {
        projectId: project.id,
        name: "Badly overdue milestone",
        ownerId: org.teamLead.id,
        dueDate: new Date(Date.now() - STUCK_THRESHOLD_MS - 24 * 60 * 60 * 1000),
      },
    });

    await runAgentMonitor();

    const flagWhere = {
      projectId_flagType_subjectId: {
        projectId: project.id,
        flagType: "STUCK_MILESTONE" as const,
        subjectId: milestone.id,
      },
    };

    const firstFlag = await prisma.agentFlag.findUnique({ where: flagWhere });
    expect(firstFlag).not.toBeNull();
    expect(firstFlag?.resolvedAt).toBeNull();
    expect(firstFlag?.narrationSource).toBe("RULE_FALLBACK");
    expect(firstFlag?.narration).toContain("overdue");

    await runAgentMonitor();

    const flagsForMilestone = await prisma.agentFlag.findMany({
      where: { projectId: project.id, flagType: "STUCK_MILESTONE", subjectId: milestone.id },
    });
    expect(flagsForMilestone).toHaveLength(1);
    expect(flagsForMilestone[0].id).toBe(firstFlag?.id);

    await prisma.milestone.update({
      where: { id: milestone.id },
      data: { status: "DONE", completedAt: new Date() },
    });

    await runAgentMonitor();

    const resolvedFlag = await prisma.agentFlag.findUnique({ where: flagWhere });
    expect(resolvedFlag?.resolvedAt).not.toBeNull();
    expect(resolvedFlag?.resolutionReason).toBe("CONDITION_CLEARED");
    // runAgentMonitor() sweeps the entire real portfolio (~140 active
    // projects, see test/eval's timing notes on the route itself), 3
    // times in this test — needs real headroom, not the 30s default.
  }, 600000);
});
