/**
 * The message-template field allowlist.
 *
 * BUILD_PLAN.md Sec 2.8 states the rule as a *structural* one:
 *
 *   "MessageTemplate (versioned, field-allowlisted — internal_notes and
 *    rejection_reason are structurally NOT in the allowlist)"
 *
 * and spec Sec 6 > Communication says the same thing in the client's words:
 * "Internal notes and rejection reasons must never appear automatically in
 * candidate messages."
 *
 * Two lists live here rather than one, on purpose:
 *
 *  - `MESSAGE_FIELDS` is the allowlist. A placeholder outside it never
 *    resolves, in any template, for any event.
 *  - `BLOCKED_MESSAGE_FIELDS` names the fields a recruiter might *reasonably
 *    expect* to be available and explains, in the recruiter's language, why
 *    they are not. The server enforces the rule; this list is what lets the UI
 *    say so before someone wastes ten minutes looking for the merge field.
 *
 * This module is pure data + pure functions: it is imported by both a client
 * component (the draft form's preview) and — once the backend lands — the
 * server-side renderer, and must stay free of `next/*` and Node imports.
 */

export interface MessageField {
  /** Placeholder path as written in a template body: `{{candidate.name}}`. */
  path: string;
  label: string;
  /** What the recruiter will see in place of the placeholder. */
  example: string;
}

/**
 * Every field any template may interpolate. Grouped by source record so the
 * "available fields" list in the draft form reads as something a recruiter can
 * scan, rather than 22 flat strings.
 */
export const MESSAGE_FIELD_GROUPS: ReadonlyArray<{
  source: string;
  fields: readonly MessageField[];
}> = [
  {
    source: "Candidate",
    fields: [
      { path: "candidate.name", label: "Full name", example: "Ayesha Siddika" },
      { path: "candidate.first_name", label: "First name", example: "Ayesha" },
      { path: "candidate.email", label: "Email", example: "ayesha@example.com" },
      { path: "candidate.mobile", label: "Mobile", example: "+8801521 447 902" },
    ],
  },
  {
    source: "Position",
    fields: [
      { path: "position.title", label: "Position", example: "Merchandiser" },
      { path: "position.department", label: "Department", example: "Merchandising" },
      { path: "position.business_unit", label: "Business unit", example: "Anwar Textiles" },
      { path: "position.requisition_ref", label: "Requisition reference", example: "REQ-2026-114" },
    ],
  },
  {
    source: "Recruiter",
    fields: [
      { path: "recruiter.name", label: "Assigned recruiter", example: "Sadia Karim" },
      { path: "recruiter.email", label: "Recruiter email", example: "sadia.karim@anwargroup.test" },
      { path: "recruiter.mobile", label: "Recruiter mobile", example: "+8801711 000 100" },
    ],
  },
  {
    source: "Interview",
    fields: [
      { path: "interview.round", label: "Round number", example: "2" },
      { path: "interview.title", label: "Round name", example: "Technical round" },
      { path: "interview.date", label: "Date", example: "14 Sep 2026" },
      { path: "interview.time", label: "Start time", example: "10:30" },
      { path: "interview.duration", label: "Duration", example: "45 minutes" },
      { path: "interview.mode", label: "In person / online", example: "In person" },
      { path: "interview.location", label: "Location", example: "Head office, Gulshan — 4th floor" },
      { path: "interview.online_link", label: "Online link", example: "https://meet.example.com/anwar-r2" },
      { path: "interview.panel", label: "Panel members", example: "Kamrul Hasan, Nusrat Jahan" },
      { path: "interview.instructions", label: "Candidate instructions", example: "Bring a printed CV and your NID." },
    ],
  },
  {
    source: "Company",
    fields: [
      { path: "company.name", label: "Company", example: "Anwar Group of Industries" },
      { path: "document.request_list", label: "Requested documents", example: "NID copy, academic certificates" },
      { path: "joining.date", label: "Target joining date", example: "1 Oct 2026" },
    ],
  },
];

/** Flat allowlist — the authoritative membership test. */
export const MESSAGE_FIELDS: readonly MessageField[] =
  MESSAGE_FIELD_GROUPS.flatMap((group) => group.fields);

