import "server-only";

/**
 * Field allowlist enforcement for candidate-facing message templates.
 *
 * SECURITY / PRODUCT REQUIREMENT (PDF Communication section):
 * "internal notes and rejection reasons must never appear automatically
 * in candidate messages." This is enforced with TWO independent layers,
 * neither of which alone is trusted:
 *
 *  1. SAFE_FIELD_REGISTRY below is the hardcoded, closed set of fields
 *     that are EVER eligible to be rendered into a candidate-facing
 *     message. `internal_notes` and `rejection_reason` (or anything
 *     carrying free-text internal reasoning) are NOT members of this
 *     set — full stop. There is no code path, template configuration,
 *     or API call that can add to this set at runtime; changing it
 *     requires a source-code change and review.
 *  2. `MessageTemplate.allowedFields` (a per-template allowlist an
 *     admin declares) is intersected against SAFE_FIELD_REGISTRY at
 *     render time — so even if a template were misconfigured with
 *     `allowedFields: ["internal_notes"]`, renderTemplate() below
 *     ignores that entry because it isn't in the registry.
 *
 * On top of both allowlists, the `context` object passed to
 * renderTemplate() is built by the calling route from known-safe
 * Application/Candidate/Interview fields ONLY (see
 * app/api/v1/applications/[id]/communications/route.ts) — internal
 * notes / rejection reasons are simply never placed into that object,
 * so there is no key for a misconfigured template to even reference.
 */

export const SAFE_FIELD_REGISTRY = [
  "candidateName",
  "positionTitle",
  "requisitionPosition",
  "recruiterName",
  "companyName",
  "interviewRoundNumber",
  "interviewDate",
  "interviewTime",
  "interviewDurationMinutes",
  "interviewLocation",
  "interviewOnlineLink",
  "candidateInstructions",
  "assessmentType",
  "assessmentDate",
  "documentRequestList",
  "joiningDate",
  "rescheduledFromDate",
  "rescheduledToDate",
] as const;

export type SafeFieldName = (typeof SAFE_FIELD_REGISTRY)[number];

const SAFE_FIELD_SET: ReadonlySet<string> = new Set(SAFE_FIELD_REGISTRY);

/** Fields that must never be renderable, documented explicitly (never add
 * these to SAFE_FIELD_REGISTRY above). Used only for a defensive runtime
 * assertion, not as the actual enforcement mechanism (absence is). */
const NEVER_SAFE_FIELDS = ["internal_notes", "rejection_reason", "internalNotes", "rejectionReason"] as const;

for (const forbidden of NEVER_SAFE_FIELDS) {
  if ((SAFE_FIELD_SET as Set<string>).has(forbidden)) {
    // This should be unreachable — if it ever fires, someone added a
    // forbidden field to the registry above. Fail loudly at import time.
    throw new Error(
      `SECURITY INVARIANT VIOLATED: "${forbidden}" must never be a member of SAFE_FIELD_REGISTRY.`,
    );
  }
}

export type TemplateContext = Partial<Record<SafeFieldName, string>>;

export interface RenderableTemplate {
  bodyTemplate: string;
  subject?: string | null;
  allowedFields: string[];
}

export interface RenderedTemplate {
  renderedBody: string;
  renderedSubject: string | null;
}

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/**
 * Renders a template's bodyTemplate/subject, substituting only
 * placeholders that are BOTH in `template.allowedFields` AND in
 * SAFE_FIELD_REGISTRY, using values present in `context`. Any other
 * placeholder (unknown field, not in the template's allowlist, not in
 * the safe registry, or simply missing from context) resolves to an
 * empty string rather than leaking the raw `{{field}}` token or
 * throwing — draft flows should still surface unresolved fields to the
 * recruiter for review (the API route diffs allowedFields against
 * SAFE_FIELD_REGISTRY at template-create time), but rendering itself
 * always fails safe/empty.
 */
export function renderTemplate(
  template: RenderableTemplate,
  context: TemplateContext,
): RenderedTemplate {
  const allowed = new Set(
    template.allowedFields.filter((field) => SAFE_FIELD_SET.has(field)),
  );

  const fill = (text: string): string =>
    text.replace(PLACEHOLDER_PATTERN, (_match, field: string) => {
      if (!allowed.has(field)) return "";
      const value = context[field as SafeFieldName];
      return value ?? "";
    });

  return {
    renderedBody: fill(template.bodyTemplate),
    renderedSubject: template.subject ? fill(template.subject) : null,
  };
}

/** Filters an incoming allowedFields list down to the safe registry —
 * used by the message-template create route so a template can never be
 * persisted claiming an unsafe field, even informationally. */
export function sanitizeAllowedFields(fields: string[]): SafeFieldName[] {
  return fields.filter((f): f is SafeFieldName =>
    SAFE_FIELD_SET.has(f),
  );
}
