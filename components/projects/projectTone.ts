import type {
  DelayReasonCategory,
  MilestoneStatus,
  ProjectHealth,
  ProjectStage,
  TaskStatus,
} from "@prisma/client";
import type { Tone } from "@/components/ui/tone";

/**
 * Domain tone/label maps for the Project surface. Kept alongside the domain
 * per `components/ui/tone.ts`'s own instruction — the generic file only
 * carries the token→class mapping every domain reuses.
 */

export const STAGE_ORDER: readonly ProjectStage[] = [
  "IDEA",
  "DISCOVERY",
  "REQUIREMENTS_DESIGN",
  "APPROVAL",
  "DEVELOPMENT",
  "INTERNAL_TESTING",
  "BUSINESS_TESTING_UAT",
  "DEPLOYMENT",
  "STABILIZATION",
  "COMPLETED",
] as const;

export const STAGE_LABELS: Record<ProjectStage, string> = {
  IDEA: "Idea",
  DISCOVERY: "Discovery",
  REQUIREMENTS_DESIGN: "Requirements & Design",
  APPROVAL: "Approval",
  DEVELOPMENT: "Development",
  INTERNAL_TESTING: "Internal Testing",
  BUSINESS_TESTING_UAT: "Business Testing (UAT)",
  DEPLOYMENT: "Deployment",
  STABILIZATION: "Stabilization",
  COMPLETED: "Completed",
};

/**
 * ON_TRACK=success (nothing to flag), AT_RISK=warning (a milestone is
 * approaching), DELAYED=error (a milestone has actually slipped),
 * BLOCKED=neutral-with-error-emphasis — a blocker is a "someone must act"
 * state distinct from a schedule slip, so it gets its own dot-forward
 * neutral-surface treatment rather than reusing the "late" red.
 */
export const HEALTH_TONE: Record<ProjectHealth, Tone> = {
  ON_TRACK: "success",
  AT_RISK: "warning",
  DELAYED: "error",
  BLOCKED: "neutral",
};

export const HEALTH_LABELS: Record<ProjectHealth, string> = {
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  DELAYED: "Delayed",
  BLOCKED: "Blocked",
};

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

export const MILESTONE_STATUS_TONE: Record<MilestoneStatus, Tone> = {
  PENDING: "neutral",
  IN_PROGRESS: "accent",
  DONE: "success",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  BLOCKED: "Blocked",
};

export const TASK_STATUS_TONE: Record<TaskStatus, Tone> = {
  PENDING: "neutral",
  IN_PROGRESS: "accent",
  DONE: "success",
  BLOCKED: "error",
};

export const DELAY_REASON_LABELS: Record<DelayReasonCategory, string> = {
  REQUIREMENTS_NOT_FINALIZED: "Requirements not finalized",
  RESOURCE_UNAVAILABLE: "Resource unavailable",
  WAITING_FOR_BUSINESS_FEEDBACK: "Waiting for business feedback",
  SCOPE_CHANGE: "Scope change",
  DATA_UNAVAILABLE: "Data unavailable",
  TESTING_ISSUE: "Testing issue",
  DEVELOPMENT_ISSUE: "Development issue",
  APPROVAL_PENDING: "Approval pending",
  INTEGRATION_DEPENDENCY: "Integration dependency",
  OTHER: "Other",
};

/**
 * Client-safe mirror of `lib/project-stages.ts`'s `nextStage` — that module
 * is `server-only` (it does DB writes), so client components read the
 * one-step-forward rule off this file's own `STAGE_ORDER` instead.
 */
export function nextStage(stage: ProjectStage): ProjectStage | null {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx === -1 || idx === STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

export function roleLabel(role: string): string {
  return role
    .toLowerCase()
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}
