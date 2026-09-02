# Anwar TalentFlow — Build Plan

Consolidated single source of truth for a fresh session. Read this file
first, then `DESIGN.md` (visual system) and `TODOS.md` (deferred items).
Original assignment: `Anwar TalentFlow Software Development Assignment.pdf`.

Produced across three reviews in one continuous session (2026-09-02):
`/plan-eng-review` → architecture decisions, `/plan-design-review` → UX
structural decisions, `/design-consultation` → visual design system
(now in `DESIGN.md`). This file also carries the tech-stack decision and
Phase 1 scaffolding status from the session that started implementation.

---

## 0. Tech Stack (locked)

**Node/TypeScript full-stack:**
- **Framework:** Next.js (App Router) — API routes serve as the versioned
  `/api/v1` REST API; server/client components serve as the SPA.
- **Database:** PostgreSQL via Prisma ORM (schema + migrations).
- **Background jobs:** BullMQ + Redis — powers the communication pipeline
  (async send/retry/webhook status) and the reminder/task engine (same
  infra, per Technical Design 2.7).
- **Auth:** Credentials-based (email + password, bcrypt-hashed) via
  NextAuth or a hand-rolled session layer — session carries `role`,
  `departmentId`, `businessUnitId`. SSO integration is a later swap, not
  a Phase 1 blocker (see Product Interpretation assumption 5).
- **Document storage:** S3-compatible object storage (MinIO locally,
  real S3/equivalent in prod) via `@aws-sdk/client-s3` +
  `s3-request-presigner` — presigned URLs only, never public buckets or
  DB blobs.
- **Rationale:** one language end-to-end, fastest to scaffold, and Next.js
  route handlers map directly onto the "versioned REST API" requirement
  from the Technical Design without a second framework.

**Reason for this stack:** chosen over Python/FastAPI to avoid a second
language boundary (frontend JS + backend Python) — see chat history for
the full tradeoff if this needs revisiting.

## 0.1 Repo status (as of 2026-09-02)

- `git init` done, on `main`, **no commits yet**.
- No application code scaffolded yet — this file was written specifically
  so a fresh session can pick up the actual `create-next-app` /
  `prisma init` / auth-wiring work described in Phase 1 below without
  re-deriving any of the decisions above.

---

## 1. Product Interpretation

### Understanding of the problem
Anwar Group's recruitment runs across ERF/RRF documents, Excel, email,
WhatsApp, phone calls, paper assessments, and manual follow-ups. The pain
isn't "no software" — it's that no single place answers "who owns this
candidate right now, and what's the next thing that needs to happen."
TalentFlow's job is to be that coordination layer: one recruiter, one
current stage, one next action/owner/due-date per active application,
visible to whoever's role needs to see it — without trying to replace
ERF/RRF approval, payroll, or full onboarding.

### Proposed MVP
Accepted the spec's own Sec 4 scope as the review baseline (see
`/plan-eng-review` Step 0 — the client already did real scope-cutting; a
graded assignment evaluated on "did you understand the ask" penalizes
unilateral further cuts more than it rewards them). MVP =
Requisition → Candidate → Screening → Interview → Feedback → Approval →
Decision → Joining, plus role-based dashboards, message approval, and
audit history, exactly as scoped in Sec 4/5.

### Key assumptions
1. Single company/tenant — no multi-tenant isolation needed.
2. Volume is "one company's recruiting pipeline" — hundreds to low
   thousands of open applications, not millions. This assumption directly
   drove the dashboard-performance decision below (live query over
   precomputed rollups).
3. WhatsApp sends go through the WhatsApp Business API, which requires
   Meta-approved message templates for business-initiated conversations.
   This is a real external constraint the spec doesn't mention — it's why
   the message-template design below treats templates as pre-approved,
   versioned objects rather than free-text the recruiter composes live.
4. "Authorized audit users" (Sec 3) means read-only access to audit
   history and reports, not a separate compliance workflow.
5. Recruiters and hiring managers are internal employees with existing
   corporate email/SSO — auth integrates with that rather than building
   a standalone identity store from scratch (assumption to confirm with
   Anwar Group; MVP still works with local accounts if SSO isn't ready —
   this is why Phase 1 below starts with credentials-based auth).

### Features intentionally excluded
Per spec Sec 4: salary/negotiation, payroll integration, full onboarding,
candidate self-service portal, automatic hiring decisions, automatic
rejection, unapproved automatic messaging, advanced psychometric testing,
background-verification integrations.

