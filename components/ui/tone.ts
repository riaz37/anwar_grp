/**
 * Semantic tone mapping for status/stage display.
 *
 * DESIGN.md > Color: "semantic colors reserved for status meaning, not
 * decoration". Every mapping below is a meaning claim, and each is justified —
 * if a new state needs a colour, add it here with its rationale rather than
 * picking a class at the call site.
 *
 * Tone → token pairing (all six clear 4.5:1 in both light and dark, using the
 * `-ink` text variants added in DESIGN.md's decision log):
 *   neutral — no signal; the record is inert or not yet in flight
 *   accent  — live: this is where work is actually happening right now
 *   info    — paused / moved elsewhere; true but not actionable
 *   warning — waiting on somebody; time is passing
 *   success — a good ending
 *   error   — a negative ending
 */

import type {
  ApplicationStage,
  RequisitionStatus,
} from "@/lib/types/domain";

export type Tone = "neutral" | "accent" | "info" | "warning" | "success" | "error";

/** Pill surface: soft fill + ink text + a full-saturation dot marker. */
export const TONE_PILL: Record<Tone, string> = {
  neutral: "border-border bg-surface-sunken text-muted",
  accent: "border-accent-soft bg-accent-soft text-accent-ink",
  info: "border-info-soft bg-info-soft text-info-ink",
  warning: "border-warning-soft bg-warning-soft text-warning-ink",
  success: "border-success-soft bg-success-soft text-success-ink",
  error: "border-error-soft bg-error-soft text-error-ink",
};

export const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-border-strong",
  accent: "bg-accent",
  info: "bg-info",
  warning: "bg-warning",
  success: "bg-success",
  error: "bg-error",
};

export const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-muted",
  accent: "text-accent-ink",
  info: "text-info-ink",
  warning: "text-warning-ink",
  success: "text-success-ink",
  error: "text-error-ink",
};

/**
 * Requisition approval status → tone.
 *
 * DRAFT             neutral — not submitted; carries no obligation for anyone.
 * AWAITING_APPROVAL warning — someone is being waited on (DESIGN.md names
 *                             "awaiting approval" as the warning example).
 * APPROVED          info    — a true, informational milestone; sourcing has
 *                             not started, so it is not yet "live work".
 * OPEN              accent  — the one state where recruiting is actively
 *                             happening. Brass draws the eye down the table to
 *                             the rows that need people on them.
 * ON_HOLD           info    — DESIGN.md names "On Hold" as the info example.
 * FILLED            success — DESIGN.md names "Filled" as a success example.
 * CLOSED            neutral — an ending, but not a failure (closed unfilled is
 *                             a business decision, not an error), so
 *                             deliberately not `error`.
 */
export const REQUISITION_STATUS_TONE: Record<RequisitionStatus, Tone> = {
  DRAFT: "neutral",
  AWAITING_APPROVAL: "warning",
  APPROVED: "info",
  OPEN: "accent",
  ON_HOLD: "info",
  FILLED: "success",
  CLOSED: "neutral",
};

/**
 * Application stage → tone.
 *
 * Every live pipeline stage is `accent`: the stage name itself already says
 * where in the process the application is, so colour is used for the single
 * distinction a scanning recruiter actually needs — is this still moving, and
 * if it stopped, how did it stop.
 *
 * FEEDBACK_PENDING and APPROVAL are the two pipeline stages that mean "blocked
 * on another human", which is exactly DESIGN.md's `warning` definition, so
 * they get warning rather than accent.
 */
export const STAGE_TONE: Record<ApplicationStage, Tone> = {
  NEW: "accent",
  SCREENING: "accent",
  ASSESSMENT: "accent",
  INTERVIEW: "accent",
  FEEDBACK_PENDING: "warning",
  APPROVAL: "warning",
  SELECTED: "accent",
  JOINING: "accent",
  JOINED: "success",
  ON_HOLD: "info",
  REJECTED: "error",
  WITHDRAWN: "neutral",
  REDIRECTED: "info",
  CLOSED: "neutral",
};

/**
 * Stages rendered struck through: the application ended without a decision
 * being reached on this requisition. REJECTED is excluded on purpose — it is a
 * real decision, and `error` tone plus a strike would over-state it.
 */
export const STRUCK_STAGES: ReadonlySet<ApplicationStage> = new Set([
  "WITHDRAWN",
  "CLOSED",
]);
