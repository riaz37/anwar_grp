import "server-only";
import {
  applyDecision,
  matchApprovalChain,
  type ApplicationApproval,
  type ApprovalChainConfig,
  type ApprovalDecision,
  type ApprovalOutcome,
  type ApprovalRequest,
  type ApprovalRouting,
  type ApprovalStep,
} from "@/lib/types/approvals";
import type { UserRole, Viewer } from "@/lib/types/domain";
import { orgUnitById, personById } from "./_mock-reference";
import { getMockRequisition } from "./_mock-requisitions";

/**
 * TEMPORARY mock data for Approval + Decision (spec Sec 6 > Decisions and
 * Approvals; BUILD_PLAN.md Sec 2.9, Sec 3.1 item 5).
 *
 * Same convention as `_mock-evaluations.ts`, including `import "server-only"`,
 * and for a related reason: `viewerDecidableStepId` below is an authorization
 * answer. Computing it here — where the real implementation computes it, from
 * the session's role — keeps the client from ever being the thing that decides
 * who may approve. The button's visibility is a UX convenience; the route
 * re-checks the caller's role server-side regardless (BUILD_PLAN.md Sec 2.5).
 *
 * ── SWAP POINTS ───────────────────────────────────────────────────────────
 *
 * The backend's Phase 5 routes landed while this surface was being built, so
 * the swap points below are read off the real handlers, not guessed:
 *
 *   app/(dashboard)/candidates/[id]/page.tsx
 *     getApplicationApproval(application, viewer)
 *       -> GET /api/v1/applications/{id}/approval-request
 *          200 -> the newest ApprovalRequest with `decisions` (one row per
 *                 step, pre-created `PENDING`) and `chainConfig.steps`, so the
 *                 whole chain renders from one response.
 *          404 -> NOT-INITIATED. An expected state, not a failure: the client
 *                 must tell it apart from a transport error, or every
 *                 unstarted application shows an error banner.
 *       -> GET /api/v1/approval-chain-configs
 *              ?businessUnitId=&departmentId=&positionLevel=&isActive=true
 *          Needed only for the NOT-INITIATED state, to show the chain that
 *          *would* run. An empty `data` array is the NO-CHAIN-CONFIGURED state
 *          (see `StartApprovalPanel`) — also not an error.
 *
 *   app/(dashboard)/_approval-actions.ts
 *     initiateApprovalAction -> POST /api/v1/applications/{id}/approval-request
 *                               (no body)
 *                               201 -> ApprovalRequest + decisions + chainConfig
 *                               400 NO_CHAIN_CONFIGURED -> render the no-chain
 *                                   panel, not a generic error
 *                               403 -> caller is not RECRUITER/TA_ADMIN
 *     decideApprovalAction   -> POST /api/v1/approval-requests/{id}/decide
 *                               { stepIndex, decision, comments }
 *                               200 -> the whole ApprovalRequest + decisions,
 *                                   so the client never recomputes step states
 *                               403 WRONG_ROLE     -> caller lacks the step's role
 *                               409 NOT_CURRENT_STEP -> someone decided first
 *                               400 ALREADY_DECIDED / REQUEST_CLOSED
 *
 * ── CONTRACT GAPS TO RESOLVE DURING THE WIRING PASS ───────────────────────
 * Listed here rather than silently papered over in a `.map()`:
 *
 *  1. `stepIndex` is 0-based server-side; `ApprovalStep.order` here is 1-based
 *     (it is rendered as "Step 1 of 3"). The decide call must send
 *     `order - 1`, and the API takes no `stepId` at all — the client's step
 *     ids are local. One `.map()` in the fetch layer, but it has to exist.
 *  2. `ApprovalRequest` has no `version` column, so the decide route takes no
 *     optimistic-lock token — it guards the same race with `NOT_CURRENT_STEP`
 *     (409) and `ALREADY_DECIDED` (400) instead. That is arguably sufficient
 *     for this resource, but it diverges from BUILD_PLAN.md Sec 2.4 ("every
 *     mutating endpoint requires the resource's current `version`"). Either
 *     add the column or record the exception. `ApprovalRequest.version` here
 *     is kept so the decision form can show and echo one; it maps to nothing
 *     server-side today.
 *  3. `ApprovalRequestStatus` server-side is
 *     `PENDING | IN_PROGRESS | APPROVED | REJECTED`; this file has three
 *     (no `PENDING` — a chain that has been started but not yet decided is
 *     already "in progress" as far as the recruiter is concerned). Map
 *     `PENDING -> IN_PROGRESS` in the fetch layer, or drop the server value.
 *  4. Step states are derived, not stored. The API returns one
 *     `ApprovalDecision` row per step, `PENDING` until decided, so the client
 *     derives: decided rows -> `APPROVED`/`REJECTED`; a `PENDING` row at
 *     `currentStepIndex` -> `AWAITING`; later `PENDING` rows -> `NOT_REACHED`
 *     if the request is live, `HALTED` if it is `REJECTED`. That last branch
 *     is the whole "a single rejection ends the chain" property — the backend
 *     leaves those rows `PENDING`, and rendering them as pending would be
 *     wrong.
 *  5. `ApprovalChainConfig.departmentId` is required server-side, so the
 *     business-unit-wide default this file models (`department: null`, and
 *     `matchApprovalChain()`'s precedence rule) has no counterpart. Either add
 *     a nullable department + the same precedence server-side, or drop the
 *     wildcard here and accept one config row per department.
 *  6. `comments` is `.optional()` on the decide route for BOTH outcomes, so
 *     "a rejection must say why" is currently a client-side rule only — a
 *     modified client can post a bare rejection, which is exactly the
 *     untraceable decision this module exists to prevent. Enforce it in
 *     `recordDecision()`.
 *  7. `ApprovalChainConfigStep` has no `note` column; the per-step rationale
 *     shown on the start panel is mock-only until it does.
 *  8. `positionLevel` is a free `String(1..100)` server-side and a closed enum
 *     client-side — the same gap already flagged for `Requisition.positionLevel`
 *     in `lib/types/domain.ts`, and it bites harder here: a typo routes the
 *     approval to nobody and surfaces as "no chain configured".
 *
 * The fixtures cover every state the Decision tab renders:
 *   app_8790  chain live, step 1 approved, step 2 awaiting  — in progress
 *   app_8851  every step approved                            — approved, and
 *                                                              the Selection
 *                                                              message prompt
 *   app_8781  step 2 rejected, no later step                 — rejected, and
 *                                                              the Rejection
 *                                                              message prompt
 *   app_8814  chain configured, nothing initiated            — start action
 *   app_8832  no chain for Corporate/Finance/Junior          — no-chain state
 *   app_8866  matched by the Cement business-unit default    — wildcard lookup
 */