Additionally excluded per `/plan-eng-review` Step 0 decisions:
- Fuzzy/dedup candidate matching + merge UI — exact match only for now.
- Generalized conditional approval workflow engine — data-driven table
  instead.
- Precomputed dashboard rollup tables — live indexed queries first
  (tracked in `TODOS.md`, revisit if measured slow).

### Recommended improvements (not committed — flag for discussion)
- Calendar-integration two-way sync — recommend read-only pull of
  panelist availability for MVP, not full two-way sync.
- A lightweight "recruiter inbox" view surfacing only candidates needing
  action today (nearly free given the data model, high perceived value —
  this became the "Home = My Tasks" decision in the design review).

---

## 2. Technical Design

### 2.1 Architecture overview

```
                        ┌─────────────────────────────┐
                        │      Web Client (SPA)        │
                        │  role-based navigation (Sec 7)│
                        └───────────────┬───────────────┘
                                        │ HTTPS
                        ┌───────────────▼───────────────┐
                        │     API Gateway / Versioned    │
                        │         REST API (/v1)         │
                        │  server-side authz on every    │
                        │  route (role + break-glass)    │
                        └───────────────┬───────────────┘
         ┌──────────────┬───────────────┼───────────────┬──────────────┐
         ▼              ▼               ▼               ▼              ▼
   ┌───────────┐  ┌───────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐
   │Requisition│  │ Candidate │  │ Interview/ │  │ Approval   │  │Reporting │
   │  module   │  │  module   │  │ Evaluation │  │  module    │  │  module  │
   └─────┬─────┘  └─────┬─────┘  └─────┬──────┘  └─────┬──────┘  └────┬─────┘
         │              │              │               │              │
         └──────────────┴──────┬───────┴───────────────┴──────────────┘
                                ▼
                     ┌─────────────────────┐
                     │  Relational Database │
                     │  (single schema,     │
                     │   modules = tables + │
                     │   service boundaries,│
                     │   not separate DBs)  │
                     └──────────┬───────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
      ┌───────────────┐ ┌──────────────┐ ┌─────────────────┐
      │ Communication │ │ Task/Reminder│ │  Audit Service   │
      │   Service      │ │   Engine     │ │ (append-only)    │
      │ (async worker) │ │ (scheduler)  │ └─────────────────┘
      └───────┬────────┘ └──────────────┘
              ▼
      ┌───────────────────────┐
      │ Email / WhatsApp /    │
      │ Calendar providers    │
      │ (webhooks for status) │
      └───────────────────────┘
```

Modular monolith (Sec 9), not microservices: one deployable, module
boundaries enforced at the code level (separate packages/namespaces per
module, no cross-module direct table access — go through the module's
own service layer). This is the "boring by default" choice — the spec
explicitly asks for modules that "may later be extracted if required,"
which a modular monolith gives you without paying the operational cost
of distributed systems before there's a proven need to scale a module
independently.

