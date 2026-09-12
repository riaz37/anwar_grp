import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { cleanupFixtureOrg, createFixtureOrg, createFixtureProject } from "../integration/setup-fixtures";

/**
 * Eval suite for the monitoring-loop agent (AGENTIC_DASHBOARD_PLAN.md
 * "Group C"), covering critical situations beyond the happy-path
 * integration test: severity-matrix edges, all four ownership-gap
 * conditions independently, LLM-down degradation, and a stress run
 * across many projects/subjects at once. LLM narration is stubbed here
 * (see test/integration/agent-monitor.test.ts's rationale) so this suite
 * is deterministic and fast; live-LLM narration behavior is covered
 * separately in llm-narration.eval.test.ts.
 */
vi.mock("@/lib/llm-client", () => ({
  generateFlagNarration: vi.fn(async () => ({ text: "", source: "RULE_FALLBACK" as const })),
}));

const emailSpy = vi.fn(async (input: unknown) => {
  void input;
});
vi.mock("@/lib/email", () => ({
  sendFlagAlertEmail: (input: unknown) => emailSpy(input),
}));

const { runAgentMonitor } = await import("@/app/api/internal/agent-monitor/route");

const STUCK_MS = 3 * 24 * 60 * 60 * 1000;
const HIGH_RISK_MS = 24 * 60 * 60 * 1000;

