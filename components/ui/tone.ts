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
  neutral: "border-outline-low bg-surface-2 text-muted-foreground",
  accent: "border-primary-wash bg-primary-wash text-primary-high",
  info: "border-info-outline bg-info-wash text-info-high",
  warning: "border-warn-outline bg-warn-wash text-warn-high",
  success: "border-success-outline bg-success-wash text-success-high",
  error: "border-danger-outline bg-danger-wash text-danger-high",
};

export const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-text-low",
  accent: "bg-primary-med",
  info: "bg-info-med",
  warning: "bg-warn-med",
  success: "bg-success-med",
  error: "bg-danger-med",
};

export const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-muted-foreground",
  accent: "text-primary-high",
  info: "text-info-high",
  warning: "text-warn-high",
  success: "text-success-high",
  error: "text-danger-high",
};
