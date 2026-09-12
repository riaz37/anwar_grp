import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { computeRiskSeverity, recordRiskStatusChange } from "@/lib/risk-engine";
import type { RiskImpact, RiskLikelihood, RiskStatus } from "@prisma/client";
import { cleanupFixtureOrg, createFixtureOrg, createFixtureProject } from "../integration/setup-fixtures";

describe("computeRiskSeverity", () => {
  // Full 3x3 likelihood x impact matrix — see lib/risk-engine.ts's
  // LEVEL_WEIGHT/HIGH-pairing comment for the derivation of these tiers.
  const EXPECTED: Record<RiskLikelihood, Record<RiskImpact, number>> = {
    LOW: { LOW: 1, MEDIUM: 1, HIGH: 2 },
    MEDIUM: { LOW: 1, MEDIUM: 2, HIGH: 3 },
    HIGH: { LOW: 2, MEDIUM: 3, HIGH: 3 },
  };

  for (const likelihood of Object.keys(EXPECTED) as RiskLikelihood[]) {
    for (const impact of Object.keys(EXPECTED[likelihood]) as RiskImpact[]) {
      const expected = EXPECTED[likelihood][impact];
      it(`is tier ${expected} for likelihood=${likelihood}, impact=${impact}`, () => {
        expect(computeRiskSeverity(likelihood, impact)).toBe(expected);
      });
    }
  }
});

describe("recordRiskStatusChange", () => {
  let org: Awaited<ReturnType<typeof createFixtureOrg>>;

  beforeEach(async () => {
    org = await createFixtureOrg();
  });

  afterEach(async () => {
    await cleanupFixtureOrg(org);
  });

  async function createFixtureRisk(status: RiskStatus = "OPEN") {
    const project = await createFixtureProject({
      businessUnitId: org.businessUnit.id,
      departmentId: org.department.id,
      ownerId: org.teamLead.id,
    });
    const risk = await prisma.risk.create({
      data: {
        projectId: project.id,
        title: "Vendor API deprecation",
        description: "The upstream vendor API is being deprecated next quarter.",
        likelihood: "HIGH",
        impact: "MEDIUM",
        status,
        ownerId: org.teamLead.id,
        raisedById: org.analyst.id,
      },
    });
    return { project, risk };
  }

  it("writes a RiskEvent with the correct fromStatus/toStatus and updates Risk.status", async () => {
    const { risk } = await createFixtureRisk();

    const { risk: updated, event } = await recordRiskStatusChange(
      risk.id,
      "MITIGATING",
      org.analyst.id,
      "Started mitigation.",
    );

    expect(event.fromStatus).toBe("OPEN");
    expect(event.toStatus).toBe("MITIGATING");
    expect(event.actorId).toBe(org.analyst.id);
    expect(event.note).toBe("Started mitigation.");
    expect(updated.status).toBe("MITIGATING");

    const events = await prisma.riskEvent.findMany({ where: { riskId: risk.id } });
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe(event.id);
  });

  it("sets resolvedAt when transitioning into RESOLVED", async () => {
    const { risk } = await createFixtureRisk();
    const { risk: updated } = await recordRiskStatusChange(risk.id, "RESOLVED", org.teamLead.id);
    expect(updated.status).toBe("RESOLVED");
    expect(updated.resolvedAt).not.toBeNull();
  });

  it("sets resolvedAt when transitioning into ACCEPTED", async () => {
    const { risk } = await createFixtureRisk();
    const { risk: updated } = await recordRiskStatusChange(risk.id, "ACCEPTED", org.teamLead.id);
    expect(updated.status).toBe("ACCEPTED");
    expect(updated.resolvedAt).not.toBeNull();
  });

  it("clears resolvedAt when transitioning back out of RESOLVED", async () => {
    const { risk } = await createFixtureRisk();
    const { risk: resolved } = await recordRiskStatusChange(risk.id, "RESOLVED", org.teamLead.id);
    expect(resolved.resolvedAt).not.toBeNull();

    const { risk: reopened, event } = await recordRiskStatusChange(
      risk.id,
      "MITIGATING",
      org.teamLead.id,
    );
    expect(event.fromStatus).toBe("RESOLVED");
    expect(event.toStatus).toBe("MITIGATING");
    expect(reopened.status).toBe("MITIGATING");
    expect(reopened.resolvedAt).toBeNull();
  });

  it("clears resolvedAt when transitioning back out of ACCEPTED", async () => {
    const { risk } = await createFixtureRisk();
    await recordRiskStatusChange(risk.id, "ACCEPTED", org.teamLead.id);
    const { risk: reopened } = await recordRiskStatusChange(risk.id, "OPEN", org.teamLead.id);
    expect(reopened.status).toBe("OPEN");
    expect(reopened.resolvedAt).toBeNull();
  });
});
