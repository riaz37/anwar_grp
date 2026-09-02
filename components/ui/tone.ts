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
  ApprovalRequestStatus,
  ApprovalStepState,
} from "@/lib/types/approvals";
import type { JoiningItemStatus } from "@/lib/types/joining";
import type {
  ApplicationStage,
  CommunicationStatus,
  EligibilityOutcome,
  EvaluatorRecommendation,
  InterviewStatus,
  OverallRecommendation,
  OwnEvaluationState,
  RequisitionStatus,
  ScreeningRecommendation,
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
 * Communication status → tone (spec Sec 6 > Communication; BUILD_PLAN.md
 * Sec 2.8's locked pipeline).
 *
 * The pipeline has six states but only three *questions* a recruiter asks of
 * it: is anyone waiting on me, is it still moving, and did it land. The
 * mapping answers those three and nothing else.
 *
 * DRAFTED           neutral — parked on the record. No obligation on anyone,
 *                             same reading as a DRAFT requisition.
 * AWAITING_APPROVAL warning — a named human is being waited on before a
 *                             candidate-facing message can go out. DESIGN.md
 *                             names "awaiting approval" as the warning example.
 * APPROVED          accent  — cleared, and the send job is in flight. This is
 *                             the one transient state where the *system* is
 *                             doing work, which is DESIGN.md's accent meaning.
 * SENT              info    — true and reassuring, but not actionable: the
 *                             provider has it, and only a delivery receipt can
 *                             move it on. Deliberately not `success` — SENT is
 *                             not the ending the spec asks the UI to prove.
 * DELIVERED         success — DESIGN.md names "Delivered" as a success example.
 * FAILED            error   — DESIGN.md names "Failed" as an error example. It
 *                             is also the only status that puts work *back* on
 *                             the recruiter, which is why the card for a failed
 *                             message carries a retry action rather than
 *                             reading as a dead end.
 */
export const COMMUNICATION_STATUS_TONE: Record<CommunicationStatus, Tone> = {
  DRAFTED: "neutral",
  AWAITING_APPROVAL: "warning",
  APPROVED: "accent",
  SENT: "info",
  DELIVERED: "success",
  FAILED: "error",
};

/**
 * Interview status → tone.
 *
 * SCHEDULED   accent  — live: it is going to happen and needs coordinating.
 * RESCHEDULED accent  — still live; the reschedule history carries the story,
 *                       so the pill does not need to shout about it.
 * COMPLETED   success — it happened. Feedback chasing is a stage concern, not
 *                       an interview-record one.
 * CANCELLED   neutral — called off; not a failure of anybody.
 * NO_SHOW     error   — a negative outcome the recruiter has to act on.
 */
export const INTERVIEW_STATUS_TONE: Record<InterviewStatus, Tone> = {
  SCHEDULED: "accent",
  RESCHEDULED: "accent",
  COMPLETED: "success",
  CANCELLED: "neutral",
  NO_SHOW: "error",
};

/**
 * Screening outcomes → tone. Only the eligibility verdict and the two
 * recommendations get colour; the remaining screening fields (availability,
 * telephone outcome, attendance) are facts, not judgements, and are rendered
 * as plain text so colour keeps meaning something.
 */
export const ELIGIBILITY_TONE: Record<EligibilityOutcome, Tone> = {
  ELIGIBLE: "success",
  ELIGIBLE_WITH_RESERVATION: "warning",
  NOT_ELIGIBLE: "error",
};

export const SCREENING_RECOMMENDATION_TONE: Record<
  ScreeningRecommendation,
  Tone
> = {
  PROCEED_TO_ASSESSMENT: "accent",
  PROCEED_TO_INTERVIEW: "accent",
  HOLD: "info",
  REJECT: "error",
};

export const EVALUATOR_RECOMMENDATION_TONE: Record<
  EvaluatorRecommendation,
  Tone
> = {
  STRONGLY_RECOMMEND: "success",
  RECOMMEND: "success",
  BORDERLINE: "warning",
  NOT_RECOMMENDED: "error",
};

/**
 * A panelist's overall recommendation → tone (spec Sec 6 > Interview
 * Evaluation).
 *
 * Colour here describes a *human's stated position*, exactly as
 * `EVALUATOR_RECOMMENDATION_TONE` above does for the assessment marker. It is
 * never applied to an aggregate: the consolidated summary deliberately leaves
 * its average score and its counts in plain text, because tinting an aggregate
 * green would read as the system endorsing a hire — which spec Sec 6 forbids
 * ("the system may summarize information but must not make the final hiring
 * decision").
 *
 * STRONG_YES / YES  success — a positive position.
 * NEUTRAL           info    — true, stated, and deliberately not actionable on
 *                             its own. Not `warning`: the panelist owes nothing
 *                             further, so nobody is being waited on.
 * NO / STRONG_NO    error   — a negative position, same reading as
 *                             NOT_RECOMMENDED above.
 */
export const OVERALL_RECOMMENDATION_TONE: Record<OverallRecommendation, Tone> =
  {
    STRONG_YES: "success",
    YES: "success",
    NEUTRAL: "info",
    NO: "error",
    STRONG_NO: "error",
  };

/**
 * The viewer's own evaluation → tone.
 *
 * NOT_STARTED neutral — nothing exists yet; the work is signalled by the round
 *                       card's own "feedback outstanding" status, not twice.
 * DRAFT       warning — the round is waiting on *you*. DESIGN.md's warning is
 *                       "waiting on somebody; time is passing", and a draft
 *                       evaluation is the one case where that somebody is the
 *                       person reading the screen.
 * SUBMITTED   success — a good ending: locked, counted, and peer feedback
 *                       unlocked.
 */
export const OWN_EVALUATION_STATE_TONE: Record<OwnEvaluationState, Tone> = {
  NOT_STARTED: "neutral",
  DRAFT: "warning",
  SUBMITTED: "success",
};

/**
 * Panel-feedback completeness → tone, as a function rather than a map because
 * it is derived from two numbers.
 *
 * all submitted        success — the round's feedback is complete; nothing is
 *                                blocking a decision.
 * some/none submitted  warning — missing feedback is the spec's own named
 *                                recruiter concern (Sec 6 > Decisions and
 *                                Approvals) and Sec 8's "feedback overdue"
 *                                dashboard tile. Somebody is being waited on.
 * no panel assigned    neutral — nothing can be missing from an empty panel;
 *                                that is a scheduling gap, not a feedback one.
 */
export function panelFeedbackTone(
  submittedCount: number,
  totalPanelists: number,
): Tone {
  if (totalPanelists === 0) return "neutral";
  return submittedCount >= totalPanelists ? "success" : "warning";
}

/**
 * Approval-request status → tone (spec Sec 6 > Decisions and Approvals;
 * BUILD_PLAN.md Sec 2.9).
 *
 * IN_PROGRESS warning — a named approver is being waited on and the candidate
 *                       is waiting behind them. Exactly DESIGN.md's warning
 *                       definition, and the same reading `APPROVAL` already has
 *                       in `STAGE_TONE` above.
 * APPROVED    success  — a good ending, and the one that unblocks the offer.
 * REJECTED    error    — a negative ending, matching `REJECTED` in STAGE_TONE.
 *
 * Note what has no tone: the chain as a whole is never coloured by how many
 * approvals it has collected, and no aggregate of the panel's scores is
 * coloured anywhere on the Decision tab. Colour here describes a human's
 * recorded decision, never the system's opinion of one.
 */
export const APPROVAL_REQUEST_STATUS_TONE: Record<ApprovalRequestStatus, Tone> =
  {
    IN_PROGRESS: "warning",
    APPROVED: "success",
    REJECTED: "error",
  };

/**
 * Approval-step state → tone.
 *
 * APPROVED    success — this person said yes, on the record.
 * REJECTED    error   — this person said no, and the chain ended here.
 * AWAITING    warning — the chain is blocked on this role right now.
 * NOT_REACHED neutral — genuinely still to come; carries no obligation yet.
 * HALTED      neutral — never asked, and never will be. Deliberately the same
 *                       inert tone as NOT_REACHED rather than an alarming one:
 *                       the *step* did not fail, the chain simply ended before
 *                       it. The row's own label ("Never asked") carries that
 *                       distinction in words, where it cannot be misread as a
 *                       second rejection.
 */
export const APPROVAL_STEP_STATE_TONE: Record<ApprovalStepState, Tone> = {
  APPROVED: "success",
  REJECTED: "error",
  AWAITING: "warning",
  NOT_REACHED: "neutral",
  HALTED: "neutral",
};

/**
 * Joining checklist item status → tone (spec Sec 6 > Joining Coordination).
 *
 * PENDING neutral — outstanding, but nobody is late and nothing is stuck. The
 *                   common state of most of the list on most days, and
 *                   deliberately colourless: thirteen amber rows would make the
 *                   two that genuinely need attention invisible.
 * BLOCKED warning — waiting on somebody outside this checklist (IT, Admin,
 *                   the candidate) and time is passing. Exactly DESIGN.md's
 *                   warning definition, and the same reading `AWAITING` has in
 *                   `APPROVAL_STEP_STATE_TONE`.
 * DONE    success — a good ending.
 *
 * Note what is NOT here: overdue. Overdue is derived from the clock
 * (`isOverdue()` in `lib/types/joining.ts`), and it is signalled on the row's
 * *due date* — "4 days overdue" in warning ink — rather than by recolouring the
 * status pill. One colour instance, one meaning: the pill says what state the
 * work is in, the date says whether it is late. Recolouring the pill for a
 * late-but-not-blocked item would collapse two independent facts into one
 * signal and make "blocked" unreadable.
 */
export const JOINING_ITEM_STATUS_TONE: Record<JoiningItemStatus, Tone> = {
  PENDING: "neutral",
  BLOCKED: "warning",
  DONE: "success",
};

/**
 * Overall joining readiness → tone, as a function rather than a map because it
 * is derived from four counts (`JoiningReadiness`).
 *
 * complete             success — every item ticked; nothing stands between this
 *                                candidate and their start date.
 * overdue or blocked   warning — somebody is being waited on and time is
 *                                passing. Same definition the module's BLOCKED
 *                                status uses, raised to the summary.
 * work outstanding     accent  — live: this is where work is actually happening
 *                                right now, which is DESIGN.md's accent meaning
 *                                and the same reading live pipeline stages get.
 * no items             neutral — no checklist has been started, so there is
 *                                nothing to be on track or late for. An empty
 *                                checklist is not a green one.
 */
export function joiningReadinessTone(readiness: {
  total: number;
  overdueCount: number;
  blockedCount: number;
  complete: boolean;
}): Tone {
  if (readiness.total === 0) return "neutral";
  if (readiness.complete) return "success";
  if (readiness.overdueCount > 0 || readiness.blockedCount > 0) {
    return "warning";
  }
  return "accent";
}

/**
 * Stages rendered struck through: the application ended without a decision
 * being reached on this requisition. REJECTED is excluded on purpose — it is a
 * real decision, and `error` tone plus a strike would over-state it.
 */
export const STRUCK_STAGES: ReadonlySet<ApplicationStage> = new Set([
  "WITHDRAWN",
  "CLOSED",
]);