/* ── Chain configuration ─────────────────────────────────────────────────── */

function chain(
  id: string,
  businessUnitId: string,
  departmentId: string | null,
  positionLevel: ApprovalChainConfig["positionLevel"],
  steps: readonly { role: UserRole; note?: string }[],
): ApprovalChainConfig {
  return {
    id,
    businessUnit: orgUnitById(businessUnitId),
    department: departmentId ? orgUnitById(departmentId) : null,
    positionLevel,
    isActive: true,
    steps: steps.map((step, index) => ({
      order: index + 1,
      approverRole: step.role,
      note: step.note,
    })),
  };
}

/**
 * Six configured chains, deliberately not one per requisition: real approval
 * conventions are sparse and uneven, and a fixture set where every position
 * happens to have a chain would hide the state this UI most needs to handle
 * well — the one where nobody has configured the combination yet.
 *
 * Note the shapes vary by authority level, which is the spec's own
 * "configurable by … authority level": a senior merchandiser needs four
 * signatures, a mid-level production officer two.
 */
const CHAIN_CONFIGS: readonly ApprovalChainConfig[] = [
  chain("acc_textiles_prod_mid", "bu_textiles", "dep_prod", "MID", [
    { role: "DEPT_HEAD", note: "Owns the headcount this vacancy sits in." },
    { role: "HR_LEADERSHIP", note: "Confirms grade and headcount budget." },
  ]),
  chain("acc_textiles_merch_senior", "bu_textiles", "dep_merch", "SENIOR", [
    { role: "HIRING_MANAGER", note: "Confirms the panel's recommendation." },
    { role: "DEPT_HEAD" },
    { role: "HR_LEADERSHIP", note: "Confirms grade and headcount budget." },
    { role: "TA_ADMIN", note: "Final record check before the offer goes out." },
  ]),
  chain("acc_corp_hr_mid", "bu_corp", "dep_hr", "MID", [
    { role: "HIRING_MANAGER" },
    { role: "DEPT_HEAD" },
    { role: "HR_LEADERSHIP" },
  ]),
  // Three steps, and the seeded request below is rejected at the second — so
  // the third renders in the `HALTED` state ("Never asked"). Without a chain
  // longer than the step that rejects it, that state has nowhere to appear,
  // and it is the one this view most needs to get right.
  chain("acc_corp_it_mid", "bu_corp", "dep_it", "MID", [
    { role: "DEPT_HEAD" },
    { role: "HR_LEADERSHIP", note: "Confirms grade and headcount budget." },
    { role: "TA_ADMIN", note: "Final record check before the offer goes out." },
  ]),
  chain("acc_textiles_quality_entry", "bu_textiles", "dep_quality", "ENTRY", [
    { role: "DEPT_HEAD", note: "Entry-level hires stop at the department." },
  ]),
  // Business-unit-wide default: no department, so it matches any Cement
  // department at mid level that has no chain of its own.
  chain("acc_cement_any_mid", "bu_cement", null, "MID", [
    { role: "DEPT_HEAD" },
    { role: "HR_LEADERSHIP" },
  ]),
];

