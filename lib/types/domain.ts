/**
 * Shared recruitment-domain types for the Requisition / Candidate /
 * Application surface (BUILD_PLAN.md Sec 2.3, assignment spec Sec 5 + 6).
 *
 * These are the *client-facing* shapes — what `/api/v1/*` is expected to
 * serialize, not the Prisma models. The backend agent owns
 * `prisma/schema.prisma`; when those models land, the enums and field names
 * below are the contract to reconcile against. Deliberate choices:
 *
 * - Dates are ISO strings (`YYYY-MM-DD` for calendar dates, full ISO-8601 for
 *   timestamps), never `Date` — they cross the server/client boundary.
 * - Related people are `PersonRef` (id + name), not bare ids, so a list row
 *   never needs a second round trip to render a name.
 * - `Application.version` is carried everywhere it can be mutated, because
 *   every write must echo the version it read (BUILD_PLAN.md Sec 2.4).
 *
 * Reconciliation with `components/tasks/types.ts`: a `Task` is exactly the
 * subset of `ApplicationSummary` needed for the Home queue — see
 * `applicationToTask()` at the bottom of this file, which is the single place
 * that mapping lives.
 */

import type { Task } from "@/components/tasks/types";

/* ── Requisition ─────────────────────────────────────────────────────────── */

/**
 * Assignment spec Sec 6 > Requisitions, "Suggested statuses":
 * Draft → Awaiting Approval → Approved → Open → On Hold → Filled → Closed.
 */
export const REQUISITION_STATUSES = [
  "DRAFT",
  "AWAITING_APPROVAL",
  "APPROVED",
  "OPEN",
  "ON_HOLD",
  "FILLED",
  "CLOSED",
] as const;

export type RequisitionStatus = (typeof REQUISITION_STATUSES)[number];

export const REQUISITION_STATUS_LABELS: Record<RequisitionStatus, string> = {
  DRAFT: "Draft",
  AWAITING_APPROVAL: "Awaiting approval",
  APPROVED: "Approved",
  OPEN: "Open",
  ON_HOLD: "On hold",
  FILLED: "Filled",
  CLOSED: "Closed",
};

export const POSITION_LEVELS = [
  "ENTRY",
  "JUNIOR",
  "MID",
  "SENIOR",
  "LEAD",
  "MANAGER",
  "HEAD",
  "EXECUTIVE",
] as const;

export type PositionLevel = (typeof POSITION_LEVELS)[number];

/**
 * RECONCILIATION NOTE — `prisma.Requisition.positionLevel` is currently a free
 * `String` (the create route validates only `min(1).max(100)`), while this is
 * a closed set. A closed set is what the UI needs: `positionLevel` selects the
 * approval chain (`ApprovalChainConfig`, BUILD_PLAN.md Sec 2.9), so free text
 * lets a typo silently route a requisition to nobody. Either promote the Prisma
 * field to an enum matching this list, or drop this to `string` and accept a
 * free-text input. Flagged for the backend owner rather than changed here —
 * `prisma/schema.prisma` is not this agent's file to edit.
 */

export const POSITION_LEVEL_LABELS: Record<PositionLevel, string> = {
  ENTRY: "Entry",
  JUNIOR: "Junior",
  MID: "Mid",
  SENIOR: "Senior",
  LEAD: "Lead",
  MANAGER: "Manager",
  HEAD: "Department head",
  EXECUTIVE: "Executive",
};

/* ── Application stage ───────────────────────────────────────────────────── */

/**
 * Assignment spec Sec 5: the recommended linear pipeline. Order matters — the
 * stepper in `components/applications/StagePipeline.tsx` renders this array
 * directly and derives "done / current / upcoming" from the index.
 */
