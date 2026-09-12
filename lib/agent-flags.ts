import "server-only";
import { prisma } from "./prisma";
import type { AgentFlag, AgentFlagType, NarrationSource } from "@prisma/client";

export interface UpsertFlagParams {
  projectId: string;
  flagType: AgentFlagType;
  subjectId: string;
  narration: string;
  narrationSource: NarrationSource;
  severity: number;
}

/**
 * Throttled write for the monitoring loop: one row per
 * (projectId, flagType, subjectId) — enforced by the @@unique
 * constraint on AgentFlag. Creates the row if absent; if a row already
 * exists, narration/severity/lastEvaluatedAt are refreshed and
 * resolvedAt/resolutionReason are cleared — the caller only reaches
 * upsertFlag for a condition it just detected as still (or newly
 * again) active, so a prior resolution must not linger on the row.
 * Without this, a flag that reopens after being auto-resolved (see
 * autoResolveStaleFlags) would keep showing resolvedAt set even while
 * its email alert correctly fires for the new occurrence.
 */
export async function upsertFlag(params: UpsertFlagParams): Promise<AgentFlag> {
  return prisma.agentFlag.upsert({
    where: {
      projectId_flagType_subjectId: {
        projectId: params.projectId,
        flagType: params.flagType,
        subjectId: params.subjectId,
      },
    },
    create: {
      projectId: params.projectId,
      flagType: params.flagType,
      subjectId: params.subjectId,
      narration: params.narration,
      narrationSource: params.narrationSource,
      severity: params.severity,
    },
    update: {
      narration: params.narration,
      narrationSource: params.narrationSource,
      severity: params.severity,
      lastEvaluatedAt: new Date(),
      resolvedAt: null,
      resolutionReason: null,
    },
  });
}

export interface StillOpenSubject {
  flagType: AgentFlagType;
  subjectId: string;
}

/**
 * Resolves every currently-open AgentFlag for `projectId` whose
 * (flagType, subjectId) is absent from `stillOpenSubjectIds` — the
 * condition that raised it no longer holds (milestone done, blocker
 * resolved, risk closed, ownership filled). Sets resolvedAt +
 * resolutionReason: "CONDITION_CLEARED".
 */
export async function autoResolveStaleFlags(
  projectId: string,
  stillOpenSubjectIds: StillOpenSubject[],
): Promise<number> {
  const openFlags = await prisma.agentFlag.findMany({
    where: { projectId, resolvedAt: null },
    select: { id: true, flagType: true, subjectId: true },
  });

  const stillOpen = new Set(
    stillOpenSubjectIds.map((subject) => `${subject.flagType}:${subject.subjectId}`),
  );
  const staleIds = openFlags
    .filter((flag) => !stillOpen.has(`${flag.flagType}:${flag.subjectId}`))
    .map((flag) => flag.id);

  if (staleIds.length === 0) return 0;

  const result = await prisma.agentFlag.updateMany({
    where: { id: { in: staleIds } },
    data: { resolvedAt: new Date(), resolutionReason: "CONDITION_CLEARED" },
  });
  return result.count;
}