/** SWAP POINT — GET /api/v1/approval-chain-configs (the TA_ADMIN config view). */
export function getMockApprovalChains(): readonly ApprovalChainConfig[] {
  return CHAIN_CONFIGS;
}

/* ── Seeded requests ─────────────────────────────────────────────────────── */

function timestampDaysAgo(offset: number, hour = 11): string {
  const date = new Date();
  date.setUTCHours(hour, 40, 0, 0);
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString();
}

interface DecisionSeed {
  outcome: ApprovalOutcome;
  byId: string;
  comments: string;
  daysAgo: number;
}

interface RequestSeed {
  id: string;
  applicationId: string;
  chainConfigId: string;
  initiatedById: string;
  initiatedDaysAgo: number;
  /** One entry per decided step, in order. Undecided steps are omitted. */
  decisions: readonly DecisionSeed[];
}

const REQUEST_SEEDS: readonly RequestSeed[] = [
  {
    id: "apr_8790",
    applicationId: "app_8790",
    chainConfigId: "acc_textiles_prod_mid",
    initiatedById: "usr_recruiter_1",
    initiatedDaysAgo: 6,
    decisions: [
      {
        outcome: "APPROVED",
        byId: "usr_panel_1",
        comments:
          "Agreed. The planning gap has been open since March and this is the strongest of the three we interviewed.",
        daysAgo: 4,
      },
    ],
  },
  {
    id: "apr_8851",
    applicationId: "app_8851",
    chainConfigId: "acc_corp_hr_mid",
    initiatedById: "usr_recruiter_1",
    initiatedDaysAgo: 7,
    decisions: [
      {
        outcome: "APPROVED",
        byId: "usr_hm_2",
        comments: "Panel was unanimous. No reservations from my side.",
        daysAgo: 6,
      },
      {
        outcome: "APPROVED",
        byId: "usr_panel_2",
        comments: "",
        daysAgo: 4,
      },
      {
        outcome: "APPROVED",
        byId: "usr_hrl_1",
        comments:
          "Grade and headcount confirmed against the approved 2026 budget line.",
        daysAgo: 2,
      },
    ],
  },
  {
    id: "apr_8781",
    applicationId: "app_8781",
    chainConfigId: "acc_corp_it_mid",
    initiatedById: "usr_recruiter_1",
    initiatedDaysAgo: 21,
    decisions: [
      {
        outcome: "APPROVED",
        byId: "usr_panel_1",
        comments: "Technically fine for the role as scoped.",
        daysAgo: 17,
      },
      {
        outcome: "REJECTED",
        byId: "usr_hrl_1",
        comments:
          "The second support headcount was frozen when the MSP contract was signed. Nothing to do with the candidate — do not re-run this chain until the freeze lifts.",
        daysAgo: 9,
      },
    ],
  },
];

