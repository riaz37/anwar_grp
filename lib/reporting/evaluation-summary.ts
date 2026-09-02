import "server-only";
import { Role } from "@prisma/client";
import { prisma } from "../prisma";

/**
 * Consolidated interview-results view (BUILD_PLAN.md Sec 3.1 item 4;
 * PDF "Decisions and Approvals": recruiters should see panel
 * recommendations, average score, missing feedback, assessment
 * results, key concerns, hiring-manager recommendation).
 *
 * SUMMARY ONLY — per the PDF's explicit constraint ("the system may
 * summarize information but must not make the final hiring decision"),
 * nothing here derives a recommend/reject boolean or any other
 * decision artifact. It reports what panelists said; a human acts on
 * it via the existing Application stage-transition endpoint.
 *
 * This function does NOT apply the blind-until-submit visibility rule
 * itself — callers that expose it to a PANEL_MEMBER must not (per
 * lib/evaluation-visibility.ts's documented role decision, only
 * non-PANEL_MEMBER roles see the interview-wide summary; a panel
 * member calling this route is rejected before reaching this function
 * — see the API route).
 */

export interface PanelRecommendationItem {
  panelistId: string;
  panelistName: string;
  panelistRole: Role;
  submittedAt: string | null;
  overallRecommendation: string | null;
  /** Mean of this panelist's own scored criteria, null until submitted. */
  averageScore: number | null;
}

export interface KeyConcernItem {
  panelistId: string;
  panelistName: string;
  concerns: string;
}

export interface EvaluationSummary {
  interviewId: string;
  totalPanelists: number;
  submittedCount: number;
  missingFeedbackCount: number;
  missingFeedbackPanelists: { panelistId: string; panelistName: string }[];
  panelRecommendations: PanelRecommendationItem[];
  /** Average across every submitted evaluation's scored criteria,
   * flattened (not averaged-of-averages) — null if nothing submitted
   * yet. Documented design choice: BUILD_PLAN's spec text asks for
   * "average score across all submitted evaluations' scored criteria",
   * read literally as one flat mean. */
  averageScore: number | null;
  keyConcerns: KeyConcernItem[];
  /** The submitted overallRecommendation of whichever assigned
   * panelist holds Role.HIRING_MANAGER, if any and if submitted.
   * Documented judgment call: the schema doesn't separately track a
   * "hiring manager recommendation" field — a hiring manager who sits
   * on the panel fills out the same Evaluation row as everyone else,
   * and this field just calls that row out by role for the recruiter
   * view the PDF asks for. Null if no hiring manager is on the panel
   * or they haven't submitted yet. */
  hiringManagerRecommendation: string | null;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export async function getEvaluationSummary(
  interviewId: string,
): Promise<EvaluationSummary | null> {
  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: {
      panelists: { include: { user: { select: { id: true, name: true, role: true } } } },
      evaluations: {
        include: {
          panelist: { select: { id: true, name: true, role: true } },
          evaluationFormTemplate: { select: { criteria: true } },
        },
      },
    },
  });
  if (!interview) return null;

  const submitted = interview.evaluations.filter((e) => e.submittedAt);
  const submittedPanelistIds = new Set(submitted.map((e) => e.panelistId));

  const missingFeedbackPanelists = interview.panelists
    .filter((p) => !submittedPanelistIds.has(p.userId))
    .map((p) => ({ panelistId: p.userId, panelistName: p.user.name }));

  const panelRecommendations: PanelRecommendationItem[] = interview.panelists.map(
    (p) => {
      const evaluation = interview.evaluations.find((e) => e.panelistId === p.userId);
      const isSubmitted = Boolean(evaluation?.submittedAt);
      let averageScore: number | null = null;
      if (isSubmitted && evaluation) {
        const scores = evaluation.scores as Record<string, number>;
        averageScore = mean(Object.values(scores).filter((v) => typeof v === "number"));
      }
      return {
        panelistId: p.userId,
        panelistName: p.user.name,
        panelistRole: p.user.role,
        submittedAt: isSubmitted ? evaluation!.submittedAt!.toISOString() : null,
        overallRecommendation: isSubmitted ? evaluation!.overallRecommendation : null,
        averageScore,
      };
    },
  );

  const allSubmittedScores: number[] = [];
  const keyConcerns: KeyConcernItem[] = [];
  for (const evaluation of submitted) {
    const scores = evaluation.scores as Record<string, number>;
    for (const value of Object.values(scores)) {
      if (typeof value === "number") allSubmittedScores.push(value);
    }
    if (evaluation.concerns && evaluation.concerns.trim().length > 0) {
      keyConcerns.push({
        panelistId: evaluation.panelistId,
        panelistName: evaluation.panelist.name,
        concerns: evaluation.concerns,
      });
    }
  }

  const hiringManagerPanelist = interview.panelists.find(
    (p) => p.user.role === Role.HIRING_MANAGER,
  );
  const hiringManagerEvaluation = hiringManagerPanelist
    ? interview.evaluations.find(
        (e) => e.panelistId === hiringManagerPanelist.userId && e.submittedAt,
      )
    : undefined;

  return {
    interviewId: interview.id,
    totalPanelists: interview.panelists.length,
    submittedCount: submitted.length,
    missingFeedbackCount: missingFeedbackPanelists.length,
    missingFeedbackPanelists,
    panelRecommendations,
    averageScore: mean(allSubmittedScores),
    keyConcerns,
    hiringManagerRecommendation: hiringManagerEvaluation?.overallRecommendation ?? null,
  };
}
