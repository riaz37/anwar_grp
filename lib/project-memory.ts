import "server-only";
import { prisma } from "./prisma";

export type TimelineEntryType =
  | "STAGE_CHANGE"
  | "DELAY_REASON"
  | "BLOCKER_RAISED"
  | "BLOCKER_RESOLVED"
  | "SCOPE_CHANGE"
  | "RISK_RAISED"
  | "RISK_STATUS_CHANGE"
  | "AGENT_FLAG_RAISED"
  | "AGENT_FLAG_RESOLVED";

export interface ProjectTimelineEntry {
  type: TimelineEntryType;
  timestamp: Date;
  actorId: string | null;
  actorName: string | null;
  summary: string;
}

/**
 * Merges every event source that makes up "project memory" — stage
 * history, delay reasons, blockers (raised + resolved as two entries),
 * scope changes, risk creation + status changes, and agent flags
 * (raised + resolved) — into one chronologically-sorted list. This is
 * a read-side aggregation only; none of these tables are written here
 * (AGENTIC_DASHBOARD_PLAN.md "NEW — Project memory / timeline surface").
 */
export async function getProjectTimeline(
  projectId: string,
  opts?: { types?: string[] },
): Promise<ProjectTimelineEntry[]> {
  const [stageHistory, delayReasons, blockers, scopeChanges, risks, agentFlags] =
    await Promise.all([
      prisma.projectStageHistory.findMany({
        where: { projectId },
        include: { actor: true },
      }),
      prisma.delayReason.findMany({
        where: { projectId },
        include: { recordedBy: true },
      }),
      prisma.blocker.findMany({
        where: { projectId },
        include: { raisedBy: true, resolvedBy: true },
      }),
      prisma.scopeChange.findMany({
        where: { projectId },
        include: { requestedBy: true },
      }),
      prisma.risk.findMany({
        where: { projectId },
        include: { raisedBy: true, events: { include: { actor: true } } },
      }),
      prisma.agentFlag.findMany({ where: { projectId } }),
    ]);

  const entries: ProjectTimelineEntry[] = [];

  for (const history of stageHistory) {
    entries.push({
      type: "STAGE_CHANGE",
      timestamp: history.changedAt,
      actorId: history.actorId,
      actorName: history.actor.name,
      summary: history.fromStage
        ? `Stage changed from ${history.fromStage} to ${history.toStage}.`
        : `Project created in stage ${history.toStage}.`,
    });
  }

  for (const delayReason of delayReasons) {
    entries.push({
      type: "DELAY_REASON",
      timestamp: delayReason.createdAt,
      actorId: delayReason.recordedById,
      actorName: delayReason.recordedBy.name,
      summary: `Delay reason recorded: ${delayReason.category}${
        delayReason.note ? ` — ${delayReason.note}` : ""
      }`,
    });
  }

  for (const blocker of blockers) {
    entries.push({
      type: "BLOCKER_RAISED",
      timestamp: blocker.createdAt,
      actorId: blocker.raisedById,
      actorName: blocker.raisedBy.name,
      summary: `Blocker raised: ${blocker.description}`,
    });
    if (blocker.resolvedAt) {
      entries.push({
        type: "BLOCKER_RESOLVED",
        timestamp: blocker.resolvedAt,
        actorId: blocker.resolvedById,
        actorName: blocker.resolvedBy?.name ?? null,
        summary: `Blocker resolved: ${blocker.description}${
          blocker.resolutionNotes ? ` — ${blocker.resolutionNotes}` : ""
        }`,
      });
    }
  }

  for (const scopeChange of scopeChanges) {
    entries.push({
      type: "SCOPE_CHANGE",
      timestamp: scopeChange.createdAt,
      actorId: scopeChange.requestedById,
      actorName: scopeChange.requestedBy.name,
      summary: `Scope change requested: ${scopeChange.reason}`,
    });
  }

  for (const risk of risks) {
    entries.push({
      type: "RISK_RAISED",
      timestamp: risk.createdAt,
      actorId: risk.raisedById,
      actorName: risk.raisedBy.name,
      summary: `Risk raised: ${risk.title} (${risk.likelihood}/${risk.impact}).`,
    });
    for (const event of risk.events) {
      entries.push({
        type: "RISK_STATUS_CHANGE",
        timestamp: event.createdAt,
        actorId: event.actorId,
        actorName: event.actor.name,
        summary: `Risk "${risk.title}" status changed ${
          event.fromStatus ? `from ${event.fromStatus} ` : ""
        }to ${event.toStatus}${event.note ? ` — ${event.note}` : ""}.`,
      });
    }
  }

  for (const flag of agentFlags) {
    entries.push({
      type: "AGENT_FLAG_RAISED",
      timestamp: flag.firstFlaggedAt,
      actorId: null,
      actorName: null,
      summary: `Agent flag raised: ${flag.flagType} — ${flag.narration}`,
    });
    if (flag.resolvedAt) {
      entries.push({
        type: "AGENT_FLAG_RESOLVED",
        timestamp: flag.resolvedAt,
        actorId: null,
        actorName: null,
        summary: `Agent flag resolved: ${flag.flagType}${
          flag.resolutionReason ? ` — ${flag.resolutionReason}` : ""
        }`,
      });
    }
  }

  const filtered = opts?.types
    ? entries.filter((entry) => opts.types!.includes(entry.type))
    : entries;

  return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}
