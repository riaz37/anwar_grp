import "server-only";
import { z } from "zod";

/**
 * EvaluationFormTemplate.criteria shape + validation. Kept as a small
 * standalone module (mirrors lib/message-templates.ts's role in that
 * phase) so both the create route and the scoring/summary code share
 * one definition of "what a criterion looks like."
 *
 * Scored-criteria vs. free-text split (see prisma/schema.prisma's
 * doc comment on EvaluationFormTemplate for the full reasoning):
 * criteria here cover the PDF's per-role scored dimensions (relevant
 * experience, technical/functional capability, communication,
 * problem-solving, leadership, ...). strengths/concerns/
 * organizationalSuitability/overallRecommendation are fixed fields on
 * Evaluation itself, not part of this configurable list.
 */

export const criterionSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_]+$/, "key must be alphanumeric/underscore only"),
  label: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  scoreMax: z.number().int().min(1).max(100),
});

export type Criterion = z.infer<typeof criterionSchema>;

export const criteriaListSchema = z
  .array(criterionSchema)
  .min(1)
  .max(20)
  .refine(
    (criteria) => new Set(criteria.map((c) => c.key)).size === criteria.length,
    { message: "criteria keys must be unique within a template" },
  );

/** Default criteria set covering the PDF's typical list, offered as a
 * convenience starting point for a "General" template — callers are
 * free to submit their own criteria list instead. */
export const DEFAULT_CRITERIA: Criterion[] = [
  {
    key: "relevant_experience",
    label: "Relevant Experience",
    scoreMax: 5,
  },
  {
    key: "technical_functional_capability",
    label: "Technical / Functional Capability",
    scoreMax: 5,
  },
  { key: "communication", label: "Communication", scoreMax: 5 },
  { key: "problem_solving", label: "Problem Solving", scoreMax: 5 },
  { key: "leadership", label: "Leadership", scoreMax: 5 },
];

/**
 * Validates that a submitted `scores` map only scores criteria that
 * exist on the given template and stays within each criterion's
 * scoreMax. Returns the sanitized map (unknown keys dropped) plus the
 * list of any keys that were dropped, mirroring
 * lib/message-templates.ts's sanitizeAllowedFields() pattern of
 * "silently drop and report back" rather than hard-reject the whole
 * request over one stray key.
 */
export function sanitizeScores(
  criteria: Criterion[],
  scores: Record<string, unknown>,
): { sanitized: Record<string, number>; droppedKeys: string[] } {
  const byKey = new Map(criteria.map((c) => [c.key, c]));
  const sanitized: Record<string, number> = {};
  const droppedKeys: string[] = [];

  for (const [key, value] of Object.entries(scores)) {
    const criterion = byKey.get(key);
    const numeric = typeof value === "number" ? value : Number(value);
    if (
      !criterion ||
      !Number.isFinite(numeric) ||
      numeric < 0 ||
      numeric > criterion.scoreMax
    ) {
      droppedKeys.push(key);
      continue;
    }
    sanitized[key] = numeric;
  }

  return { sanitized, droppedKeys };
}

/** Parses/validates a template's stored `criteria` Json column back
 * into typed Criterion[] — throws if the stored data is somehow
 * malformed (should be unreachable given create-time validation). */
export function parseCriteria(criteria: unknown): Criterion[] {
  return criteriaListSchema.parse(criteria);
}
