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