const ALLOWED_PATHS: ReadonlySet<string> = new Set(
  MESSAGE_FIELDS.map((field) => field.path),
);

export function isAllowedField(path: string): boolean {
  return ALLOWED_PATHS.has(path);
}

/**
 * Fields deliberately kept out of the allowlist, with the reason. The first
 * two are the ones BUILD_PLAN.md and the spec name explicitly; the rest follow
 * from the same principle (an internal judgement is not a candidate-facing
 * fact) and are listed because recruiters ask for them.
 */
export const BLOCKED_MESSAGE_FIELDS: ReadonlyArray<{
  path: string;
  label: string;
  reason: string;
}> = [
  {
    path: "application.internal_notes",
    label: "Internal notes",
    reason:
      "Stage-history and screening notes are written for colleagues, not for the candidate.",
  },
  {
    path: "application.rejection_reason",
    label: "Rejection reason",
    reason:
      "A rejection reason is a hiring judgement. If a candidate should hear one, a person writes it — it is never merged in automatically.",
  },
  {
    path: "screening.assessment_score",
    label: "Assessment score",
    reason:
      "Scores are confidential to the panel and management (BUILD_PLAN.md Sec 2.5).",
  },
  {
    path: "evaluation.panel_comments",
    label: "Panel evaluation comments",
    reason:
      "Panel feedback is visible to the panel and the recruiter only, and stays blind until every panelist submits.",
  },
];

/* ── Rendering ───────────────────────────────────────────────────────────── */

export type RenderedSegment =
  /** Literal template text. */
  | { kind: "text"; text: string }
  /** An allowlisted placeholder that resolved. */
  | { kind: "value"; text: string; path: string }
  /** An allowlisted placeholder with no value in this context yet. */
  | { kind: "missing"; text: string; path: string }
  /** A placeholder outside the allowlist — never rendered to a candidate. */
  | { kind: "blocked"; text: string; path: string };

export interface RenderResult {
  segments: RenderedSegment[];
  /** Plain text as the candidate would receive it, unresolved fields removed. */
  text: string;
  /** Allowlisted paths this template needs but the context cannot supply. */
  missingPaths: string[];
  /** Non-allowlisted paths found in the template. Should always be empty. */
  blockedPaths: string[];
}

const PLACEHOLDER = /\{\{\s*([a-z0-9_.]+)\s*\}\}/gi;

/**
 * Client-side stand-in for the server's template renderer.
 *
 * TODO(backend): the authoritative render happens server-side when the
 * `Communication` row is created — this exists so the recruiter sees exactly
 * what they are approving *before* they commit to it, and so the allowlist is
 * visible in the product rather than only in a route handler. When
 * `POST /api/v1/applications/:id/communications` lands, keep this for the live
 * preview but treat the server's `renderedBody` as the record of truth.
 */
export function renderTemplate(
  body: string,
  values: Readonly<Record<string, string | undefined>>,
): RenderResult {
  const segments: RenderedSegment[] = [];
  const missingPaths: string[] = [];
  const blockedPaths: string[] = [];

  let cursor = 0;
  for (const match of body.matchAll(PLACEHOLDER)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      segments.push({ kind: "text", text: body.slice(cursor, index) });
    }
    cursor = index + match[0].length;

    const path = match[1].toLowerCase();
    if (!isAllowedField(path)) {
      blockedPaths.push(path);
      segments.push({ kind: "blocked", text: path, path });
      continue;
    }

    const value = values[path];
    if (value === undefined || value.trim() === "") {
      missingPaths.push(path);
      segments.push({ kind: "missing", text: path, path });
      continue;
    }

    segments.push({ kind: "value", text: value, path });
  }

  if (cursor < body.length) {
    segments.push({ kind: "text", text: body.slice(cursor) });
  }

  const text = segments
    .map((segment) => (segment.kind === "value" || segment.kind === "text" ? segment.text : ""))
    .join("");

  return {
    segments,
    text,
    missingPaths: [...new Set(missingPaths)],
    blockedPaths: [...new Set(blockedPaths)],
  };
}
