import "server-only";
import { prisma } from "./prisma";
import type { Risk, RiskEvent, RiskImpact, RiskLikelihood, RiskStatus } from "@prisma/client";

export class RiskNotFoundError extends Error {}

const LEVEL_WEIGHT: Record<RiskLikelihood | RiskImpact, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
};

/**
 * 3x3 likelihood x impact matrix collapsed to a 1-3 severity tier.
 * HIGH/HIGH is always top tier (3). HIGH/MEDIUM or MEDIUM/HIGH is also
 * top tier (3) — this mirrors the monitoring loop's flag-worthy
 * threshold (AGENTIC_DASHBOARD_PLAN.md "NEW — Risk entity"), which
 * treats "one HIGH, one at-least-MEDIUM" as equally urgent to
 * HIGH/HIGH rather than a notch below it. Everything else scales by
 * summed weight: LOW/LOW..LOW/MEDIUM is tier 1, the remaining
 * combinations are tier 2.
 */
export function computeRiskSeverity(
  likelihood: RiskLikelihood,
  impact: RiskImpact,
): number {
  if (likelihood === "HIGH" && impact === "HIGH") return 3;
  if (
    (likelihood === "HIGH" && impact === "MEDIUM") ||
    (likelihood === "MEDIUM" && impact === "HIGH")
  ) {
    return 3;
  }
  const weight = LEVEL_WEIGHT[likelihood] + LEVEL_WEIGHT[impact];
  return weight <= 1 ? 1 : 2;
}

/**
 * Writes a RiskEvent (fromStatus/toStatus/actorId/note) and moves the
 * Risk to `toStatus` in a single transaction — this is the only path
 * that should ever change Risk.status, mirroring how
 * lib/project-stages.ts is the only path that changes
 * Project.currentStage.
 */
export async function recordRiskStatusChange(
  riskId: string,
  toStatus: RiskStatus,
  actorId: string,
  note?: string,
): Promise<{ risk: Risk; event: RiskEvent }> {
  const risk = await prisma.risk.findUnique({ where: { id: riskId } });
  if (!risk) {
    throw new RiskNotFoundError(`Risk not found: ${riskId}`);
  }

  const resolvedAt =
    toStatus === "RESOLVED" || toStatus === "ACCEPTED" ? new Date() : null;

  const [event, updatedRisk] = await prisma.$transaction([
    prisma.riskEvent.create({
      data: {
        riskId: risk.id,
        fromStatus: risk.status,
        toStatus,
        actorId,
        note,
      },
    }),
    prisma.risk.update({
      where: { id: risk.id },
      data: { status: toStatus, resolvedAt },
    }),
  ]);

  return { risk: updatedRisk, event };
}
