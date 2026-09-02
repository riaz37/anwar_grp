/**
 * Approval + Decision domain types (spec Sec 6 > Decisions and Approvals;
 * BUILD_PLAN.md Sec 2.9, Sec 3.1 item 5).
 *
 * Kept in its own module rather than appended to `lib/types/domain.ts`: that
 * file is already ~1100 lines and covers the requisition → candidate →
 * interview surface, and the approval chain is a self-contained vocabulary
 * (chain config, request, step, decision) that nothing before Phase 5 refers
 * to. Same conventions as `domain.ts` — ISO strings across the boundary,
 * `PersonRef`/`OrgUnitRef` instead of bare ids, `version` carried wherever the
 * record can be written.
 *
 * The hard product constraint from the PDF is repeated here because it shapes
 * these types: "The system may summarize information but must not make the
 * final hiring decision." There is deliberately no field anywhere below that
 * holds a system-derived verdict, score threshold, or suggested outcome. Every
 * outcome in this file is attributed to a named human with a timestamp.
 */

import type {
  OrgUnitRef,
  PersonRef,
  PositionLevel,
  UserRole,
} from "./domain";

/* ── Chain configuration (BUILD_PLAN.md Sec 2.9) ─────────────────────────── */

/**
 * One position on the chain. The spec's requirement is "Approval flows should
 * be configurable by position, department, business unit, and authority
 * level" — which BUILD_PLAN.md Sec 2.9 deliberately reads as an *ordered list
 * of approver roles* per (business unit × department × position level), not a
 * general conditional workflow engine (explicitly excluded from scope).
 *
 * `approverRole` is a role, not a person: a chain that named individuals would
 * break the day someone changes job, and the routing question the recruiter
 * asks is "who has to sign this off", which is a role question.
 */
export interface ApprovalChainStepConfig {
  /** 1-based. Steps are decided strictly in this order. */
  order: number;
  approverRole: UserRole;
  /** Why this role is on the chain — shown as supporting text, not a rule. */
  note?: string;
}

/**
 * A chain, resolved for one (business unit, department, position level) key.
 *
 * `department: null` is a business-unit-wide default: a BU that runs one
 * approval convention across every department should not have to duplicate the
 * same three rows eleven times. Lookup precedence is exact department first,
 * then the BU-wide default — see `matchApprovalChain()` below, which is the one
 * place that precedence lives.
 */
export interface ApprovalChainConfig {
  id: string;
  businessUnit: OrgUnitRef;
  /** Null means "every department in this business unit". */
  department: OrgUnitRef | null;
  positionLevel: PositionLevel;
  /** Ordered, 1-based, at least one entry. */
  steps: readonly ApprovalChainStepConfig[];
  isActive: boolean;
}

/* ── Requests, steps and decisions ───────────────────────────────────────── */

export const APPROVAL_REQUEST_STATUSES = [
  "IN_PROGRESS",
  "APPROVED",
  "REJECTED",
] as const;

export type ApprovalRequestStatus = (typeof APPROVAL_REQUEST_STATUSES)[number];

export const APPROVAL_REQUEST_STATUS_LABELS: Record<
  ApprovalRequestStatus,
  string
> = {
  IN_PROGRESS: "In progress",
  APPROVED: "Fully approved",
  REJECTED: "Rejected",
};

export const APPROVAL_REQUEST_STATUS_MEANING: Record<
  ApprovalRequestStatus,
  string
> = {
  IN_PROGRESS:
    "The chain is live and blocked on one named approver. Nothing has been decided for the candidate yet.",
  APPROVED:
    "Every step approved. The recruiter can now move the application to Selected and tell the candidate.",
  REJECTED:
    "One approver rejected. The chain ended there — no later step was asked, and none will be.",
};

export const APPROVAL_OUTCOMES = ["APPROVED", "REJECTED"] as const;

export type ApprovalOutcome = (typeof APPROVAL_OUTCOMES)[number];

