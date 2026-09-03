/**
 * Semantic tone mapping for status/stage display.
 *
 * DESIGN.md > Color: "semantic colors reserved for status meaning, not
 * decoration". Every mapping is a meaning claim, and each should be
 * justified — if a new state needs a colour, add it here with its
 * rationale rather than picking a class at the call site.
 *
 * Domain-specific tone maps (ProjectStage, ProjectHealth, BlockerStatus,
 * etc.) live alongside the domain they describe, not here — this file
 * only carries the generic token→class mapping every domain reuses.
 */

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
