import "server-only";
import { JoiningChecklistItemStatus } from "@prisma/client";
import { prisma } from "../prisma";

/**
 * Joining-readiness aggregation (BUILD_PLAN.md Sec 3.1 item 6; PDF
 * Scenario 5: "Show readiness for joining"). Mirrors Phase 4/5's
 * reporting-function style (lib/reporting/evaluation-summary.ts): pure
 * aggregation over existing rows, no side effects, no write path.
 *
 * Unlike the evaluation summary (which deliberately avoids deriving a
 * hiring recommendation, per the PDF's "must not make the final hiring
 * decision"), a joining-readiness boolean is fine to compute here — it
 * is a mechanical fact ("are all checklist items done?"), not a
 * judgment call about a candidate. Nothing here decides whether the
 * candidate SHOULD join; it only reports whether the checklist is
 * complete.
 */

export interface JoiningReadinessSummary {
  applicationId: string;
  totalItems: number;
  completedCount: number;
  pendingCount: number;
  inProgressCount: number;
  blockedCount: number;
  /** Items with a dueDate in the past whose status is not DONE. */
  overdueCount: number;
  overdueItems: { id: string; label: string; dueDate: string; ownerId: string; ownerName: string }[];
  /** completedCount / totalItems, 0 when there are no items yet. */
  completionPercentage: number;
  /** true only when there is at least one item AND every item is DONE. */
  isReady: boolean;
}

export async function getJoiningReadiness(
  applicationId: string,
): Promise<JoiningReadinessSummary | null> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { id: true },
  });
  if (!application) return null;

  const items = await prisma.joiningChecklistItem.findMany({
    where: { applicationId },
    include: { owner: { select: { id: true, name: true } } },
  });

  const now = new Date();
  const totalItems = items.length;
  const completedCount = items.filter(
    (i) => i.status === JoiningChecklistItemStatus.DONE,
  ).length;
  const pendingCount = items.filter(
    (i) => i.status === JoiningChecklistItemStatus.PENDING,
  ).length;
  const inProgressCount = items.filter(
    (i) => i.status === JoiningChecklistItemStatus.IN_PROGRESS,
  ).length;
  const blockedCount = items.filter(
    (i) => i.status === JoiningChecklistItemStatus.BLOCKED,
  ).length;

  const overdue = items.filter(
    (i) =>
      i.dueDate !== null &&
      i.dueDate.getTime() < now.getTime() &&
      i.status !== JoiningChecklistItemStatus.DONE,
  );

  return {
    applicationId,
    totalItems,
    completedCount,
    pendingCount,
    inProgressCount,
    blockedCount,
    overdueCount: overdue.length,
    overdueItems: overdue.map((i) => ({
      id: i.id,
      label: i.label,
      dueDate: i.dueDate!.toISOString(),
      ownerId: i.ownerId,
      ownerName: i.owner.name,
    })),
    completionPercentage: totalItems === 0 ? 0 : completedCount / totalItems,
    isReady: totalItems > 0 && completedCount === totalItems,
  };
}
