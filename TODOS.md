# TODOs — Anwar TalentFlow

Deferred items surfaced during /plan-eng-review of the assignment spec
(2026-09-02). Each item was deliberately deferred, not forgotten — see
"Depends on" for the trigger condition that should bring it back.

## Dashboard materialized rollup tables

**What:** A scheduled background job precomputes dashboard aggregates
(open requisitions, recruiter workload, stage ageing, feedback delays,
overdue tasks) into summary tables that the Recruiter/TA-Head/Dept-Head
dashboards (Sec 8) read from, instead of running live aggregation queries.

**Why:** Live, properly indexed queries are cheap at MVP scale (a single
company's pipeline — hundreds to low thousands of open applications) and
avoid the staleness + "silent rollup job failure" risk a precompute
pipeline introduces. This becomes worth building only once real usage
shows live queries are measurably slow.

**Pros:** Faster dashboard reads at scale; decouples read latency from
write-path table size.

**Cons:** Dashboard numbers lag the job's schedule; a failed rollup job
can silently show stale data with no obvious indication; one more moving
part to operate and monitor.

**Context:** Chosen over building this from day one during the eng review
of the assignment spec — see the Performance review section ("Dashboard
queries") for the full tradeoff. Not a hypothetical: revisit as soon as
production telemetry shows dashboard query latency is a real user-facing
problem, not before.

**Depends on / blocked by:** Production usage data (query latency
measurements) showing live queries are actually slow. Until then, keep
the live-query + index approach.

## Phase 2 frontend: wire mock data to the real API

**What:** The Phase 2 frontend (Requisitions/Candidates/Candidate
Workspace) was built against typed mock data with documented swap
points (`app/(dashboard)/_mock-requisitions.ts`,
`_mock-candidates.ts`, `_mock-reference.ts`), same convention as
Phase 1's `_mock-tasks.ts`. The real API now exists and covers every
swap point (`/api/v1/requisitions`, `/api/v1/candidates`,
`/api/v1/candidates/dedup-check`, `/api/v1/applications`,
`/api/v1/documents`, `/api/v1/business-units`, `/api/v1/departments`,
`/api/v1/users`), but the page-level fetches have not been rewired
yet.

**Why deferred:** The backend and frontend agents independently
designed slightly different contract shapes for the same domain
objects — worth reconciling deliberately rather than papering over:
- `Requisition.ref` (human-readable code, e.g. `REQ-2026-114`) doesn't
  exist server-side; only the cuid does. Decide: generate one at
  create time, or drop the field and show the id.
- `positionLevel` is a closed 8-value enum client-side but a free
  `String(1..100)` in `prisma.Requisition` — the frontend's
  `lib/types/domain.ts` flags this as a routing risk (it selects the
  approval chain per BUILD_PLAN Sec 2.9).
- `Candidate.mobile` (frontend type) vs `Candidate.mobileNumber`
  (Prisma field/API) — just a rename, pick one.
- The frontend's `ApplicationSummary`/`Candidate`/`Requisition` types
  are richer/denormalized (nested `PersonRef`/`OrgUnitRef`, computed
  `applicationCount` on duplicate matches) than what the current API
  routes return (raw Prisma shapes with partial `include`s) — either
  the routes need to serialize into the richer shape, or the frontend
  components need to accept the leaner one.
- `my-tasks` reconciliation per the backend agent's report: `stage` is
  a raw enum needing a label map (one already exists,
  `STAGE_LABELS` in `lib/types/domain.ts`), and `data.tasks` is nested
  under `data` alongside `summary`.

**Context:** Not a demo blocker today — the UI renders correctly
against mock data and every underlying API route is independently
verified working via curl smoke tests. But `npm run dev` currently
shows fabricated requisitions/candidates, not real ones, until this
lands.

**Depends on / blocked by:** Nothing — ready to pick up. Do the
reconciliation decisions above first (as small BUILD_PLAN.md/domain.ts
edits), then rewire each documented swap point.

## Phase 3 frontend: wire mock data to the real API

**What:** Same situation as Phase 2, one phase later. Screening,
Interview scheduling/rescheduling, and the message-template/
communication draft-approve-send flow were built against typed mock
data (`app/(dashboard)/_mock-screening.ts`, `_mock-interviews.ts`,
`_mock-communications.ts`) with documented swap points. The real API
now exists and is verified working (including the field-allowlist
security property — `internal_notes`/`rejection_reason` cannot reach a
candidate-facing message, confirmed at the create-template layer via
the live smoke test) — the page-level fetches are not yet rewired.

**Real gaps the frontend agent flagged, worth fixing before/while
wiring:**
- `ScreeningAssessment` has no `version` column despite being editable
  — needs one for the same optimistic-locking reason every other
  mutable resource has it.
- `InterviewRescheduleHistory.reason` is nullable in Prisma but the UI
  treats it as required (an untraceable reschedule defeats the point of
  the history table) — make it non-null, or accept free rescheduling
  and drop the UI requirement.
- No `attemptCount`/max-attempts exposed on `Communication` for the
  retry-affordance UI to reason about ("3 send attempts, give up").
- `roundNumber` on Interview should be assigned server-side in a
  transaction (client-computed round numbers race under concurrent
  scheduling).
- Prisma `Role` has no `PANEL_MEMBER`-equivalent distinct from the
  existing `PANEL_MEMBER` enum value — confirm `/api/v1/users?role=`
  supports a multi-value filter for interview panel pickers, or the
  frontend's panel-member picker needs a different lookup.
- `eligibility` is a `Boolean` server-side; the frontend argues for a
  3-value enum (eligible / not eligible / eligible with reservation) —
  same class of decision as `positionLevel` in the Phase 2 backlog
  item above, worth resolving together.

**Depends on / blocked by:** Nothing — ready to pick up alongside the
Phase 2 wiring item above (same kind of work, same reason it was
deferred: two independently-built contracts need one deliberate
reconciliation pass rather than three separate hasty ones).

## Phase 4 frontend: wire mock data to the real API

**What:** Same situation as Phases 2/3. Evaluation forms, the
blind-until-submit panel-feedback gate, and the consolidated summary
were built against typed mock data (`_mock-evaluations.ts`,
`_evaluation-actions.ts`) with documented swap points. The real API
(`/api/v1/interviews/:id/evaluations`, `.../evaluation-summary`,
`/api/v1/evaluation-form-templates`, `/api/v1/reports/overdue-
feedback`) exists and is independently verified, including the
blind-until-submit query-layer rule.

**Real contract gaps to resolve during that pass:**
- Fixed already: the evaluation-summary route excluded `TECH_ADMIN`
  (confidential scores per Sec 2.5) — frontend's stricter `SUMMARY_ROLES`
  was right, backend's was loosened for now; done.
- Mixed `scoreMax` within one evaluation-form template: the backend
  takes a flat mean across all submitted scores regardless of each
  criterion's max, which is meaningless if criteria don't share a
  scale. Either constrain templates to one `scoreMax` at create time,
  or normalize scores to a percentage before averaging in
  `lib/reporting/evaluation-summary.ts`.
- `EvaluationSummary`'s API shape returns flat `panelistId`/
  `panelistName` fields; every other client type nests a `PersonRef` —
  pick one convention (a one-line `.map()` in the fetch layer is the
  cheap fix if the API stays as-is).
- The summary doesn't carry the template's `scoreMax`, so a raw average
  like "3.8" has no scale to display against — expose it or have the
  client look up the template separately.
- No `EVALUATION` document-download-authz checker registered yet
  (same class of gap Phase 3 left for `SCREENING_ASSESSMENT` — also
  still open) — evaluation-attached documents currently fail closed.

**Depends on / blocked by:** Nothing — ready to pick up alongside the
Phase 2/3 wiring items. Consider doing all three in one pass once
Phase 5+ stabilizes further, since later phases may add their own
mock-data layers on top of the same pattern.

## Phase 5 frontend: wire mock data to the real API

**What:** Same situation as Phases 2/3/4. A frontend agent was building
the approval-chain-config and decision UI concurrently against mock
data (`lib/types/approvals.ts`, `components/ui/SegmentedTrack.tsx`, plus
edits to `StagePipeline.tsx`/`StatusPill.tsx`/`tone.ts`) while this
backend pass landed. The real API now exists and is independently
verified live: `POST/GET /api/v1/approval-chain-configs`,
`POST/GET /api/v1/applications/:id/approval-request`,
`POST /api/v1/approval-requests/:id/decide` — see the Phase 5 status
section in `BUILD_PLAN.md` for the schema-shape/policy decisions
(ordered-step join table, sequential-only decisions, upfront decision
rows) and the exact smoke-test scenarios that passed.

**Likely reconciliation points, based on the pattern from Phases 2-4**
(not yet confirmed against the actual frontend contract — check
`lib/types/approvals.ts` first): whether the frontend's mock chain/step
shape matches `ApprovalChainConfig.steps` (ordered join rows keyed by
`sequence`) vs. some other ordered-list representation; whether
`positionLevel` free-string vs. enum resurfaces here too (same class of
gap flagged in the Phase 2/3 items above — `ApprovalChainConfig.
positionLevel` is a free `String` to match `Requisition.positionLevel`).

**Depends on / blocked by:** Nothing — ready to pick up alongside the
Phase 2/3/4 wiring items.

## Phase 6 frontend: wire mock data to the real API, plus 8 flagged gaps

**What:** Same situation as Phases 2-5. The Joining tab
(`app/(dashboard)/_mock-joining.ts`, `_joining-actions.ts`) was built
against typed mock data. The real API landed concurrently and every
swap point is documented against the actual routes (not guessed) —
`GET/POST /api/v1/applications/:id/joining-checklist`,
`PATCH /api/v1/joining-checklist-items/:id`,
`GET /api/v1/applications/:id/joining-readiness`.

**Eight contract gaps, numbered in `_mock-joining.ts`'s own "CONTRACT
GAPS" block — read that block directly, it's unusually specific:**
1. No `blockedReason` column — a BLOCKED item's reason and its working
   notes would collide in the single `notes` field. Recommended: add
   `blockedReason String?`, required server-side when `status =
   BLOCKED` (same rule already needed by `InterviewRescheduleHistory
   .reason` and the approval-rejection comment).
2. `dueDate` is never set by `buildDefaultChecklistItems()`, so all 13
   auto-seeded items start dateless — making "overdue" (the tab's most
   useful signal, and what Sec 8's "Joining actions" dashboard tile
   counts) vacuously zero on every fresh checklist. Fix: seed due
   dates from `Requisition.targetJoiningDate` using the offset table
   already sitting in the frontend's `STANDARD_JOINING_CHECKLIST
   .dueOffsetDays`.
3. All 13 default items default to the assigned recruiter as owner;
   6 of the PDF's own items (IT request, Workspace, ID card, Transport,
   Offer letter, Induction) actually belong to IT/Admin/HR. The
   frontend's fixture spreads them by function
   (`STANDARD_JOINING_CHECKLIST.ownerFunction`) — the backend needs an
   equivalent (a per-item default-role table, or resolve against the
   department's users).
4. Seeding only happens server-side on the stage transition INTO
   JOINING; there's a real workflow reason to also expose it as an
   idempotent standalone call (`POST .../joining-checklist/seed-
   default`) so a recruiter can start chasing the offer letter while
   the application still reads SELECTED.
5. `JoiningReadinessSummary` (server) and the frontend's own
   `JoiningReadiness` type already disagree: different field splits,
   and the server compares `overdueCount` against an instant
   (`new Date()`) while the frontend compares calendar dates — they'll
   disagree for anything due today. Reconcile to one definition.
6. No `completedById` column — "who ticked this off" is recoverable
   from `AuditLog` but not from a list query, and on a checklist shared
   across four departments that's a real disputed fact worth a column.
7. Server status is 4-valued (PENDING/IN_PROGRESS/DONE/BLOCKED); the
   frontend UI surfaces 3 and lossily maps IN_PROGRESS -> PENDING on
   write-back, silently dropping the distinction on reopen. Either drop
   IN_PROGRESS server-side or fix the mapper to preserve it.
8. No DELETE for a checklist item and no "not applicable" status — an
   inapplicable seeded item (e.g. "Transport" for a remote hire) can
   currently only be closed out by marking it DONE, which corrupts the
   completion count every readiness consumer reads.

**Depends on / blocked by:** Nothing — ready to pick up alongside the
Phase 2-5 wiring items. Gaps 1, 2, 5, and 7 are worth fixing before or
during the wiring pass rather than after, since they affect data
correctness (overdue counts, status fidelity) rather than just naming.