function buildRequest(seed: RequestSeed): ApprovalRequest {
  const config = CHAIN_CONFIGS.find(
    (entry) => entry.id === seed.chainConfigId,
  );
  if (!config) {
    throw new Error(`Unknown approval chain config: ${seed.chainConfigId}`);
  }

  const base: ApprovalRequest = {
    id: seed.id,
    applicationId: seed.applicationId,
    chainConfigId: config.id,
    status: "IN_PROGRESS",
    initiatedBy: personById(seed.initiatedById),
    initiatedAt: timestampDaysAgo(seed.initiatedDaysAgo),
    closedAt: null,
    version: 1,
    steps: config.steps.map(
      (step): ApprovalStep => ({
        id: `${seed.id}_s${step.order}`,
        order: step.order,
        approverRole: step.approverRole,
        note: step.note,
        state: step.order === 1 ? "AWAITING" : "NOT_REACHED",
        decision: null,
      }),
    ),
  };

  // Replayed through the same `applyDecision` the live UI uses, rather than
  // hand-writing each step's end state — the fixtures cannot drift from the
  // rule that way.
  return seed.decisions.reduce((request, decisionSeed, index) => {
    const step = request.steps[index];
    const decision: ApprovalDecision = {
      id: `${step.id}_d`,
      outcome: decisionSeed.outcome,
      decidedBy: personById(decisionSeed.byId),
      decidedByRole: step.approverRole,
      comments: decisionSeed.comments,
      decidedAt: timestampDaysAgo(decisionSeed.daysAgo),
    };
    return applyDecision(request, step.id, decision);
  }, base);
}

/**
 * In-memory store so a decision made through the server action survives the
 * reload that follows it, in one dev-server process. Replaced wholesale by the
 * database — this is not a cache to keep.
 */
let STORE: readonly ApprovalRequest[] = REQUEST_SEEDS.map(buildRequest);

function requestFor(applicationId: string): ApprovalRequest | null {
  return (
    STORE.find((request) => request.applicationId === applicationId) ?? null
  );
}

/* ── Authorization mirrors ───────────────────────────────────────────────── */

/**
 * Roles that may start an approval chain.
 *
 * The recruiter owns the application (spec Sec 2.1, one assigned recruiter per
 * application) and is the person who knows the panel has finished, so starting
 * the chain is theirs. `TA_ADMIN` is included because they administer the
 * process and have to be able to unstick it; nobody else, including the hiring
 * manager, can start a chain that names themselves as its first approver.
 */
const INITIATOR_ROLES: ReadonlySet<UserRole> = new Set<UserRole>([
  "RECRUITER",
  "TA_ADMIN",
]);

/**
 * Whether this viewer may decide the step the chain is currently blocked on.
 *
 * A chain step is a *role* slot, so holding the role is the test — there is no
 * per-person assignment to check. The one refinement worth having later is
 * scoping `DEPT_HEAD` to the requisition's own department, which needs the
 * viewer's `departmentId`; the session already carries it (BUILD_PLAN.md Sec 0)
 * but `Viewer` does not yet. Flagged rather than faked: widening `Viewer` is a
 * cross-phase change, and the server-side check is the real boundary either
 * way.
 *
 * TODO(frontend): add `departmentId`/`businessUnitId` to `Viewer` when the real
 * session lands, and require `DEPT_HEAD` to match the requisition's department.
 */
function decidableStepId(
  request: ApprovalRequest | null,
  viewer: Viewer,
): string | null {
  if (!request || request.status !== "IN_PROGRESS") return null;
  const step = request.steps.find((entry) => entry.state === "AWAITING");
  if (!step) return null;
  return step.approverRole === viewer.role ? step.id : null;
}

/* ── Reads ───────────────────────────────────────────────────────────────── */

/** The routing key the chain lookup uses, read off the application's requisition. */
export function approvalRoutingFor(
  requisitionId: string,
): ApprovalRouting | null {
  const requisition = getMockRequisition(requisitionId);
  if (!requisition) return null;
  return {
    businessUnit: requisition.businessUnit,
    department: requisition.department,
    positionLevel: requisition.positionLevel,
  };
}

/**
 * Everything the Decision tab needs for one application, filtered for one
 * viewer. Everything the browser receives passes through here first.
 */
