import "server-only";
import type { Prisma } from "@prisma/client";

/**
 * Phase 6 (Joining Coordination) — BUILD_PLAN.md Sec 3.1 item 6.
 *
 * PDF's "Joining Coordination" section, quoted verbatim: "A simple
 * checklist should cover: Candidate acceptance, Required documents,
 * Reference check, Offer letter, Joining date, IT request, Workspace,
 * ID card, Transport, Induction, Department notification, Joining
 * completion, Departmental handover. Each item should have an owner,
 * due date, status, and optional evidence."
 *
 * This is the exact list, unmodified — no invented items added, per the
 * "resist over-building" constraint. It is used to seed a default
 * checklist the first time an application reaches
 * ApplicationStage.JOINING (see the stage-transition route), so
 * recruiters aren't starting from a blank list every time. Ad hoc items
 * beyond this set can still be added/removed via the checklist API for
 * cases the fixed template doesn't cover — this is a *default*, not an
 * enforced/closed set.
 */
export const DEFAULT_CHECKLIST_TEMPLATE: readonly string[] = [
  "Candidate acceptance",
  "Required documents",
  "Reference check",
  "Offer letter",
  "Joining date",
  "IT request",
  "Workspace",
  "ID card",
  "Transport",
  "Induction",
  "Department notification",
  "Joining completion",
  "Departmental handover",
];

/**
 * Builds the create-many input for seeding the default checklist onto
 * an application. Owner-assignment decision (documented, since the
 * schema has no per-item "responsible role" concept to map against):
 * every seeded item defaults to `defaultOwnerId` — the application's
 * assigned recruiter, since the PDF's Recruiter Dashboard (Sec 8) lists
 * "Joining actions" as something recruiters track directly. Recruiters
 * can immediately reassign any item's owner afterward via the PATCH
 * endpoint; this is just a sane starting point, not a fixed rule.
 */
export function buildDefaultChecklistItems(params: {
  applicationId: string;
  defaultOwnerId: string;
  createdById: string;
}): Prisma.JoiningChecklistItemCreateManyInput[] {
  return DEFAULT_CHECKLIST_TEMPLATE.map((label) => ({
    applicationId: params.applicationId,
    label,
    ownerId: params.defaultOwnerId,
    createdById: params.createdById,
  }));
}
