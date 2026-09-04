import type { Tone } from "@/components/ui/tone";

/**
 * Serialisable view models for the My Work surface.
 *
 * The page's Prisma records carry `Date` objects and Prisma enums; the queue
 * itself is a client component (it filters in place, without a round trip), so
 * everything that crosses that boundary is flattened here: dates become ISO
 * day strings, and every derived judgement — is it late, which bucket, which
 * tone — is computed once on the server rather than re-derived per render.
 */

export type QueueKind = "task" | "milestone";

/** Time buckets, in the order they are read. */
export type QueueBucket = "overdue" | "today" | "week" | "later" | "undated";

export interface QueueItem {
  id: string;
  kind: QueueKind;
  /** The task's action or the milestone's name. */
  title: string;
  projectId: string;
  projectName: string;
  /** ISO-8601 day (`YYYY-MM-DD`), or null when a task carries no deadline. */
  dueIso: string | null;
  /** Whole UTC days from today; negative when the date has passed. */
  daysUntilDue: number | null;
  bucket: QueueBucket;
  overdue: boolean;
  statusLabel: string;
  statusTone: Tone;
}

export interface AssignedProject {
  id: string;
  name: string;
  healthLabel: string;
  healthTone: Tone;
  stageLabel: string;
  /** 1-based position in the ten-stage lifecycle. */
  stageStep: number;
  stageCount: number;
  dueIso: string;
}
