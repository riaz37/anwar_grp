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