/**
 * One recorded decision. `comments` is a plain `string` (not optional) because
 * an untraceable approval is the thing this whole module exists to remove; the
 * *form* requires it on reject and allows it empty on approve, and that rule
 * lives in `components/approvals/ApprovalDecisionForm.tsx`.
 *
 * These comments are INTERNAL. They are excluded from every candidate-facing
 * message by construction — `lib/communications/field-allowlist.ts` has no
 * field they could occupy, and nothing in the Phase 5 UI passes them into a
 * message draft. See the note on `PostDecisionPrompt`.
 */
export interface ApprovalDecision {
  id: string;
  outcome: ApprovalOutcome;
  decidedBy: PersonRef;
  /** The role the decider held at the time — a chain step is a role slot. */
  decidedByRole: UserRole;
  comments: string;
  /** ISO-8601 timestamp. */
  decidedAt: string;
}

/**
 * How one step of a live chain currently reads.
 *
 * `HALTED` is the state that keeps a rejected chain honest: the steps after a
 * rejection were never asked and never will be, and rendering them as "pending"
 * would imply the chain might still move. They are a different thing from
 * `NOT_REACHED`, which is a step that genuinely is still coming.
 */
export const APPROVAL_STEP_STATES = [
  "APPROVED",
  "REJECTED",
  "AWAITING",
  "NOT_REACHED",
  "HALTED",
] as const;

export type ApprovalStepState = (typeof APPROVAL_STEP_STATES)[number];

export const APPROVAL_STEP_STATE_LABELS: Record<ApprovalStepState, string> = {
  APPROVED: "Approved",
  REJECTED: "Rejected",
  AWAITING: "Waiting on this approver",
  NOT_REACHED: "Not reached yet",
  HALTED: "Never asked",
};

export interface ApprovalStep {
  id: string;
  order: number;
  approverRole: UserRole;
  note?: string;
  state: ApprovalStepState;
  /** Present on `APPROVED` and `REJECTED` steps only. */
  decision: ApprovalDecision | null;
}

/**
 * One approval request against one application.
 *
 * The chain is snapshotted into `steps` at initiation time rather than read
 * live from the config, on purpose: editing a chain config six months later
 * must not retroactively change what an already-decided request says happened.
 */
export interface ApprovalRequest {
  id: string;
  applicationId: string;
  /** The config this request was built from, for traceability. */
  chainConfigId: string;
  status: ApprovalRequestStatus;
  steps: readonly ApprovalStep[];
  initiatedBy: PersonRef;
  /** ISO-8601 timestamps. */
  initiatedAt: string;
  /** Set when the chain reached `APPROVED` or `REJECTED`; null while live. */
  closedAt: string | null;
  /**
   * RECONCILIATION NOTE — `prisma.ApprovalRequest` has no `version` column: the
   * decide route guards the same race with `NOT_CURRENT_STEP` (409) instead of
   * an optimistic lock. Kept here because BUILD_PLAN.md Sec 2.4 makes a version
   * token the convention for every mutable resource, and the decision form
   * shows it beside the action the way the stage-change form does. It maps to
   * nothing server-side today — see the contract-gap list in
   * `app/(dashboard)/_mock-approvals.ts`.
   */
  version: number;
}

/* ── The application-level view ──────────────────────────────────────────── */

/**
 * What the requisition contributed to the chain lookup. Shown on screen so a
 * recruiter reading "no chain is configured" can see the three values that were
 * looked up, rather than having to guess which one is wrong.
 */
export interface ApprovalRouting {
  businessUnit: OrgUnitRef;
  department: OrgUnitRef;
  positionLevel: PositionLevel;
}

/**
 * Everything the Decision tab needs about approvals for one application,
 * already resolved for the viewer.
 *
 * `viewerDecidableStepId` is computed where the data is fetched (server-side
 * with the real API, in `_mock-approvals.ts` with mocks) rather than in a
 * component: the client rendering a decision button is a UX convenience, and
 * the route re-checks the caller's role regardless (BUILD_PLAN.md Sec 2.5).
 */