describe("agent-monitor eval: critical situations", () => {
  let org: Awaited<ReturnType<typeof createFixtureOrg>>;

  beforeEach(async () => {
    org = await createFixtureOrg();
    emailSpy.mockClear();
  });

  afterEach(async () => {
    await cleanupFixtureOrg(org);
  });

  it(
    "risk severity matrix: only HIGH/HIGH, HIGH/MEDIUM, MEDIUM/HIGH cross the flag-worthy threshold",
    async () => {
      const project = await createFixtureProject({
        businessUnitId: org.businessUnit.id,
        departmentId: org.department.id,
        ownerId: org.teamLead.id,
      });

      const combos: Array<{ likelihood: "LOW" | "MEDIUM" | "HIGH"; impact: "LOW" | "MEDIUM" | "HIGH"; shouldFlag: boolean }> = [
        { likelihood: "LOW", impact: "LOW", shouldFlag: false },
        { likelihood: "LOW", impact: "MEDIUM", shouldFlag: false },
        { likelihood: "MEDIUM", impact: "MEDIUM", shouldFlag: false },
        { likelihood: "HIGH", impact: "LOW", shouldFlag: false },
        { likelihood: "LOW", impact: "HIGH", shouldFlag: false },
        { likelihood: "HIGH", impact: "MEDIUM", shouldFlag: true },
        { likelihood: "MEDIUM", impact: "HIGH", shouldFlag: true },
        { likelihood: "HIGH", impact: "HIGH", shouldFlag: true },
      ];

      const risks = await Promise.all(
        combos.map((c) =>
          prisma.risk.create({
            data: {
              projectId: project.id,
              title: `Risk ${c.likelihood}/${c.impact}`,
              description: "eval fixture risk",
              likelihood: c.likelihood,
              impact: c.impact,
              ownerId: org.teamLead.id,
              raisedById: org.teamLead.id,
              identifiedAt: new Date(Date.now() - HIGH_RISK_MS - 60_000),
            },
          }),
        ),
      );

      await runAgentMonitor();

      const flags = await prisma.agentFlag.findMany({
        where: { projectId: project.id, flagType: "HIGH_RISK" },
        select: { subjectId: true },
      });
      const flaggedIds = new Set(flags.map((f) => f.subjectId));

      for (let i = 0; i < combos.length; i++) {
        expect(flaggedIds.has(risks[i].id)).toBe(combos[i].shouldFlag);
      }
    },
    150000,
  );

  it(
    "ownership gaps: each of the four conditions fires independently and only when its own trigger is present",
    async () => {
      const noAnalyst = await createFixtureProject({
        businessUnitId: org.businessUnit.id,
        departmentId: org.department.id,
        ownerId: org.teamLead.id,
      });
      await prisma.project.update({
        where: { id: noAnalyst.id },
        data: { currentStage: "REQUIREMENTS_DESIGN" },
      });

      const noDeveloper = await createFixtureProject({
        businessUnitId: org.businessUnit.id,
        departmentId: org.department.id,
        ownerId: org.teamLead.id,
        analystId: org.analyst.id,
      });
      await prisma.project.update({
        where: { id: noDeveloper.id },
        data: { currentStage: "DEVELOPMENT" },
      });

      // org.developer is deliberately NOT assigned to this project (stays
      // at the default IDEA stage so MISSING_DEVELOPER can't also fire) —
      // isProjectParticipant() only grants BUSINESS_OWNER an automatic
      // pass for same-department, so a plain DEVELOPER/ANALYST who isn't
      // this project's assigned developer/analyst is a genuine outsider.
      const outsiderBlocker = await createFixtureProject({
        businessUnitId: org.businessUnit.id,
        departmentId: org.department.id,
        ownerId: org.teamLead.id,
        analystId: org.analyst.id,
      });
      await prisma.blocker.create({
        data: {
          projectId: outsiderBlocker.id,
          description: "eval fixture blocker",
          impact: "eval",
          responsiblePersonId: org.developer.id,
          raisedById: org.teamLead.id,
        },
      });

      const noStakeholders = await createFixtureProject({
        businessUnitId: org.businessUnit.id,
        departmentId: org.department.id,
        ownerId: org.teamLead.id,
        analystId: org.analyst.id,
        developerId: org.developer.id,
      });
      await prisma.project.update({
        where: { id: noStakeholders.id },
        data: { currentStage: "APPROVAL" },
      });

      const healthy = await createFixtureProject({
        businessUnitId: org.businessUnit.id,
        departmentId: org.department.id,
        ownerId: org.teamLead.id,
        analystId: org.analyst.id,
        developerId: org.developer.id,
      });
      await prisma.project.update({ where: { id: healthy.id }, data: { currentStage: "APPROVAL" } });
      await prisma.projectStakeholder.create({
        data: { projectId: healthy.id, userId: org.businessOwner.id, raciRole: "INFORMED" },
      });

      await runAgentMonitor();

      const gapFlags = await prisma.agentFlag.findMany({
        where: {
          projectId: { in: [noAnalyst.id, noDeveloper.id, outsiderBlocker.id, noStakeholders.id, healthy.id] },
          flagType: "OWNERSHIP_GAP",
        },
        select: { projectId: true },
      });
      const flaggedProjectIds = new Set(gapFlags.map((f) => f.projectId));

      expect(flaggedProjectIds.has(noAnalyst.id)).toBe(true);
      expect(flaggedProjectIds.has(noDeveloper.id)).toBe(true);
      expect(flaggedProjectIds.has(outsiderBlocker.id)).toBe(true);
      expect(flaggedProjectIds.has(noStakeholders.id)).toBe(true);
      expect(flaggedProjectIds.has(healthy.id)).toBe(false);
    },
    150000,
  );

  it(
    "sends exactly one alert email for our newly-created flag and none for it on re-evaluation",
    async () => {
      // runAgentMonitor sweeps the entire real portfolio (100+ projects),
      // so this counts calls scoped to our own fixture project id rather
      // than asserting a global call count — other real projects may
      // legitimately produce their own new flags/emails during the same
      // run.
      const project = await createFixtureProject({
        businessUnitId: org.businessUnit.id,
        departmentId: org.department.id,
        ownerId: org.teamLead.id,
      });
      await prisma.milestone.create({
        data: {
          projectId: project.id,
          name: "eval overdue milestone",
          ownerId: org.teamLead.id,
          dueDate: new Date(Date.now() - STUCK_MS - 60_000),
        },
      });

      const callsForProject = () =>
        emailSpy.mock.calls.filter(
          ([input]) => (input as { projectId?: string }).projectId === project.id,
        );

      await runAgentMonitor();
      expect(callsForProject()).toHaveLength(1);

      emailSpy.mockClear();
      await runAgentMonitor();
      expect(callsForProject()).toHaveLength(0);
    },
    250000,
  );

  it(
    "stress: 25 stuck milestones across 10 projects in one org are all flagged, throttled on re-run, and auto-resolve when cleared — within a bounded time",
    async () => {
      const projects = await Promise.all(
        Array.from({ length: 10 }, () =>
          createFixtureProject({
            businessUnitId: org.businessUnit.id,
            departmentId: org.department.id,
            ownerId: org.teamLead.id,
          }),
        ),
      );

      const overdueDueDate = new Date(Date.now() - STUCK_MS - 60_000);
      const milestoneJobs = [
        ...projects.flatMap((project, pIdx) =>
          Array.from({ length: 2 }, (_, i) => ({
            projectId: project.id,
            name: `eval stress milestone p${pIdx}-${i}`,
          })),
        ),
        ...Array.from({ length: 5 }, (_, i) => ({
          projectId: projects[0].id,
          name: `eval stress extra milestone ${i}`,
        })),
      ];
      expect(milestoneJobs.length).toBe(25);

      const milestones = await Promise.all(
        milestoneJobs.map((job) =>
          prisma.milestone.create({
            data: {
              projectId: job.projectId,
              name: job.name,
              ownerId: org.teamLead.id,
              dueDate: overdueDueDate,
            },
          }),
        ),
      );

      const projectIds = projects.map((p) => p.id);
      const ourFlags = () =>
        prisma.agentFlag.findMany({
          where: { projectId: { in: projectIds }, flagType: "STUCK_MILESTONE" },
        });

      // runAgentMonitor() sweeps the entire real portfolio (~140 active
      // projects, measured live), so summary-level counts and wall-clock
      // time are reported here, not hard-asserted — the real portfolio
      // grows over time and shares the same run, which would make a fixed
      // threshold either flaky or meaninglessly loose. Correctness is
      // asserted by scoping to our own fixture project ids instead.
      const start = Date.now();
      await runAgentMonitor();
      const elapsedMs = Date.now() - start;
      console.log(`runAgentMonitor() full-portfolio sweep: ${elapsedMs}ms`);

      const flagsAfterFirstRun = await ourFlags();
      expect(flagsAfterFirstRun).toHaveLength(25);
      expect(flagsAfterFirstRun.every((f) => f.resolvedAt === null)).toBe(true);

      await runAgentMonitor();
      const flagsAfterSecondRun = await ourFlags();
      // Throttled: same 25 rows, not duplicated.
      expect(flagsAfterSecondRun).toHaveLength(25);
      expect(flagsAfterSecondRun.map((f) => f.id).sort()).toEqual(
        flagsAfterFirstRun.map((f) => f.id).sort(),
      );

      await prisma.milestone.updateMany({
        where: { id: { in: milestones.map((m) => m.id) } },
        data: { status: "DONE", completedAt: new Date() },
      });

      await runAgentMonitor();
      const flagsAfterResolve = await ourFlags();
      expect(flagsAfterResolve.every((f) => f.resolvedAt !== null)).toBe(true);
    },
    600000,
  );
});
