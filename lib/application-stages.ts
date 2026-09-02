import { ApplicationStage } from "@prisma/client";

/**
 * Allowed stage transitions for Application.currentStage.
 *
 * Base pipeline per PDF Sec 5:
 *   New -> Screening -> Assessment -> Interview -> Feedback Pending ->
 *   Approval -> Selected -> Joining -> Joined
 *
 * Alternative outcomes (On Hold, Rejected, Withdrawn, Redirected,
 * Closed) are reachable from any active pipeline stage — the PDF lists
 * them as outcomes of the pipeline, not a linear extension of it. This
 * exact transition table is a Phase 2 design decision (not spelled out
 * field-by-field in the PDF/BUILD_PLAN) documented here so it's easy to
 * revise:
 *   - Feedback Pending can loop back to Interview (another round).
 *   - On Hold can resume into any active stage (it's a pause, not a
 *     position) or move to a terminal outcome.
 *   - Rejected / Withdrawn / Redirected / Closed are terminal — no
 *     outgoing transitions once reached.
 */
const ACTIVE_STAGES: ApplicationStage[] = [
  ApplicationStage.NEW,
  ApplicationStage.SCREENING,
  ApplicationStage.ASSESSMENT,
  ApplicationStage.INTERVIEW,
  ApplicationStage.FEEDBACK_PENDING,
  ApplicationStage.APPROVAL,
  ApplicationStage.SELECTED,
  ApplicationStage.JOINING,
  ApplicationStage.JOINED,
];

const TERMINAL_OUTCOMES: ApplicationStage[] = [
  ApplicationStage.REJECTED,
  ApplicationStage.WITHDRAWN,
  ApplicationStage.REDIRECTED,
  ApplicationStage.CLOSED,
];

const ALWAYS_REACHABLE_OUTCOMES: ApplicationStage[] = [
  ApplicationStage.ON_HOLD,
  ApplicationStage.REJECTED,
  ApplicationStage.WITHDRAWN,
  ApplicationStage.REDIRECTED,
  ApplicationStage.CLOSED,
];

const LINEAR_NEXT: Partial<Record<ApplicationStage, ApplicationStage>> = {
  [ApplicationStage.NEW]: ApplicationStage.SCREENING,
  [ApplicationStage.SCREENING]: ApplicationStage.ASSESSMENT,
  [ApplicationStage.ASSESSMENT]: ApplicationStage.INTERVIEW,
  [ApplicationStage.INTERVIEW]: ApplicationStage.FEEDBACK_PENDING,
  [ApplicationStage.FEEDBACK_PENDING]: ApplicationStage.APPROVAL,
  [ApplicationStage.APPROVAL]: ApplicationStage.SELECTED,
  [ApplicationStage.SELECTED]: ApplicationStage.JOINING,
  [ApplicationStage.JOINING]: ApplicationStage.JOINED,
};

export function allowedNextStages(
  current: ApplicationStage,
): ApplicationStage[] {
  if (TERMINAL_OUTCOMES.includes(current)) {
    return [];
  }

  if (current === ApplicationStage.ON_HOLD) {
    return [...ACTIVE_STAGES, ...TERMINAL_OUTCOMES].filter(
      (s) => s !== ApplicationStage.ON_HOLD,
    );
  }

  const next = new Set<ApplicationStage>(ALWAYS_REACHABLE_OUTCOMES);
  const linear = LINEAR_NEXT[current];
  if (linear) next.add(linear);
  // Feedback Pending can loop back for another interview round.
  if (current === ApplicationStage.FEEDBACK_PENDING) {
    next.add(ApplicationStage.INTERVIEW);
  }

  return [...next];
}

export function isValidStageTransition(
  from: ApplicationStage,
  to: ApplicationStage,
): boolean {
  if (from === to) return false;
  return allowedNextStages(from).includes(to);
}