export interface ApplicationApproval {
  applicationId: string;
  routing: ApprovalRouting;
  /** Null when no chain matches the routing above — an expected state. */
  chain: ApprovalChainConfig | null;
  /** Null until someone starts the chain. */
  request: ApprovalRequest | null;
  /** Whether the viewer's role may start a chain on this application. */
  viewerCanInitiate: boolean;
  /** The step the viewer may decide right now, or null. */
  viewerDecidableStepId: string | null;
}

/** What the decision form sends. `version` is the request's optimistic lock. */
export interface ApprovalDecisionInput {
  requestId: string;
  stepId: string;
  outcome: ApprovalOutcome;
  comments: string;
  version: number;
}

/* ── Derivations (pure, shared by the mock layer and the components) ─────── */

/**
 * Chain lookup precedence, in one place: an exact department match wins over a
 * business-unit-wide default, and inactive configs never match.
 */
export function matchApprovalChain(
  configs: readonly ApprovalChainConfig[],
  routing: ApprovalRouting,
): ApprovalChainConfig | null {
  const candidates = configs.filter(
    (config) =>
      config.isActive &&
      config.businessUnit.id === routing.businessUnit.id &&
      config.positionLevel === routing.positionLevel,
  );
  return (
    candidates.find(
      (config) => config.department?.id === routing.department.id,
    ) ??
    candidates.find((config) => config.department === null) ??
    null
  );
}

/** The step the chain is currently blocked on, or null if it has ended. */
export function awaitingStep(
  request: ApprovalRequest | null,
): ApprovalStep | null {
  if (!request || request.status !== "IN_PROGRESS") return null;
  return request.steps.find((step) => step.state === "AWAITING") ?? null;
}

/** The step that ended a rejected chain, or null. */
export function rejectingStep(
  request: ApprovalRequest | null,
): ApprovalStep | null {
  if (!request) return null;
  return request.steps.find((step) => step.state === "REJECTED") ?? null;
}

export function approvedStepCount(request: ApprovalRequest): number {
  return request.steps.filter((step) => step.state === "APPROVED").length;
}

/**
 * Recomputes every step's state after a decision, and the request status with
 * it. A rejection ends the chain: the deciding step becomes `REJECTED` and
 * every later step becomes `HALTED`, never `NOT_REACHED`.
 *
 * Exported because the mock write path and the optimistic client update must
 * agree with each other and with whatever the API returns — one implementation,
 * not three.
 */
export function applyDecision(
  request: ApprovalRequest,
  stepId: string,
  decision: ApprovalDecision,
): ApprovalRequest {
  const index = request.steps.findIndex((step) => step.id === stepId);
  if (index < 0) return request;

  const rejected = decision.outcome === "REJECTED";
  const isLast = index === request.steps.length - 1;
  const status: ApprovalRequestStatus = rejected
    ? "REJECTED"
    : isLast
      ? "APPROVED"
      : "IN_PROGRESS";

  const steps = request.steps.map((step, position): ApprovalStep => {
    if (position === index) {
      return {
        ...step,
        state: rejected ? "REJECTED" : "APPROVED",
        decision,
      };
    }
    if (position < index) return step;
    if (rejected) return { ...step, state: "HALTED", decision: null };
    return {
      ...step,
      state: position === index + 1 ? "AWAITING" : "NOT_REACHED",
      decision: null,
    };
  });

  return {
    ...request,
    status,
    steps,
    closedAt:
      status === "IN_PROGRESS" ? null : decision.decidedAt,
    version: request.version + 1,
  };
}

/**
 * The stage the recruiter should move the application to once the chain has
 * ended, and the message event that goes with it (spec Sec 6 > Communication).
 * Null while the chain is still live — there is nothing to tell the candidate
 * about a decision nobody has finished making.
 */
export function outcomeFollowUp(
  status: ApprovalRequestStatus,
): { stage: "SELECTED" | "REJECTED"; event: "SELECTION" | "REJECTION" } | null {
  if (status === "APPROVED") return { stage: "SELECTED", event: "SELECTION" };
  if (status === "REJECTED") return { stage: "REJECTED", event: "REJECTION" };
  return null;
}