### 2.2 Module structure
```
/modules
  /requisitions      — CRUD, status workflow, ERF/RRF attachment
  /candidates        — profile CRUD, application linkage, dedup check
  /screening          — eligibility, assessment recording
  /interviews         — scheduling, panel assignment, rescheduling
  /evaluations        — evaluation forms, blind-until-submit scoring
  /approvals          — approval-chain config + request/decision tracking
  /communications      — templates, send pipeline, delivery status
  /joining             — checklist items, readiness aggregation
  /reporting           — dashboard queries (reads across modules)
  /audit               — append-only event log, shared by every module
  /auth                — users, roles, sessions, break-glass grants
  /documents           — upload, storage, encryption, presigned access
```
Cross-module reads happen through each module's public service interface
only — `reporting` is the one deliberate exception (it reads across
module tables directly for aggregation, since that's its whole job) but
never writes to another module's tables.

### 2.3 Data model

```
BusinessUnit ──┬── Department ──┬── Requisition ──┬── Application ──┬── StageHistory (append-only)
               │                │   (approval_status,│  (current_stage,│
               │                │    erf_rrf_doc)    │   next_action,  │
               │                │                    │   owner, due,   │
               │                │                    │   version#)     │
               │                │                    │        │
               │                │                    │        ├── ScreeningAssessment
               │                │                    │        ├── Interview ──┬── Evaluation (per panelist,
               │                │                    │        │   (panel_ids, │   locked until own submit)
               │                │                    │        │    eval_form) │
               │                │                    │        ├── ApprovalRequest → ApprovalChainConfig
               │                │                    │        │   (BU × Dept × Level → approver roles)
               │                │                    │        ├── Communication → MessageTemplate
               │                │                    │        │   (allowed_fields allowlist per event)
               │                │                    │        └── JoiningChecklistItem (owner, due, status)
               │                │                    │
               │                │                    └── Candidate (profile, separate from Application —
               │                │                                   one candidate, many applications)
               │                │
               │                └── User (role, department_id) ──── ConfidentialDataGrant (break-glass, expires_at)
               │
Document (owner_type/owner_id, encrypted, storage_key) ── attached to CV, ERF/RRF, evaluation docs, joining evidence
AuditLog (actor, action, entity_type/id, metadata, created_at) ── append-only, written by every module
```

Key invariants encoded in the schema, not just app logic:
- `Application.assigned_recruiter_id` NOT NULL — "every application has
  one assigned recruiter" (Sec 2.1) is a DB constraint, not a UI rule.
- `Application.version` (optimistic lock) — every write must supply the
  version it read; a mismatch is rejected (closes the concurrent-write
  gap flagged in `/plan-eng-review`'s Test section).
- `StageHistory` and `AuditLog` are insert-only — no UPDATE/DELETE grant
  at the DB role level, enforcing "permanent history record" (Sec 5) at
  the data layer, not just by convention.
- `Evaluation` visibility: query layer filters `WHERE panelist_id =
  :current_user OR :current_user_has_submitted_own = true` — panel
  members literally cannot fetch another's evaluation row via the API
  until their own `submitted_at` is set (Sec 6).
- `Candidate` and `Application` are separate tables — one candidate row,
  many application rows — per Sec 6's explicit instruction.

### 2.4 API approach
REST, versioned at the path (`/api/v1/...`), resource-oriented
(`/requisitions`, `/candidates`, `/candidates/{id}/applications`,
`/applications/{id}/stage-history`, `/interviews/{id}/evaluations`).
Consistent envelope: `{ success, data, error, meta }` (meta carries
pagination for list endpoints). Every mutating endpoint requires the
resource's current `version` field (optimistic locking) and returns 409
on mismatch so the client can reload and retry. `error` is
`{ code, message }` (not a bare string) — locked during Phase 1
implementation, see `lib/api-response.ts`.

### 2.5 Authentication and authorization design
- Server-side authorization on every route — the client's role-based
  navigation is a UX convenience, never the security boundary.
- Role-based access control: role → allowed actions + visible fields,
  enforced in the API layer per request.
- **Confidential data**: two complementary layers (chosen deliberately —
  break-glass was primary; field-level encryption was pulled forward
  from a deferred TODO into MVP scope for defense in depth):
  1. Break-glass elevation — confidential fields (CV contents, scores,
     personal contact info) hidden by default even from Technical
     Administrators; explicit elevation grant (reason + expiry) required,
     every grant + access under it written to `AuditLog`.
  2. Field-level encryption — same confidential columns encrypted at the
     app layer with keys the DB/infra role never holds, so a compromised
     backup/read-replica doesn't expose them either. Break-glass gates
     *live application access*; encryption protects *data at rest
     outside the running app* — genuinely different threats.
- Optimistic locking: every `Application` write includes the `version`
  it read; a stale version gets a 409, never a silent overwrite.
- Session controls, TLS in transit — standard.

### 2.6 Document storage design
S3-compatible object storage, server-side encryption at rest, access via
short-lived presigned URLs (never a public bucket, never a DB blob).
`Document` rows carry `storage_key` + `owner_type/owner_id`, never the
file itself. Upload validates file type/size before issuing a presigned
PUT; download checks the requester's authorization for the owning entity
before issuing a presigned GET — document access inherits the same
break-glass/RBAC rules as the record it belongs to.

### 2.7 Reminder and background-job approach
One job-queue + worker infrastructure (BullMQ + Redis) handles: scheduled
reminders (interview reminders, feedback overdue, joining-task due), the
async communication pipeline (2.8), and any future scheduled aggregation.
A scheduler enqueues reminder-check jobs on an interval; a worker pool
processes the queue.

### 2.8 Communication pipeline (locked decision)

```
Recruiter drafts message
        │
        ▼
  MessageTemplate (versioned, field-allowlisted — internal_notes and
  rejection_reason are structurally NOT in the allowlist)
        │
        ▼
  Status: Drafted ──► Awaiting Approval ──► Approved
                                                │
                                                ▼
                                    enqueue send job (async, BullMQ)
                                                │
                                                ▼
                                    Worker calls Email/WhatsApp provider
                                                │
                                    ┌───────────┴───────────┐
                                    ▼                       ▼
                            Status: Sent            Provider error
                                    │                       │
                                    ▼                       ▼
                        Provider webhook/poll        Status: Failed
                        confirms delivery                  │
                                    │                       ▼
                                    ▼                retry (bounded) or
                        Status: Delivered            surface to recruiter
```
Chosen over synchronous send-on-approve because "Delivered" is a real
state Sec 6 requires, and that state can only ever come from a provider
webhook/delivery receipt.

### 2.9 Approval-chain configuration design
`ApprovalChainConfig` maps `(business_unit_id, department_id,
position_level)` → an ordered list of approver roles. Adding/changing a
chain is a data change, not a deploy — satisfies Sec 6 without a
general-purpose rules engine (deferred to `TODOS.md` only if proven
insufficient in practice).

### 2.10 Integration approach
- **Email**: transactional email provider (SMTP API), server-side
  rendered templates.
- **WhatsApp**: WhatsApp Business API — business-initiated messages
  require Meta-approved templates, which is why `MessageTemplate` is a
  first-class, pre-approved, versioned entity.
- **Calendar**: read-only pull of panelist availability for MVP; two-way
  sync deferred.

### 2.11 Deployment recommendation
Single deployable modular monolith + worker process(es) + relational
database + object storage, containerized, behind a load balancer, API
stateless (sessions in DB/cache) for horizontal scaling. Workers run as a
separate process from the API so a slow provider can't degrade API
response times. Staging uses synthetic seed data, never a copy of
production candidate data.

### 2.12 Security considerations summary
Role-based access + least privilege, server-side authz on every route,
break-glass + field-level encryption for confidential data, TLS in
transit, encryption at rest, session controls, append-only audit log,
restricted bulk downloads (rate-limited/logged), field-level visibility
per role, data-retention/candidate deletion-anonymization as explicit
operations, production data never replicated into test environments.

---

## 3. Implementation Plan

### 3.1 Development sequence
1. **Foundations** — auth/RBAC, User/Role/Department/BusinessUnit
   tables, audit log write-path, API scaffolding + versioning, document
   storage (presigned URL flow). **← currently starting here.**
2. **Requisition → Candidate** (Scenario 1) — requisition CRUD +
   approval status, candidate profile + application linkage, dedup
   check, recruiter dashboard v1.
3. **Screening + Interview Scheduling** (Scenario 2) — screening record,
   interview scheduling, message-template + approval flow, async
   communication pipeline + worker + provider integration stub.
4. **Interview Evaluation + Feedback** (Scenario 3) — evaluation forms,
   blind-until-submit visibility rule, reminder engine, consolidated
   results view.
5. **Approval + Decision** (Scenario 4) — approval-chain config,
   approval request tracking, selection/rejection + candidate comms.
6. **Joining Coordination** (Scenario 5) — checklist items, readiness
   aggregation.
7. **Management Dashboards** (Scenario 6) — TA-Head and Dept-Head
   dashboards, live aggregation queries.
8. **Hardening** — break-glass confidential-access flow, field-level
   encryption, optimistic-locking conflict UX, audit history views for
   authorized audit users, security pass against Sec 10 checklist, and
   the deferred compact-density dashboard toggle if warranted.

### 3.2 Key dependencies
- Auth/RBAC must land before any role-scoped dashboard or field
  visibility can be tested meaningfully.
- The communication pipeline blocks every scenario after #2 requiring
  candidate messaging.
- Approval-chain config blocks the Decision flow (#5) and the
  requisition approval status itself (#2).
- Audit log write-path is a foundation-phase dependency for every later
  module.

### 3.3 Technical risks
- **WhatsApp Business API template approval turnaround** — submit
  templates for approval as early as possible in Phase 3; have an
  email-only fallback demoable if approval is delayed.
- **Optimistic-locking UX** — the 409 conflict needs the inline-banner
  treatment (locked in design review), not a generic error.
- **Break-glass + encryption interaction** — key-management design needs
  to support "decrypt for this user, for this time window" cleanly.

### 3.4 Adoption risks
- Recruiters live in WhatsApp/Excel; the message-approval flow needs to
  feel faster than typing WhatsApp directly, or they'll route around it.
- Dashboard-driven visibility for management is a process/accountability
  change, not just a UI change — may need change-management alongside
  rollout.

---

## 4. AI Tool Disclosure

- **Which tools**: Claude Code (Sonnet 5), via the gstack
  `/plan-eng-review`, `/plan-design-review`, and `/design-consultation`
  skills.
- **How used**: The assignment PDF was read and treated as the plan
  input. Claude ran structured, section-by-section reviews (architecture,
  code quality, tests, performance for engineering; information
  architecture, states, journey, slop-risk, design-system alignment,
  responsive/a11y, unresolved decisions for design), surfacing each real
  decision point individually with concrete options, tradeoffs, and
  effort estimates.
- **Which decisions were made by the human**: Every architectural and
  design decision in this document was an explicit human choice among
  presented options — Claude did not auto-select any option. The human
  also decided which candidate TODOs to defer vs. build now (e.g. pulling
  field-level encryption forward into MVP scope) and which to drop
  entirely (fuzzy dedup, generalized workflow engine), and chose the
  tech stack (Node/TypeScript over Python) from presented options.
- **How outputs were reviewed**: Each recommendation was reviewed against
  the spec's explicit requirements (quoted section references throughout)
  before acceptance. This document is the reviewed, human-approved output
  of that process, not a raw model draft.

---

## 5. UX / Design Decisions

See `DESIGN.md` for the full visual design system (typography, color,
spacing, layout, motion — Industrial/Utilitarian aesthetic, warm
ochre/brass accent, General Sans + Instrument Sans + Geist). Structural
UX decisions locked during `/plan-design-review`:

| # | Area | Decision |
|---|------|----------|
| 1 | Mockup timing | Deferred pixel mockups until `/design-consultation` established the design system |
| 2 | Home landing view | Task-first: Home = My Tasks (overdue/due-today items) |
| 3 | Emotional register | Calm, utilitarian ops tool (APP UI classification) |
| 4 | Concurrency-conflict UX | Inline banner on the record, non-blocking |
| 5 | Mobile nav (9 items) | Bottom bar (Home/My Tasks/Candidates) + slide-out drawer for the rest |
| 6 | Multi-application candidates | Candidate Workspace = shared profile + per-application tab strip |
| 7 | Outside design voices | Skipped both times — no git repo existed yet to scope Codex against |

Information architecture, interaction-state table, journey storyboard,
and responsive/a11y specifics are in the original review output (this
file's Sec 2 + `DESIGN.md` carry the parts that survive into code).

---

## NOT in scope
- Everything in spec Sec 4's exclusion list (salary, payroll, full
  onboarding, self-service portal, auto-decisions, auto-rejection,
  unapproved auto-messaging, psychometric testing, background checks).
- Fuzzy/dedup candidate matching + merge UI.
- Generalized conditional approval workflow engine.
- Precomputed dashboard rollup tables (see `TODOS.md`).
- Pixel-level mockups (AI mockup generation needs an OpenAI API key not
  configured in this environment — `$D setup` or `~/.gstack/openai.json`
  — revisit if visual mockups are wanted later).
- Compact-density dashboard toggle (see `TODOS.md`).

## What already exists
Nothing — greenfield. `git init` done, no application code yet.

## TODOS.md
See `TODOS.md` in this directory — currently one item (dashboard
materialized rollups, gated on measured live-query slowness).

---

## Next step for a fresh session

Start Phase 1 (Foundations) exactly as scoped in Sec 3.1 above:
1. `npx create-next-app@latest` (TypeScript, App Router, Tailwind, no
   src/ dir override needed — follow the module structure in Sec 2.2).
2. `npx prisma init` — schema models for `BusinessUnit`, `Department`,
   `User` (+ `Role` enum matching Sec 3 of the original spec),
   `AuditLog`, `Document`, `ConfidentialDataGrant`. Do NOT model the full
   recruitment schema (Requisition/Candidate/Application/etc.) yet —
   those land in their respective later phases per Sec 3.1, added
   incrementally rather than all at once.
3. Auth: credentials-based (bcrypt), session carries `role`,
   `departmentId`, `businessUnitId`.
4. `lib/audit.ts` — `writeAudit()` helper, insert-only.
5. `lib/documents.ts` — presigned PUT/GET via `@aws-sdk/client-s3` +
   `s3-request-presigner`, MinIO locally.
6. Seed script: roles, one BusinessUnit/Department, one admin user.
7. `lib/authz.ts` — `requireRole()` server-side check helper used by
   every `/api/v1/*` route handler.

Do not scaffold Phase 2+ modules until Phase 1 is working end-to-end
(a fresh session should verify Foundations before moving on, per the
dependency table in Sec 3.2).

---

## Phase 1 status: complete (2026-09-02)

Built by a parallel backend + frontend agent pair, wired together and
verified end-to-end (typecheck, `npm run build`, live login → session
→ role-gated dashboard → logout against the running dev server).

**Implementation notes not otherwise captured above:**
- Session cookie: `tf_session`, httpOnly, `sameSite=lax`, `secure`
  outside `NODE_ENV=development`, 7-day TTL, DB-backed token (not a
  JWT) — `lib/session.ts`.
- Document download authz is a pluggable hook
  (`registerDocumentDownloadAuthzChecker` in `lib/documents.ts`),
  fail-closed by default. **No `DocumentOwnerType` has a checker
  registered yet** — every later module (Candidates, Requisitions,
  Evaluations, Joining) must register one for its owner type before
  its documents become downloadable. Track this per-module, not as one
  follow-up.
- Local dev seed admin: `ta.admin@anwargroup.test` /
  `TalentFlow!2026` (`npm run db:seed`) — TA_ADMIN role, seeded under
  "Anwar Group Corporate" / "Talent Acquisition".
- MinIO bucket `talentflow-documents` is not auto-provisioned by
  anything in the app yet — created manually for local dev. A setup
  script or compose init step should do this before onboarding another
  developer.
- Local port notes: native Postgres already runs on 5432 and native
  Redis on 6379 on this machine, so `docker-compose.yml` maps the
  Postgres container to host port **5433** and reuses the native Redis
  instance directly — `.env`/`.env.example` reflect this. MinIO is
  unaffected (9000/9001).

Next: Phase 2 (Requisition → Candidate, Sec 3.1 item 2).

---

## Phase 2 status: backend + frontend complete, wiring pending (2026-09-02)

Built the same way as Phase 1: a parallel backend + frontend agent
pair. Backend added `Requisition`, `Candidate`, `Application`,
`StageHistory` models + full CRUD/transition APIs, exact-match
duplicate-candidate detection (`lib/candidate-dedup.ts`), the pipeline
transition graph (`lib/application-stages.ts`), and the live
recruiter-dashboard query (`lib/reporting/recruiter-dashboard.ts`) —
independently verified via curl smoke tests (create → approve →
duplicate-warning → stage transition → 409 conflict → my-tasks
report). Frontend built the Requisitions list/detail/create,
Candidates list + Candidate Workspace (shared profile + per-application
tab strip per Sec 5 decision #6), the stage pipeline visualization, the
inline duplicate-warning banner, and the inline optimistic-locking
conflict banner (Sec 5 decision #4) — against typed mock data with
documented swap points, same convention as Phase 1's `_mock-tasks.ts`.

Closed the two gaps the agents flagged as hard blockers directly:
`GET /api/v1/candidates/dedup-check`, `POST /api/v1/documents` (the
missing write after presign+PUT), and reference-lookup routes
(`/api/v1/business-units`, `/api/v1/departments`, `/api/v1/users`).
Added `Requisition.notes` and `CandidateSource.RECRUITMENT_EVENT` to
the schema per the frontend's reconciliation notes.

**Remaining before this phase is fully "done":** rewiring the
frontend's mock-data swap points to the now-complete API — tracked as
its own item in `TODOS.md` ("Phase 2 frontend: wire mock data to the
real API") rather than done ad hoc, because the two agents' contract
shapes have real differences (ref codes, positionLevel enum vs string,
field naming) worth reconciling deliberately.

Next: Phase 3 (Screening + Interview Scheduling, Sec 3.1 item 3).

---

## Phase 3 status: backend + frontend complete, wiring pending (2026-09-02)

Same parallel backend + frontend agent pair pattern. Backend added
`ScreeningAssessment`, `Interview`/`InterviewPanelist`/
`InterviewRescheduleHistory`, `MessageTemplate`, `Communication`
models, the field-allowlist enforcement (`lib/message-templates.ts` —
`internal_notes`/`rejection_reason` are structurally absent from the
safe-field registry, not just filtered), and the BullMQ communication-
send pipeline (`lib/queue.ts`, `lib/communication-worker.ts`, stub
Email/WhatsApp providers) bootstrapped in-process via
`instrumentation.ts` (documented as a demo-pragmatic choice; Sec 2.11
calls for a standalone worker process in production). Frontend added a
second-level tab strip (Pipeline · Screening · Interviews · Messages)
inside the existing per-application view, the reschedule-history
timeline, and a two-step confirm-gated message-approval interaction —
against typed mock data with documented swap points.

Independently verified live: the full Drafted → Awaiting Approval →
Approved → (worker) → Sent → Delivered pipeline actually runs end-to-
end against Redis/Postgres, and the field-allowlist security property
holds — a template created with `internal_notes` in its `allowedFields`
had that field silently dropped at creation (`meta.droppedFields`), and
the rendered message body confirmed it never appears. Fixed one real
bug surfaced during verification: `handleRouteError` (`lib/api-
response.ts`) returned a raw 500 for a missing/malformed JSON body
instead of a clean 400 — now maps `SyntaxError` to `VALIDATION_ERROR`
like a Zod failure, across every route that uses it.

Frontend mock-to-real wiring tracked in `TODOS.md` ("Phase 3 frontend:
wire mock data to the real API"), same reasoning as Phase 2 — plus a
short list of small schema/API gaps the frontend agent surfaced
(`ScreeningAssessment.version`, non-null reschedule reason, retry-
attempt count, eligibility as an enum) worth resolving during that
pass rather than now.

Next: Phase 4 (Interview Evaluation + Feedback, Sec 3.1 item 4).

---

## Phase 4 status: backend + frontend complete, wiring pending (2026-09-02)

Same pattern. Backend added `EvaluationFormTemplate`/`Evaluation`
models, the blind-until-submit rule as a single query-layer helper
(`lib/evaluation-visibility.ts` — a WHERE clause, not a post-fetch
filter), a summary-only consolidated results view
(`lib/reporting/evaluation-summary.ts` — deliberately no decision-
derivation logic, per PDF's "must not make the final hiring
decision"), overdue-feedback reporting, and a BullMQ repeatable-job
reminder scheduler (15-minute cadence, scaffolding only — does not yet
push through the Phase 3 communication pipeline, noted as a deferred
follow-up). Frontend added a 5th application tab (Evaluations) with a
template-driven scored form, a genuinely non-leaky blind-until-submit
gate (a discriminated-union response shape with no field a peer
evaluation could occupy while blind — verified against the raw RSC
payload, not just visually), and a summary view that deliberately
avoids any "system recommends" language or styling.

This phase's agent pair was interrupted once by a session-wide rate
limit partway through and resumed cleanly from the partial state (the
schema, `lib/evaluation-forms.ts`, `lib/evaluation-visibility.ts`, and
`lib/reporting/evaluation-summary.ts` survived the interruption
untouched and were reused as-is by the resumed agent).

One access-control fix made after both agents finished: the backend's
`evaluation-summary` route originally allowed `TECH_ADMIN`; narrowed
to exclude it per Sec 2.5 (evaluation scores are a confidential field
that should stay hidden from Technical Administrators without an
explicit break-glass grant, which doesn't exist until Phase 8) — the
frontend agent's independently-chosen UI-side role list had already
gotten this right and flagged the mismatch.

Frontend mock-to-real wiring and a small set of contract gaps (mixed
`scoreMax` averaging, `EvaluationSummary`'s flat vs. nested person
fields, missing `EVALUATION` document-authz checker) tracked in
`TODOS.md` alongside the Phase 2/3 items.

Next: Phase 5 (Approval + Decision, Sec 3.1 item 5).

---

## Phase 5 status: backend + frontend complete, wiring pending (2026-09-02)

Backend added `ApprovalChainConfig`/`ApprovalChainStep`/`ApprovalRequest`/
`ApprovalDecision` models and `lib/approval-chain.ts` (mirroring
`lib/requisition-status.ts`'s "one file owns the transition graph"
style). This is the candidate/application SELECTION-decision approval
chain — a deliberately separate flow from `Requisition.approvalStatus`
(Phase 2's requisition approval, already built).

**Schema-shape decision (ordered approver list):** a relational
`ApprovalChainStep` join table with a `sequence` int column, not a JSON
array on `ApprovalChainConfig`. Chosen because `recordDecision()` needs
to look up "the step at index N" directly and queryably (each
`ApprovalDecision` snapshots `approverRole` from the corresponding step),
which a JSON blob would only support after deserializing — the extra
join is cheap given chain resolution happens once per application
reaching APPROVAL, not on any hot path.

**Uniqueness note:** "only one active chain per (businessUnitId,
departmentId, positionLevel)" is enforced in application logic
(`approval-chain-configs` POST route deactivates any prior active row
for the same triple inside the same transaction that creates the new
one), not a DB-level unique constraint — a literal unique on
`(..., isActive)` would also cap historical/inactive rows for a triple
at one, defeating history across chain revisions. Prisma doesn't support
partial (`WHERE isActive`) unique indexes without a raw-SQL migration
extension; revisit if this proves insufficient.

**Out-of-order-decision policy:** sequential only. `recordDecision()`
requires the decided `stepIndex` to match `ApprovalRequest.currentStepIndex`
exactly (409 `NOT_CURRENT_STEP` otherwise) — the safer default matching
Sec 2.9's "ordered list of approver roles"; nothing in the PDF calls for
parallel/out-of-order approval.

**ApprovalDecision rows are created UPFRONT** (all steps at once, at
`initiateApprovalRequest()` time), not lazily as each step is reached —
per the PDF's "Decisions and Approvals" visibility language, "step 3 of
5, waiting on Dept Head" must be directly queryable the instant a
request is initiated, mirroring the blind-until-submit `Evaluation`
row's "one query-layer rule" philosophy from Phase 4.

A single rejection at any step immediately marks the whole
`ApprovalRequest` REJECTED — later steps' `ApprovalDecision` rows stay
PENDING (informative: "never reached"), never auto-continuing past a
rejection.

API routes: `approval-chain-configs` (GET list/filter, POST — TA_ADMIN/
TECH_ADMIN only), `applications/:id/approval-request` (POST initiate —
TA_ADMIN/RECRUITER, returns 400 `NO_CHAIN_CONFIGURED` — not a 500 — when
no chain resolves for the application's business unit/department/
position level; GET — fetches the latest request + all decision rows in
one call), `approval-requests/:id/decide` (POST — gated only by
`requireAuth()` at the route level, since the required role differs per
step; `recordDecision()` itself checks the caller's role against that
step's snapshotted `approverRole` and returns 403 `WRONG_ROLE` on
mismatch).

Confirmed unchanged: Phase 3's `POST /api/v1/applications/:id/communications`
already works for `SELECTION`/`REJECTION` categories with no code
changes needed — `MessageTemplateCategory` already had both values from
Phase 3, and the route is generic over category. Also confirmed
`lib/application-stages.ts` already allows `APPROVAL -> SELECTED` and
`APPROVAL -> REJECTED` (via its `ALWAYS_REACHABLE_OUTCOMES` list) — no
change needed there either, so the `PATCH /applications/:id/stage` route
was reused as-is per the task's "do not duplicate that logic" constraint.

Verified live end-to-end on port 3108 against a throwaway DEPT_HEAD test
user + a 2-step (DEPT_HEAD -> TA_ADMIN) chain: decision rows exist for
every step immediately after initiation; a wrong-role decide attempt at
step 0 was rejected (403 `WRONG_ROLE`); the correct role's approval
advanced `currentStepIndex`; a rejection at step 1 on a second scenario
immediately flipped the whole request to REJECTED without touching later
steps; a second, independent approval request where every step approved
reached `APPROVED`; a further decide attempt on a closed request
correctly returned 400 `REQUEST_CLOSED`; the SELECTED stage transition
and a SELECTION-category communication draft both worked unchanged. All
test rows (application, candidate, requisition, chain config/steps,
approval requests/decisions, communication, message template, throwaway
user) were cleaned up afterward.

`npx tsc --noEmit` and `npm run build` both pass clean. Frontend's
approval-chain/decision UI was being built concurrently against mock
data by a separate agent (see `app/(dashboard)/_mock-evaluations.ts`,
`app/(dashboard)/_mock-reference.ts`, `components/ui/SegmentedTrack.tsx`,
`lib/types/approvals.ts`, and edits to `StagePipeline.tsx`/
`StatusPill.tsx`/`tone.ts` — none of these were touched by this backend
pass); wiring that frontend to these real routes is tracked in
`TODOS.md` alongside the Phase 2/3/4 wiring items.

Frontend added a 6th application tab ("Decision") composing Phase 3's
screening summary and Phase 4's `EvaluationSummaryPanel`/panel-feedback
pieces rather than rebuilding them, plus the new approval-chain-progress
stepper and a confirm-gated approve/reject action (mirroring Phase 3's
communication-approval ceremony, with comments required on reject).
This agent run was interrupted by a stream stall mid-refactor — it had
just finished adding an `EvaluationSummaryPanel` `variant="composed"`
prop to stop the per-round intro paragraph and screening-tab pointer
from repeating on the Decision tab (which already states both once,
above the per-round list), but the `composed` variant only gated the
intro paragraph, and the Decision tab's call site never actually passed
`variant="composed"`. Both finished after the fact: the "Assessment
results" block is now also gated on `standalone`, and
`DecisionSupport.tsx` passes `variant="composed"`. Verified with a fresh
`npx tsc --noEmit` + `npm run build` (both clean) and a live page render
(200, no error digests) after the fix.

Next: Phase 6 (Joining Coordination, Sec 3.1 item 6).