export function getApplicationApproval(
  application: { id: string; requisitionId: string },
  viewer: Viewer,
): ApplicationApproval | null {
  const routing = approvalRoutingFor(application.requisitionId);
  if (!routing) return null;

  const request = requestFor(application.id);
  return {
    applicationId: application.id,
    routing,
    chain: matchApprovalChain(CHAIN_CONFIGS, routing),
    request,
    viewerCanInitiate: INITIATOR_ROLES.has(viewer.role),
    viewerDecidableStepId: decidableStepId(request, viewer),
  };
}

/* ── Mock writes (called only from the server actions) ───────────────────── */

export class ApprovalMockError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ApprovalMockError";
    this.code = code;
  }
}

/**
 * Starts a chain. Mirrors the two refusals the real route must make: there is
 * no chain for this routing, and a request already exists.
 */
export function startApprovalRequest(
  application: { id: string; requisitionId: string },
  viewer: Viewer,
): ApprovalRequest {
  if (!INITIATOR_ROLES.has(viewer.role)) {
    throw new ApprovalMockError(
      "FORBIDDEN",
      "Only the assigned recruiter or a TA administrator can start an approval.",
    );
  }
  if (requestFor(application.id)) {
    throw new ApprovalMockError(
      "ALREADY_EXISTS",
      "An approval request has already been started for this application.",
    );
  }

  const routing = approvalRoutingFor(application.requisitionId);
  const config = routing ? matchApprovalChain(CHAIN_CONFIGS, routing) : null;
  if (!config) {
    throw new ApprovalMockError(
      "NO_APPROVAL_CHAIN",
      "No approval chain is configured for this business unit, department and position level.",
    );
  }

  const now = new Date().toISOString();
  const request: ApprovalRequest = {
    id: `apr_local_${application.id}_${Date.now()}`,
    applicationId: application.id,
    chainConfigId: config.id,
    status: "IN_PROGRESS",
    initiatedBy: { id: viewer.id, name: viewer.name },
    initiatedAt: now,
    closedAt: null,
    version: 1,
    steps: config.steps.map((step, index) => ({
      id: `apr_local_${application.id}_s${step.order}_${index}`,
      order: step.order,
      approverRole: step.approverRole,
      note: step.note,
      state: step.order === 1 ? "AWAITING" : "NOT_REACHED",
      decision: null,
    })),
  };

  STORE = [...STORE, request];
  return request;
}

/**
 * Records one decision. Every refusal below is a state the real route has to
 * reject too — a stale version, a step that is not the current one, and a
 * caller who does not hold the step's role.
 */
export function decideApprovalStep(
  input: {
    requestId: string;
    stepId: string;
    outcome: ApprovalOutcome;
    comments: string;
    version: number;
  },
  viewer: Viewer,
): ApprovalRequest {
  const request = STORE.find((entry) => entry.id === input.requestId);
  if (!request) {
    throw new ApprovalMockError(
      "NOT_FOUND",
      "That approval request no longer exists.",
    );
  }
  if (request.version !== input.version) {
    throw new ApprovalMockError(
      "VERSION_CONFLICT",
      "Someone else recorded a decision on this approval while you had it open.",
    );
  }

  const step = request.steps.find((entry) => entry.id === input.stepId);
  if (!step || step.state !== "AWAITING") {
    throw new ApprovalMockError(
      "STEP_NOT_CURRENT",
      "That step is not the one this approval is waiting on.",
    );
  }
  if (step.approverRole !== viewer.role) {
    throw new ApprovalMockError(
      "FORBIDDEN",
      "This step is waiting on a different approver role.",
    );
  }
  if (input.outcome === "REJECTED" && input.comments.trim().length === 0) {
    throw new ApprovalMockError(
      "VALIDATION_ERROR",
      "A rejection has to say why. The reason is kept internally, never sent to the candidate.",
    );
  }

  const decision: ApprovalDecision = {
    id: `${step.id}_d_${Date.now()}`,
    outcome: input.outcome,
    decidedBy: { id: viewer.id, name: viewer.name },
    decidedByRole: viewer.role,
    comments: input.comments.trim(),
    decidedAt: new Date().toISOString(),
  };

  const next = applyDecision(request, step.id, decision);
  STORE = STORE.map((entry) => (entry.id === next.id ? next : entry));
  return next;
}
