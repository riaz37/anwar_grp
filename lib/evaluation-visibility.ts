import "server-only";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "./prisma";
import type { SessionPayload } from "./session";

/**
 * Blind-until-submit visibility for Evaluation rows (BUILD_PLAN.md
 * Sec 2.3): "query layer filters WHERE panelist_id = :current_user OR
 * :current_user_has_submitted_own = true — panel members literally
 * cannot fetch another's evaluation row via the API until their own
 * submitted_at is set."
 *
 * This is the ONE place that rule lives — every read route that
 * touches Evaluation rows (list, detail, summary) MUST shape its query
 * through `visibleEvaluationsWhere()` below rather than re-deriving the
 * check in route code, so there is exactly one place to audit for
 * correctness.
 *
 * Role-based visibility decision (BUILD_PLAN.md Sec 2.5 — "role ->
 * allowed actions + visible fields", judgment call for this phase):
 * the blind-until-submit rule is specifically about a PANEL MEMBER
 * seeing a PEER PANEL MEMBER's independent assessment before forming
 * their own — the PDF's exact words are "Panel members should not see
 * another interviewer's evaluation until submitting their own."
 * TA_ADMIN, RECRUITER, DEPT_HEAD, HIRING_MANAGER, HR_LEADERSHIP,
 * TECH_ADMIN, and AUDIT_USER are not "another interviewer" competing on
 * the same panel — they are the consumers of the consolidated result
 * (PDF's "Decisions and Approvals" section: "recruiters should see:
 * panel recommendations, average score, missing feedback, assessment
 * results, key concerns, hiring-manager recommendation"), which
 * presupposes they can already see the underlying per-panelist rows,
 * not just a pre-aggregated summary. So: every role EXCEPT
 * PANEL_MEMBER sees all evaluations for an interview unconditionally
 * (subject to the caller already having resolved that they may view
 * the interview/application at all — this helper does not re-check
 * that). Only PANEL_MEMBER is blinded, and only from peers, never from
 * their own row.
 */
export async function visibleEvaluationsWhere(
  user: SessionPayload,
  interviewId: string,
): Promise<Prisma.EvaluationWhereInput> {
  if (user.role !== Role.PANEL_MEMBER) {
    return { interviewId };
  }

  const own = await prisma.evaluation.findUnique({
    where: {
      interviewId_panelistId: { interviewId, panelistId: user.userId },
    },
    select: { submittedAt: true },
  });

  if (own?.submittedAt) {
    // Own evaluation submitted -> unblinded, may see every panelist's
    // row for this interview.
    return { interviewId };
  }

  // No own row yet, or own row is still a draft -> only the caller's
  // own row (if any) is visible. This is a WHERE clause the caller's
  // findMany/findFirst executes — never "fetch everything then filter
  // in application code."
  return { interviewId, panelistId: user.userId };
}

/**
 * Convenience check for "does this panelist's own submission unlock
 * peer visibility right now" — used by routes that need a boolean
 * rather than a WHERE clause (e.g. deciding what `meta` to attach to a
 * response).
 */
export async function hasSubmittedOwnEvaluation(
  user: SessionPayload,
  interviewId: string,
): Promise<boolean> {
  const own = await prisma.evaluation.findUnique({
    where: {
      interviewId_panelistId: { interviewId, panelistId: user.userId },
    },
    select: { submittedAt: true },
  });
  return Boolean(own?.submittedAt);
}