export const PIPELINE_STAGES = [
  "NEW",
  "SCREENING",
  "ASSESSMENT",
  "INTERVIEW",
  "FEEDBACK_PENDING",
  "APPROVAL",
  "SELECTED",
  "JOINING",
  "JOINED",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** Spec Sec 5: "Alternative outcomes" — branch/terminal states off the line. */
export const BRANCH_STAGES = [
  "ON_HOLD",
  "REJECTED",
  "WITHDRAWN",
  "REDIRECTED",
  "CLOSED",
] as const;

export type BranchStage = (typeof BRANCH_STAGES)[number];

export type ApplicationStage = PipelineStage | BranchStage;

export const ALL_STAGES: readonly ApplicationStage[] = [
  ...PIPELINE_STAGES,
  ...BRANCH_STAGES,
];

export const STAGE_LABELS: Record<ApplicationStage, string> = {
  NEW: "New",
  SCREENING: "Screening",
  ASSESSMENT: "Assessment",
  INTERVIEW: "Interview",
  FEEDBACK_PENDING: "Feedback pending",
  APPROVAL: "Approval",
  SELECTED: "Selected",
  JOINING: "Joining",
  JOINED: "Joined",
  ON_HOLD: "On hold",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  REDIRECTED: "Redirected",
  CLOSED: "Closed",
};

export function isBranchStage(stage: ApplicationStage): stage is BranchStage {
  return (BRANCH_STAGES as readonly string[]).includes(stage);
}

/**
 * Stages after which no further action is expected. `JOINED` is a successful
 * ending; the rest are branch endings. `ON_HOLD` and `REDIRECTED` are
 * deliberately NOT terminal — the application is paused or moved, not over.
 */
export function isTerminalStage(stage: ApplicationStage): boolean {
  return (
    stage === "JOINED" ||
    stage === "REJECTED" ||
    stage === "WITHDRAWN" ||
    stage === "CLOSED"
  );
}

/* ── Candidate ───────────────────────────────────────────────────────────── */

/**
 * Assignment spec Sec 6 > Candidate Management: "Candidates may be added
 * through manual entry, CV upload, spreadsheet import, job portals,
 * referrals, internal pools, recruitment events, or headhunters."
 */
export const CANDIDATE_SOURCES = [
  "MANUAL_ENTRY",
  "CV_UPLOAD",
  "SPREADSHEET_IMPORT",
  "JOB_PORTAL",
  "REFERRAL",
  "INTERNAL_POOL",
  "RECRUITMENT_EVENT",
  "HEADHUNTER",
] as const;

export type CandidateSource = (typeof CANDIDATE_SOURCES)[number];

/**
 * RECONCILIATION NOTE — `prisma.CandidateSource` is missing
 * `RECRUITMENT_EVENT`, which the spec sentence above names explicitly. It is
 * kept here because dropping it would lose a source the client asked for;
 * adding the enum value server-side is a one-line migration.
 */

export const CANDIDATE_SOURCE_LABELS: Record<CandidateSource, string> = {
  MANUAL_ENTRY: "Manual entry",
  CV_UPLOAD: "CV upload",
  SPREADSHEET_IMPORT: "Spreadsheet import",
  JOB_PORTAL: "Job portal",
  REFERRAL: "Referral",
  INTERNAL_POOL: "Internal pool",
  RECRUITMENT_EVENT: "Recruitment event",
  HEADHUNTER: "Headhunter",
};

/* ── Shared record shapes ────────────────────────────────────────────────── */

/** A user or org-unit referenced from another record: enough to render a row. */
export interface PersonRef {
  id: string;
  name: string;
}

export interface OrgUnitRef {
  id: string;
  name: string;
}

/**
 * A stored `Document` row as the API exposes it. `storageKey` is included
 * because the presign-download route keys off the document id, not the key —
 * the key is shown only in technical/audit contexts, never linked directly.
 */
export interface DocumentRef {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  /** ISO-8601 timestamp. */
  uploadedAt: string;
  uploadedBy: string;
}

export interface Requisition {
  id: string;
  /** Human-facing reference, e.g. `REQ-2026-114`. */
  ref: string;
  businessUnit: OrgUnitRef;
  department: OrgUnitRef;
  position: string;
  vacancyCount: number;
  positionLevel: PositionLevel;
  hiringManager: PersonRef;
  assignedRecruiter: PersonRef;
  /** ISO calendar date, `YYYY-MM-DD`. */
  targetJoiningDate: string;
  approvalStatus: RequisitionStatus;
  /** The ERF/RRF document, or null while it has not been attached yet. */
  erfRrfDocument: DocumentRef | null;
  /** Optional free-text context. Kept optional: spec Sec 7 asks for "low in
   *  mandatory data entry". */
  notes?: string;
  /** ISO-8601 timestamps. */
  createdAt: string;
  updatedAt: string;
  version: number;
}

/**
 * One candidate's application to one requisition. Separate from `Candidate`
 * because "one candidate may apply for multiple positions" (spec Sec 6).
 *
 * The four fields spec Sec 5 requires every active application to display —
 * `stage`, `assignedRecruiter`, `nextAction` + `actionOwner`, `dueDate` — are
 * all non-optional here on purpose, so no view can silently omit one.
 */
export interface ApplicationSummary {
  id: string;
  candidateId: string;
  candidateName: string;
  requisitionId: string;
  requisitionRef: string;
  /** Denormalised requisition position title, for row rendering. */
  requisitionTitle: string;
  stage: ApplicationStage;
  assignedRecruiter: PersonRef;
  nextAction: string;
  actionOwner: PersonRef;
  /** ISO calendar date, `YYYY-MM-DD`. */
  dueDate: string;
  /** ISO-8601 timestamp of the last stage transition. */
  stageChangedAt: string;
  /** ISO-8601 timestamp. */
  appliedAt: string;
  /** Optimistic-lock token; must be echoed on every write. */
  version: number;
}

export interface Candidate {
  id: string;
  name: string;
  /** E.164-ish; stored as entered, normalised server-side for dedup. */
  mobile: string;
  email: string;
  source: CandidateSource;
  cvDocument: DocumentRef | null;
  /** ISO-8601 timestamp. */
  createdAt: string;
  version: number;
}

/** Candidate plus every application they hold — the Candidate Workspace shape. */
export interface CandidateWithApplications extends Candidate {
  applications: ApplicationSummary[];
}

/** Append-only stage transition record (spec Sec 5, BUILD_PLAN.md Sec 2.3). */
export interface StageHistoryEntry {
  id: string;
  applicationId: string;
  fromStage: ApplicationStage | null;
  toStage: ApplicationStage;
  changedBy: PersonRef;
  /** ISO-8601 timestamp. */
  changedAt: string;
  note?: string;
}

/**
 * One possible duplicate returned by the dedup check. Exact-match only —
 * fuzzy matching + a merge UI are explicitly out of scope
 * (BUILD_PLAN.md "Features intentionally excluded").
 */
export interface DuplicateMatch {
  candidateId: string;
  name: string;
  email: string;
  mobile: string;
  /** Which identifiers matched exactly. */
  matchedOn: ReadonlyArray<"email" | "mobile">;
  /** How many applications the existing candidate already holds. */
  applicationCount: number;
}

/* ── Screening and assessment (spec Sec 6 > Screening and Assessment) ────── */

/**
 * The ten fields the spec lists verbatim, in its own order:
 *   eligibility · screening comments · telephone-assessment outcome ·
 *   availability · recommendation · assessment type · assessment score ·
 *   attendance · uploaded assessment documents · evaluator recommendation.
 *
 * Everything except `eligibility` is optional in practice — the record is
 * filled in over two sittings (a phone screen first, a paper assessment days
 * later), and spec Sec 7 asks for "low in mandatory data entry". The form
 * enforces only what a stage decision genuinely needs.
 */

export const ELIGIBILITY_OUTCOMES = [
  "ELIGIBLE",
  "ELIGIBLE_WITH_RESERVATION",
  "NOT_ELIGIBLE",
] as const;

export type EligibilityOutcome = (typeof ELIGIBILITY_OUTCOMES)[number];

export const ELIGIBILITY_LABELS: Record<EligibilityOutcome, string> = {
  ELIGIBLE: "Eligible",
  ELIGIBLE_WITH_RESERVATION: "Eligible with reservation",
  NOT_ELIGIBLE: "Not eligible",
};

/** Outcome of the recruiter's phone screen — spec's "telephone-assessment". */
export const TELEPHONE_OUTCOMES = [
  "NOT_ATTEMPTED",
  "COMPLETED",
  "NO_ANSWER",
  "CALL_BACK_REQUESTED",
  "DECLINED",
  "WRONG_NUMBER",
] as const;

export type TelephoneOutcome = (typeof TELEPHONE_OUTCOMES)[number];

export const TELEPHONE_OUTCOME_LABELS: Record<TelephoneOutcome, string> = {
  NOT_ATTEMPTED: "Not attempted yet",
  COMPLETED: "Completed",
  NO_ANSWER: "No answer",
  CALL_BACK_REQUESTED: "Call-back requested",
  DECLINED: "Candidate declined",
  WRONG_NUMBER: "Wrong number",
};

/** The recruiter's own call after screening — what should happen next. */
export const SCREENING_RECOMMENDATIONS = [
  "PROCEED_TO_ASSESSMENT",
  "PROCEED_TO_INTERVIEW",
  "HOLD",
  "REJECT",
] as const;

export type ScreeningRecommendation =
  (typeof SCREENING_RECOMMENDATIONS)[number];

export const SCREENING_RECOMMENDATION_LABELS: Record<
  ScreeningRecommendation,
  string
> = {
  PROCEED_TO_ASSESSMENT: "Proceed to assessment",
  PROCEED_TO_INTERVIEW: "Proceed straight to interview",
  HOLD: "Hold for now",
  REJECT: "Do not proceed",
};

/**
 * Spec Sec 4 names "Paper-assessment result recording" explicitly, so
 * `WRITTEN_PAPER` is first. `NONE` exists because plenty of roles skip the
 * assessment entirely and the record still has to say so out loud — an empty
 * field reads as "not done yet", which is a different thing.
 */
export const ASSESSMENT_TYPES = [
  "NONE",
  "WRITTEN_PAPER",
  "ONLINE_TEST",
  "PRACTICAL_TASK",
  "CASE_STUDY",
  "PORTFOLIO_REVIEW",
] as const;

export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];

export const ASSESSMENT_TYPE_LABELS: Record<AssessmentType, string> = {
  NONE: "No assessment for this role",
  WRITTEN_PAPER: "Written paper",
  ONLINE_TEST: "Online test",
  PRACTICAL_TASK: "Practical task",
  CASE_STUDY: "Case study",
  PORTFOLIO_REVIEW: "Portfolio review",
};

export const ASSESSMENT_ATTENDANCE = [
  "NOT_APPLICABLE",
  "ATTENDED",
  "ABSENT",
  "LATE",
  "RESCHEDULED",
] as const;

export type AssessmentAttendance = (typeof ASSESSMENT_ATTENDANCE)[number];

export const ASSESSMENT_ATTENDANCE_LABELS: Record<
  AssessmentAttendance,
  string
> = {
  NOT_APPLICABLE: "Not applicable",
  ATTENDED: "Attended",
  ABSENT: "Did not attend",
  LATE: "Attended late",
  RESCHEDULED: "Rescheduled",
};

/** The assessment evaluator's verdict — distinct from the recruiter's. */
export const EVALUATOR_RECOMMENDATIONS = [
  "STRONGLY_RECOMMEND",
  "RECOMMEND",
  "BORDERLINE",
  "NOT_RECOMMENDED",
] as const;

export type EvaluatorRecommendation =
  (typeof EVALUATOR_RECOMMENDATIONS)[number];

export const EVALUATOR_RECOMMENDATION_LABELS: Record<
  EvaluatorRecommendation,
  string
> = {
  STRONGLY_RECOMMEND: "Strongly recommend",
  RECOMMEND: "Recommend",
  BORDERLINE: "Borderline",
  NOT_RECOMMENDED: "Not recommended",
};

/**
 * One screening + assessment record per application.
 *
 * RECONCILIATION NOTE — the backend's `ScreeningAssessment` model does not
 * exist yet at the time of writing, so every field name below is this agent's
 * proposal, not a read of the schema. Three shapes are worth agreeing on
 * explicitly before the model lands:
 *
 *  1. `assessmentScore` + `assessmentMaxScore` rather than a bare score. A
 *     score with no scale is unreadable in a list ("62" out of what?), and
 *     different assessment types are marked out of different totals. If the
 *     backend prefers a single normalised percentage, this becomes
 *     `assessmentScorePercent: number` and the form does the division.
 *  2. `availability` is free text ("Available from 1 Oct, 30-day notice").
 *     A structured `noticePeriodDays` + `earliestStartDate` pair would report
 *     better, but the spec says only "Availability", and recruiters record
 *     this verbatim off a phone call today.
 *  3. `documents` is a list, not a single ref — a paper assessment is often
 *     a scanned answer sheet *plus* a marking sheet.
 */
export interface ScreeningAssessment {
  id: string;
  applicationId: string;
  eligibility: EligibilityOutcome;
  screeningComments: string;
  telephoneOutcome: TelephoneOutcome;
  availability: string;
  recommendation: ScreeningRecommendation;
  assessmentType: AssessmentType;
  /** Null while the assessment has not been marked (or type is `NONE`). */
  assessmentScore: number | null;
  assessmentMaxScore: number;
  attendance: AssessmentAttendance;
  documents: DocumentRef[];
  evaluatorRecommendation: EvaluatorRecommendation | null;
  evaluatorComments: string;
  recordedBy: PersonRef;
  /** ISO-8601 timestamps. */
  recordedAt: string;
  updatedAt: string;
  version: number;
}

/* ── Interview scheduling (spec Sec 6 > Interview Scheduling) ────────────── */

/** "Date, time, duration, location, or online link" — the spec's own OR. */
export const INTERVIEW_MODES = ["IN_PERSON", "ONLINE"] as const;

export type InterviewMode = (typeof INTERVIEW_MODES)[number];

export const INTERVIEW_MODE_LABELS: Record<InterviewMode, string> = {
  IN_PERSON: "In person",
  ONLINE: "Online",
};

export const INTERVIEW_STATUSES = [
  "SCHEDULED",
  "RESCHEDULED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export const INTERVIEW_STATUS_LABELS: Record<InterviewStatus, string> = {
  SCHEDULED: "Scheduled",
  RESCHEDULED: "Rescheduled",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "Candidate did not attend",
};

/**
 * One entry of the rescheduling history the spec requires to be visible.
 * `reason` is non-optional on purpose: a reschedule with no reason is exactly
 * the kind of untraceable change the whole system exists to remove.
 */
export interface InterviewRescheduleEntry {
  id: string;
  interviewId: string;
  /** ISO calendar date `YYYY-MM-DD` + 24h `HH:mm`, before and after. */
  fromDate: string;
  fromTime: string;
  toDate: string;
  toTime: string;
  reason: string;
  changedBy: PersonRef;
  /** ISO-8601 timestamp. */
  changedAt: string;
}

/**
 * One interview round on one application. "Multiple interview rounds" (spec
 * Sec 6) means a list of these per application, ordered by `roundNumber`.
 *
 * RECONCILIATION NOTE — proposed shape; the backend's `Interview` model is not
 * written yet. Two deliberate choices:
 *  - `scheduledDate` + `scheduledTime` are stored separately rather than as one
 *    timestamp. Interview times are quoted to candidates in a local wall clock
 *    ("Sunday 10:00 at the Gulshan office"); collapsing to UTC and formatting
 *    back is how a 10:00 interview becomes a 04:00 one in a WhatsApp message.
 *    If the backend stores a `DateTime`, it must also store the IANA zone.
 *  - `evaluationFormId` is nullable and carries a denormalised
 *    `evaluationFormName`. Evaluation forms are Phase 4 (BUILD_PLAN Sec 3.1
 *    item 4); this field is the forward-declaration, not a live link.
 */
export interface InterviewRound {
  id: string;
  applicationId: string;
  roundNumber: number;
  /** Short human title, e.g. "Technical round". */
  title: string;
  scheduledDate: string;
  /** 24-hour `HH:mm`. */
  scheduledTime: string;
  durationMinutes: number;
  mode: InterviewMode;
  /** Set when `mode === "IN_PERSON"`, else null. */
  location: string | null;
  /** Set when `mode === "ONLINE"`, else null. */
  onlineLink: string | null;
  panel: PersonRef[];
  evaluationFormId: string | null;
  evaluationFormName: string | null;
  candidateInstructions: string;
  status: InterviewStatus;
  rescheduleHistory: InterviewRescheduleEntry[];
  /** ISO-8601 timestamps. */
  createdAt: string;
  updatedAt: string;
  version: number;
}

/** Short reference to an evaluation form template, used by the scheduling
 *  form's picker. The full template (with its criteria) is
 *  `EvaluationFormTemplate` below. */
export interface EvaluationFormRef {
  id: string;
  name: string;
  description: string;
}

/* ── Interview evaluation (spec Sec 6 > Interview Evaluation) ────────────── */

/**
 * Who is looking. The blind-until-submit rule and the consolidated-results
 * view are both role-conditional, so every evaluation surface needs the
 * viewer's role, not just their id.
 *
 * Mirrors `prisma.Role` exactly (Phase 1 schema).
 */
export const USER_ROLES = [
  "TA_ADMIN",
  "RECRUITER",
  "DEPT_HEAD",
  "HIRING_MANAGER",
  "PANEL_MEMBER",
  "HR_LEADERSHIP",
  "AUDIT_USER",
  "TECH_ADMIN",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  TA_ADMIN: "TA administrator",
  RECRUITER: "Recruiter",
  DEPT_HEAD: "Department head",
  HIRING_MANAGER: "Hiring manager",
  PANEL_MEMBER: "Panel member",
  HR_LEADERSHIP: "HR leadership",
  AUDIT_USER: "Audit user",
  TECH_ADMIN: "Technical administrator",
};

/** The signed-in user as every client component sees them. */
export interface Viewer extends PersonRef {
  role: UserRole;
}

/**
 * One scored dimension on an evaluation form. Shape matches
 * `lib/evaluation-forms.ts`'s `criterionSchema` field for field, so the mock
 * templates below are swappable for `GET /api/v1/evaluation-forms` without
 * a mapping layer.
 */
export interface EvaluationCriterion {
  key: string;
  label: string;
  description?: string;
  /** Top of the scale for this criterion; scales may differ per template. */
  scoreMax: number;
}

/**
 * "Evaluation forms should be configurable for different role types" (spec
 * Sec 6 > Interview Evaluation). `criteria` is the configurable part; the four
 * free-text/choice fields on an evaluation (organisational suitability,
 * strengths, concerns, overall recommendation) are fixed by the spec and are
 * therefore fields of `Evaluation`, not criteria — the same split
 * `lib/evaluation-forms.ts` documents server-side.
 */
export interface EvaluationFormTemplate {
  id: string;
  name: string;
  /** Free-text role type the template is configured for, e.g. "Technical". */
  roleType: string;
  criteria: EvaluationCriterion[];
  isActive: boolean;
}

/**
 * The spec's "Overall recommendation" as a closed five-point scale.
 *
 * RECONCILIATION NOTE — matches `prisma.OverallRecommendation` exactly. The
 * PDF names the field but not its values; the backend picked this scale and
 * documented it as a design decision, and this list follows it rather than
 * inventing a second vocabulary.
 */
export const OVERALL_RECOMMENDATIONS = [
  "STRONG_YES",
  "YES",
  "NEUTRAL",
  "NO",
  "STRONG_NO",
] as const;

export type OverallRecommendation = (typeof OVERALL_RECOMMENDATIONS)[number];

export const OVERALL_RECOMMENDATION_LABELS: Record<
  OverallRecommendation,
  string
> = {
  STRONG_YES: "Strong yes",
  YES: "Yes",
  NEUTRAL: "Neutral",
  NO: "No",
  STRONG_NO: "Strong no",
};

/** Shown beside each option so five near-synonyms are actually separable. */
export const OVERALL_RECOMMENDATION_MEANING: Record<
  OverallRecommendation,
  string
> = {
  STRONG_YES: "Would actively push to hire. No reservations worth raising.",
  YES: "Would hire. Any concerns are manageable in the role.",
  NEUTRAL: "Could go either way — the decision needs the rest of the panel.",
  NO: "Would not hire for this role, on the evidence of this round.",
  STRONG_NO: "A clear gap or risk that another round would not change.",
};

/**
 * One panelist's evaluation of one interview round.
 *
 * `submittedAt` is the lock point: null means an editable draft, non-null
 * means the record is immutable (server-enforced) and — for panel members —
 * unlocks visibility of their peers' rows. The client mirrors both effects;
 * it never *decides* either.
 */
export interface EvaluationRecord {
  id: string;
  interviewId: string;
  panelist: PersonRef;
  panelistRole: UserRole;
  templateId: string;
  templateName: string;
  /** `{ [criterion.key]: score }`, only for criteria the panelist scored. */
  scores: Record<string, number>;
  organizationalSuitability: string;
  strengths: string;
  concerns: string;
  overallRecommendation: OverallRecommendation | null;
  /** ISO-8601 timestamp, or null while the record is still a draft. */
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Where the viewer's own evaluation stands, for status display. */
export type OwnEvaluationState = "NOT_STARTED" | "DRAFT" | "SUBMITTED";

export const OWN_EVALUATION_STATE_LABELS: Record<OwnEvaluationState, string> = {
  NOT_STARTED: "Not started",
  DRAFT: "Draft saved",
  SUBMITTED: "Submitted",
};

/**
 * Peer feedback for one round, as a discriminated union rather than a list
 * plus a boolean flag.
 *
 * This is the client-side shape of the blind-until-submit rule
 * (`lib/evaluation-visibility.ts`): in the `BLIND` variant there is no field
 * that could hold a peer's evaluation, so a gated view cannot accidentally
 * ship one to the browser — not hidden with CSS, not passed to a component
 * that happens not to render it, not present in the serialized payload at all.
 * The only thing `BLIND` carries is the count the spec permits
 * ("N of M panelists have submitted").
 */
export type PanelFeedbackView =
  | {
      state: "BLIND";
      submittedCount: number;
      totalPanelists: number;
    }
  | {
      state: "OPEN";
      submittedCount: number;
      totalPanelists: number;
      /** Submitted peer evaluations only — drafts are never peer-visible. */
      evaluations: EvaluationRecord[];
      /** Assigned panelists with nothing submitted yet. */
      awaiting: PersonRef[];
    };

/** One line of the consolidated "panel recommendations" list. */
export interface PanelRecommendation {
  panelist: PersonRef;
  panelistRole: UserRole;
  submittedAt: string | null;
  overallRecommendation: OverallRecommendation | null;
  /** Mean of this panelist's own scored criteria; null until submitted. */
  averageScore: number | null;
}

/**
 * Consolidated interview results (spec Sec 6 > Decisions and Approvals:
 * "Recruiters should see: panel recommendations, average score, missing
 * feedback, assessment results, key concerns, hiring-manager recommendation").
 *
 * A SUMMARY, never a verdict — the spec's own sentence is "the system may
 * summarize information but must not make the final hiring decision", so
 * nothing here (and nothing in the component that renders it) derives a
 * hire/no-hire signal, ranks candidates, or styles a recommendation as the
 * system's own.
 *
 * RECONCILIATION NOTE — `lib/reporting/evaluation-summary.ts` returns the same
 * fields with split `panelistId`/`panelistName` pairs; this shape nests them as
 * `PersonRef` like every other client type. One `.map()` in the fetch layer,
 * or the route serializes into this shape.
 *
 * "Assessment results" is deliberately NOT duplicated here: it already lives on
 * the Screening tab of the same application, and a second copy is a second
 * thing to keep in sync. The summary panel links across to it instead.
 */
export interface EvaluationSummaryView {
  interviewId: string;
  totalPanelists: number;
  submittedCount: number;
  missingFeedback: PersonRef[];
  panelRecommendations: PanelRecommendation[];
  /** Mean across every submitted evaluation's scored criteria; null if none. */
  averageScore: number | null;
  /** The scale those scores are out of, so "3.6" is readable as "3.6 / 5". */
  scoreMax: number | null;
  keyConcerns: { panelist: PersonRef; concerns: string }[];
  /** Called out by role for the recruiter view the spec asks for. Null when no
   *  hiring manager sits on this panel, or they have not submitted. */
  hiringManagerRecommendation: {
    panelist: PersonRef;
    recommendation: OverallRecommendation;
  } | null;
}

/**
 * Everything one interview round's evaluation surface renders, already
 * filtered for the viewer.
 *
 * Every field is the *result* of a visibility decision made where the data is
 * fetched (server-side with the real API; `_mock-evaluations.ts`'s single
 * exported reader with mocks) — no component re-derives who may see what.
 */
export interface InterviewEvaluationRound {
  interviewId: string;
  roundNumber: number;
  title: string;
  scheduledDate: string;
  scheduledTime: string;
  status: InterviewStatus;
  /** Null when the round was scheduled without assigning a form. */
  template: EvaluationFormTemplate | null;
  totalPanelists: number;
  submittedCount: number;
  /** Whether the viewer sits on this panel — i.e. owes an evaluation. */
  viewerIsPanelist: boolean;
  /** The viewer's own evaluation. Null if they are not a panelist, or have
   *  not started one. A panelist only ever edits this record. */
  own: EvaluationRecord | null;
  panelFeedback: PanelFeedbackView;
  /** Null for viewers whose role does not receive the consolidated view. */
  summary: EvaluationSummaryView | null;
}

/**
 * What the panelist's form sends on save-draft and on submit. Identical body
 * for both — the difference is which endpoint it goes to, because submitting
 * is a state transition (lock + unblind + audit), not a field edit.
 */
export interface EvaluationDraftInput {
  interviewId: string;
  templateId: string;
  scores: Record<string, number>;
  organizationalSuitability: string;
  strengths: string;
  concerns: string;
  overallRecommendation: OverallRecommendation | null;
}

export function ownEvaluationState(
  own: EvaluationRecord | null,
): OwnEvaluationState {
  if (!own) return "NOT_STARTED";
  return own.submittedAt ? "SUBMITTED" : "DRAFT";
}

/** Mean of a scores map, or null when nothing has been scored. */
export function meanScore(scores: Record<string, number>): number | null {
  const values = Object.values(scores).filter((value) =>
    Number.isFinite(value),
  );
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/* ── Communication (spec Sec 6 > Communication, BUILD_PLAN Sec 2.8) ──────── */

/**
 * Spec Sec 6: "Drafted → Awaiting Approval → Approved → Sent → Delivered or
 * Failed", locked again as the pipeline in BUILD_PLAN.md Sec 2.8.
 */
export const COMMUNICATION_STATUSES = [
  "DRAFTED",
  "AWAITING_APPROVAL",
  "APPROVED",
  "SENT",
  "DELIVERED",
  "FAILED",
] as const;

export type CommunicationStatus = (typeof COMMUNICATION_STATUSES)[number];

export const COMMUNICATION_STATUS_LABELS: Record<CommunicationStatus, string> =
  {
    DRAFTED: "Drafted",
    AWAITING_APPROVAL: "Awaiting approval",
    APPROVED: "Approved",
    SENT: "Sent",
    DELIVERED: "Delivered",
    FAILED: "Failed",
  };

/**
 * One-line explanation of each state, shown next to the pill. Recruiters have
 * to tell "Sent" and "Delivered" apart to know whether chasing is warranted,
 * and the difference is entirely about who last confirmed what.
 */
export const COMMUNICATION_STATUS_MEANING: Record<CommunicationStatus, string> =
  {
    DRAFTED: "Saved on this application. Nobody has been asked to approve it.",
    AWAITING_APPROVAL: "Waiting on a recruiter to approve it before it sends.",
    APPROVED: "Approved and queued. The send worker will pick it up shortly.",
    SENT: "Handed to the provider. Waiting on a delivery receipt.",
    DELIVERED: "The provider confirmed the candidate received it.",
    FAILED: "The provider rejected it. Nothing reached the candidate.",
  };

export const COMMUNICATION_CHANNELS = ["EMAIL", "WHATSAPP"] as const;

export type CommunicationChannel = (typeof COMMUNICATION_CHANNELS)[number];

export const COMMUNICATION_CHANNEL_LABELS: Record<
  CommunicationChannel,
  string
> = {
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
};

/** The seven message kinds spec Sec 6 > Communication lists verbatim. */
export const COMMUNICATION_EVENTS = [
  "INTERVIEW_INVITATION",
  "INTERVIEW_REMINDER",
  "RESCHEDULING",
  "DOCUMENT_REQUEST",
  "SELECTION",
  "REJECTION",
  "JOINING_REMINDER",
] as const;

export type CommunicationEvent = (typeof COMMUNICATION_EVENTS)[number];

export const COMMUNICATION_EVENT_LABELS: Record<CommunicationEvent, string> = {
  INTERVIEW_INVITATION: "Interview invitation",
  INTERVIEW_REMINDER: "Interview reminder",
  RESCHEDULING: "Rescheduling",
  DOCUMENT_REQUEST: "Document request",
  SELECTION: "Selection",
  REJECTION: "Rejection",
  JOINING_REMINDER: "Joining reminder",
};

/**
 * WhatsApp Business API template state (BUILD_PLAN.md key assumption 3):
 * business-initiated WhatsApp messages only send against a Meta-approved
 * template, so this is a real gate on the channel, not decoration.
 */
export const PROVIDER_APPROVAL_STATES = [
  "NOT_REQUIRED",
  "APPROVED",
  "PENDING",
] as const;

export type ProviderApprovalState = (typeof PROVIDER_APPROVAL_STATES)[number];

/**
 * A versioned, field-allowlisted message template (BUILD_PLAN.md Sec 2.8).
 * Recruiters pick one; they never compose free text against a candidate.
 */
export interface MessageTemplate {
  id: string;
  event: CommunicationEvent;
  channel: CommunicationChannel;
  name: string;
  /** Template version — a template body is never edited in place. */
  version: number;
  /** Email only; null on WhatsApp templates. */
  subject: string | null;
  /** Body with `{{field.path}}` placeholders. */
  body: string;
  /**
   * Exactly which context fields this template may interpolate.
   * `internal_notes` and `rejection_reason` are structurally absent from every
   * allowlist in the system — see `lib/communications/field-allowlist.ts`.
   */
  allowedFields: readonly string[];
  providerApproval: ProviderApprovalState;
}

/** One drafted/sent candidate message on one application. */
export interface Communication {
  id: string;
  applicationId: string;
  templateId: string;
  templateName: string;
  templateVersion: number;
  event: CommunicationEvent;
  channel: CommunicationChannel;
  /** Email address or mobile number, as addressed at draft time. */
  recipient: string;
  subject: string | null;
  /** The rendered body, frozen at draft time — not re-rendered on display. */
  renderedBody: string;
  status: CommunicationStatus;
  /** Provider-facing failure detail, shown only on `FAILED`. */
  failureReason: string | null;
  createdBy: PersonRef;
  createdAt: string;
  approvedBy: PersonRef | null;
  approvedAt: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  /** Send attempts made by the worker (BUILD_PLAN.md Sec 2.8, bounded retry). */
  attemptCount: number;
  version: number;
}

/* ── Phase 3 reconciliation with the landed Prisma schema ────────────────── */

/**
 * The backend's Phase 3 models landed while this surface was being built. The
 * differences below are real contract gaps, listed once here rather than
 * scattered, and none of them is a rename this agent should decide unilaterally.
 *
 * ScreeningAssessment
 *  1. `eligibility` is a `Boolean` server-side, a three-value enum here. The
 *     third value ("eligible with reservation") is the one recruiters reach for
 *     most: a candidate who clears the bar with a gap the panel should probe.
 *     A boolean forces that into free-text comments where nothing can query it.
 *     Either widen the column to an enum, or drop the middle value here.
 *  2. `assessmentScore` is a bare `Float?` with no `assessmentMaxScore`. See
 *     the note on `ScreeningAssessment` above — a score without its scale is
 *     unreadable in a list.
 *  3. `ScreeningAttendance` is `ATTENDED | NO_SHOW | RESCHEDULED`; this file
 *     has `NOT_APPLICABLE | ATTENDED | ABSENT | LATE | RESCHEDULED`.
 *     `NOT_APPLICABLE` matters because plenty of roles run no assessment and
 *     "no attendance recorded" must not read as "did not turn up".
 *     `LATE` is droppable; `ABSENT`/`NO_SHOW` is a pure rename.
 *  4. `assessmentDocumentId` is a single `String? @unique`; this file models
 *     `documents: DocumentRef[]`. A marked paper assessment is routinely two
 *     files (answer sheet + marking sheet).
 *  5. The model has no `version` column, so screening edits have no optimistic
 *     lock even though two roles (recruiter, assessment evaluator) write to the
 *     same row. `ScreeningForm` already sends and handles one.
 *  6. `telephoneAssessmentOutcome` / `recommendation` / `assessmentType` /
 *     `evaluatorRecommendation` are free `String?` server-side and closed enums
 *     here — the same trade-off already flagged for `Requisition.positionLevel`.
 *
 * Interview
 *  7. `scheduledAt` is a single `DateTime`; this file keeps `scheduledDate` +
 *     `scheduledTime` as a local wall clock. See the RECONCILIATION NOTE on
 *     `InterviewRound` — if the timestamp stays, it needs an accompanying IANA
 *     zone, or a 10:00 interview becomes 04:00 in a WhatsApp message.
 *  8. There is no `title` (round name) and no `mode`. Mode is currently implied
 *     by which of `location`/`onlineLink` is non-null, which permits the
 *     both-set and neither-set states the UI has no way to render.
 *  9. `InterviewStatus` server-side lacks `NO_SHOW`.
 *
 * InterviewRescheduleHistory
 * 10. `reason` is nullable. The spec requires rescheduling history to be
 *     visible, and a history entry with no reason is exactly the untraceable
 *     change this system exists to remove — `RescheduleForm` requires it, and
 *     the column should be `String` (not null) to match.
 *
 * Communication / MessageTemplate
 * 11. No `attemptCount` on `Communication`, so the retry affordance cannot say
 *     how many sends have been tried or when the bounded retry is exhausted.
 * 12. `MessageTemplate.category` (a `MessageTemplateCategory` enum) is this
 *     file's `event`; confirm the member names line up with
 *     `COMMUNICATION_EVENTS` before wiring.
 * 13. `Communication` has no `recipient` column — the address is presumably
 *     derived from the candidate at send time. The draft UI lets a recruiter
 *     override it for one message (a candidate who asks to be emailed at work),
 *     which needs a column to live in.
 * 14. Field naming: `renderedSubject`/`draftedBy` server-side vs
 *     `subject`/`createdBy` here. Pure rename either way.
 */

/* ── Reconciliation with the Home task queue ─────────────────────────────── */

/**
 * The Home queue's `Task` (`components/tasks/types.ts`) is a projection of an
 * application whose next action is owned by the current user. Keeping the
 * mapping here — rather than duplicating field names in a page — means that
 * when `/api/v1/reports/my-tasks` lands, only this function has to agree with
 * it.
 */
export function applicationToTask(
  application: ApplicationSummary,
  currentUserId: string,
): Task {
  return {
    id: application.id,
    candidateId: application.candidateId,
    candidateName: application.candidateName,
    requisitionRef: application.requisitionRef,
    requisitionTitle: application.requisitionTitle,
    stage: STAGE_LABELS[application.stage],
    owner:
      application.actionOwner.id === currentUserId
        ? "You"
        : application.actionOwner.name,
    nextAction: application.nextAction,
    dueDate: application.dueDate,
  };
}
