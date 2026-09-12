# Anwar AI ProjectFlow — Build Plan

Consolidated single source of truth for a fresh session. Read this file
first, then `DESIGN.md` (visual system) and `TODOS.md` (deferred items).
Assignment: `Anwar_AI_ProjectFlow_Candidate_Assignment.pdf`.

**This supersedes the prior Anwar TalentFlow build plan.** The assignment
changed mid-build (2026-09-03) — the candidate brief switched from a
recruitment ATS ("Anwar TalentFlow") to an AI/software project-governance
system ("Anwar AI ProjectFlow"). Phases 2–6 already built under the old
brief (Requisition → Candidate → Application → Screening → Interview →
Evaluation → Approval/Decision → Joining Coordination) are for the wrong
product and are being deleted. Decision (confirmed with user): **fresh
start, same repo** — reuse the infra layer, replace the domain layer.
Produced via `/plan-eng-review` in one continuous session (2026-09-03);
full review findings are in `.claude/plans/misty-inventing-cake.md`.

---

## 0. Tech Stack (locked, unchanged from TalentFlow — infra is reused)

**Node/TypeScript full-stack:**
- **Framework:** Next.js (App Router) — API routes serve as the versioned
  `/api/v1` REST API; server/client components serve as the SPA.
- **Database:** PostgreSQL via Prisma ORM (schema + migrations).
- **Background jobs:** none. The original plan carried over a
  TalentFlow-era line claiming BullMQ + Redis were "reused" for
  milestone/blocker reminders (`lib/queue.ts`, `lib/reminder-scheduler.ts`)
  — those files never existed in this rebuild; the claim was stale
  documentation, not a real dependency. See "Notification approach"
  below for the actual (deliberately non-push) design.
- **Auth:** Credentials-based (email + password, bcrypt-hashed) session
  layer — session carries `role`, `departmentId`, `businessUnitId`.
  Reused unchanged (`lib/session.ts`, `app/(auth)/*`).
- **Document storage:** S3-compatible object storage via presigned URLs
  (`lib/documents.ts`) — reused, `DocumentOwnerType` enum repointed.

## 0.1 Repo status (as of 2026-09-03)

- Phases 2–6 recruitment-domain code exists on `main` but is being
  deleted per this plan — see Section 2 "What already exists."
- Prisma migrations for the recruitment schema exist; a fresh migration
  will introduce the new domain schema (Section 3).

---

## 1. Product Interpretation

### Understanding of the problem (assignment Sec 1)
Anwar Group is building an internal AI team responsible for AI-enabled
systems, automations, analytics tools, and business applications across
departments. As the number of projects grows, management needs one
reliable way to track progress from idea to deployment — the pain isn't
"no tracking," it's that status lives in verbal updates ("development is
almost finished") instead of evidence. ProjectFlow's job is to make five
things always answerable at a glance: where a project is, who owns the
next action, what the next deliverable is, when it ships, and — if it's
late — exactly why.

### North-star question (assignment Sec 2)
*"Can management open the system and understand within a few seconds:
where every AI project is, what is late, why it is late, who needs to
act, and when it will be delivered?"*

### Design principles (assignment Sec 10, locked)
One Project Owner · One Current Stage · One Next Milestone · One Next
Action · One Expected Delivery Date.

### How this system structures AI projects (assignment Sec 12A)
As one `Project` row per initiative, carried through a fixed 10-stage
pipeline (`ProjectStage`, Sec 3), never a free-text status field. Every
project has exactly one accountable owner, one current stage the whole
org agrees on, and — while in flight — one next milestone and one next
action, per the design principles above. Stage isn't something a PM
"sets"; it only changes through `transitionProjectStage`
(`lib/project-stages.ts`), which is forward-only, one step at a time,
and blocked until the current stage's `StageGateChecklistItem`s are all
checked. That's the structural answer to "how would you structure AI
projects": make the *stage itself* the thing that's evidence-gated,
not a status label a human types over Slack.

### How this system measures real progress (assignment Sec 12A)
Two complementary numbers, both computed server-side, never hand-entered:
1. **Gate readiness** — `computeChecklistReadiness()` (`lib/checklist-
   engine.ts`) reports `checked/total` for the current stage's exit
   criteria (the exact Sec 5 checklist items). "Development is almost
   finished" becomes "2 of 3 Development exit criteria checked" —
   a verifiable claim, not a vibe.
2. **Milestone completion** — each `Milestone` is PENDING/IN_PROGRESS/
   DONE with an owner and a due date; the Milestones & Tasks tab and
   the Management Dashboard both surface this directly, so "how much of
   the plan is actually done" is a count of DONE milestones against the
   plan, not a re-ask of the project owner.
Neither number can be inflated by changing a status field without also
producing the underlying evidence (a checked box, a completed
milestone) — that's the whole point of Sec 5's "progress must be
evidence-based" requirement.

### How this system identifies delays (assignment Sec 12A)
`computeProjectHealth()` (`lib/project-health.ts`) derives health from
data, not from anyone declaring it: an unresolved `Blocker` forces
`BLOCKED` (dominates everything else — a blocker means nobody can
unilaterally fix it); otherwise an overdue non-DONE milestone forces
`DELAYED`; otherwise a milestone due within 3 days forces `AT_RISK`;
otherwise `ON_TRACK`. The moment a milestone goes overdue, the system
also requires a `DelayReason` (`milestoneRequiresDelayReason`) from the
assignment's fixed Sec 8 taxonomy before that milestone can be edited
further — so "why is it late" is captured at the moment lateness is
discovered, not reconstructed later from memory. `ScopeChange` records
are kept separately from delay reasons specifically so management can
tell "we're late because scope grew" apart from "we're late because
execution slipped" (assignment Sec 8's explicit ask).

---

## 2. What already exists (reuse plan)

| Piece | File(s) | Reuse plan |
|---|---|---|
| Auth/session | `lib/session.ts`, `app/(auth)/*`, `app/api/v1/auth/*` | Reuse unchanged |
| RBAC | `lib/authz.ts`, `Role` enum in schema | Reuse pattern; replace enum values with the 5 new roles |
| API envelope + pagination | `lib/api-response.ts`, `lib/pagination.ts` | Reuse unchanged |
| Prisma client + audit log | `lib/prisma.ts`, `lib/audit.ts`, `AuditLog` model | Reuse unchanged |
| Document upload/presign | `lib/documents.ts`, `app/api/v1/documents/*` | Reuse; update `DocumentOwnerType` enum values |
| Background jobs | `lib/queue.ts`, `lib/reminder-scheduler.ts` | Reuse for milestone/blocker escalation reminders |
| UI kit + shell | `components/ui/*`, `components/shell/*` | Reuse per `DESIGN.md` |
| Org structure | `BusinessUnit`, `Department`, `User`, `Session` models | Reuse unchanged |
| Stage-history pattern | `lib/application-stages.ts`, `StageHistory` model | **Pattern reused**, not the code — new `ProjectStageHistory` follows the same shape (from/to, actor, timestamp) |
| Checklist pattern | `lib/joining-checklist.ts`, `JoiningChecklist*` models | **Pattern generalized** into a shared checklist engine used by the new `StageGateChecklistItem` |

**Deleted** (recruitment-domain, wrong product): everything under
`modules/`, recruitment-specific `lib/*` (application-stages,
approval-chain, candidate-dedup, communications/*, evaluation-forms,
evaluation-visibility, joining-checklist, message-templates,
phase2/3/6-document-authz, phase2/3-scoping, requisition-status,
reminder-scheduler content specific to recruitment),
`components/{applications,approvals,candidates,communications,
evaluations,interviews,joining,requisitions,screening,reports}`, and the
matching `app/(dashboard)/*` and `app/api/v1/*` routes.

---

## 3. Architecture decisions (locked via `/plan-eng-review`)

1. **Stage model** — `Project.currentStage` enum (10 values) +
   `ProjectStageHistory` transition log (from/to, actor, timestamp,
   evidence snapshot) + `StageGateChecklistItem` seeded per stage with the
   assignment's exact exit criteria (Sec 5). The transition API blocks
   advancing unless all required items for the *current* stage are
   checked — this is what makes "one current stage" trustworthy instead
   of a status a PM can just flip.

2. **Health status** — computed server-side, not manually set:
   - `ON_TRACK` — default, no active blocker, no overdue milestone
   - `AT_RISK` — a milestone due within N days (default 3)
   - `DELAYED` — a milestone is overdue
   - `BLOCKED` — an active, unresolved `Blocker` exists
   Crossing into `DELAYED` **forces** capture of a delay reason from the
   assignment's fixed taxonomy (Sec 8: Requirements not finalized /
   Resource unavailable / Waiting for business feedback / Scope change /
   Data unavailable / Testing issue / Development issue / Approval
   pending / Integration dependency / Other), linked to the specific
   milestone.

3. **RBAC** — reuse `lib/authz.ts`'s role-check pattern. New `Role` enum:
   `AI_ANALYST | DEVELOPER | BUSINESS_OWNER | AI_TEAM_LEAD | MANAGEMENT`
   (assignment Sec 9). Permission matrix: create project, edit
   requirements, approve design, transition stage, resolve blocker, view
   management dashboard. No new auth infrastructure.

4. **Checklist engine** — generalize `lib/joining-checklist.ts`'s "seed
   template → toggle item → compute readiness %" logic into
   `lib/checklist-engine.ts`, used by `StageGateChecklistItem`. Avoids a
   copy-pasted one-off implementation.

5. **Dashboard performance** — live indexed queries (`currentStage`,
   `health`, `dueDate`, `assigneeId` indexes on `Project`/`Milestone`/
   `Blocker`) — same call already made in this repo for the old
   TalentFlow dashboards (see `TODOS.md`: "Dashboard materialized rollup
   tables"). No materialized rollups until production usage proves live
   queries too slow.

6. **Testing** — no test framework existed anywhere in this repo (0 test
   files across Phases 2–6). Adding **Vitest** as part of this rebuild's
   foundation. Priority: stage-gate transition logic, health computation,
   delay-reason enforcement, RBAC checks, then integration tests for the
   core API sequence. Full UI coverage is a known, flagged gap.

7. **Notification approach (assignment Sec 12C)** — deliberately
   **pull, not push**, for this version. Nothing emails/Slacks/texts
   anyone. Instead:
   - **Home** (`/`) is a role-scoped landing page: everyone sees their
     own open tasks/milestones count on login; AI_TEAM_LEAD/MANAGEMENT
     additionally see a condensed "needs attention" summary.
   - **My Work** (`/my-work`) is the personal queue — every project,
     task, and milestone assigned to *you*, with overdue/at-risk flagged.
   - **Management Dashboard** (`/dashboard`) puts "needs attention"
     (blocked/delayed projects, and *why*) at the top, above the
     aggregate counts — directly answering the assignment's "which
     projects require my attention today, and why" test (Sec 7).
   - Every state change that matters is durable and queryable:
     `ProjectStageHistory`, `DelayReason`, and `Blocker` rows are never
     deleted, so "what changed and when" is always answerable by
     opening the project, not by searching an inbox for a notification
     that may have been missed.
   Why not push notifications: the assignment explicitly warns against
   building "another generic task-management system," and email/Slack/
   push infrastructure is exactly the kind of generic plumbing that
   doesn't differentiate a *governance* tool from a *task* tool — it
   also has real failure modes (missed emails, notification fatigue)
   that a "management opens one page and sees the truth" design
   sidesteps entirely. If usage data ever showed people weren't opening
   the dashboard often enough for staleness to matter, the natural next
   step is a scheduled digest (daily/weekly summary email) rather than
   granular per-event pushes — worth a line in `TODOS.md` if it comes
   up, not built speculatively now.

   **Update 2 (explicit user decision, 2026-09-12):** the user
   overrode the "proactive email is opt-in only" stance below —
   `app/api/internal/agent-monitor/route.ts` now sends an immediate
   email (via `lib/email.ts`/Resend) to every active MANAGEMENT/
   AI_TEAM_LEAD user whenever a new `AgentFlag` is created, not just
   on request. This is a deliberate, acknowledged reversal of this
   section's original push-notification rationale — the in-app
   pull-based attention queue is unchanged and remains the source of
   truth, email is now an additional real-time channel on top of it.

   **Update (see `AGENTIC_DASHBOARD_PLAN.md`):** the agentic PMO/
   dashboard enhancement's "early-warning alerts" requirement is
   satisfied without reversing this decision — `AgentFlag` rows
   (stuck milestones/blockers, high-severity risks, ownership gaps)
   surface in-app, in the same pull-based attention queue described
   above, not via email/Slack/push. Proactive email remains an
   explicitly opt-in, off-by-default secondary path, not the primary
   mechanism. This item's pull-not-push decision stands unchanged.

---

## 4. Data model (new, replaces recruitment schema)

```
User (role: AI_ANALYST | DEVELOPER | BUSINESS_OWNER | AI_TEAM_LEAD | MANAGEMENT)
  │
  ▼
Project ──────────────┬──────────────┬───────────────┬────────────────┐
 id, name, businessUnit,             │               │                │
 department, businessProblem,        │               │                │
 expectedOutcome, ownerId,           │               │                │
 analystId, developerId,             │               │                │
 currentStage (enum, 10 values),     │               │                │
 health (computed),                  │               │                │
 expectedDeliveryDate                │               │                │
  │                                  │               │                │
  ├─▶ ProjectStageHistory            ├─▶ Milestone    ├─▶ Blocker      ├─▶ ScopeChange
  │    (from, to, actorId, ts,       │    (name,      │    (desc,      │    (requestedBy,
  │     evidenceSnapshot)            │     ownerId,   │     impact,    │     reason,
  │                                  │     dueDate,   │     requiredAction, │ deliveryImpact,
  ├─▶ StageGateChecklistItem         │     status)    │     resolvedAt) │    ts)
  │    (stage, label, required,     │                │
  │     checked, checkedById)       │                │
  │                                  │
  ├─▶ ProjectTask (action, owner, deadline, status, relatedMilestoneId)
  │
  └─▶ Document (via existing DocumentOwnerType.PROJECT)

DelayReason ── links Milestone (or Project) → taxonomy value + free-text note, on DELAYED transition
```

State machine (10 stages, assignment Sec 3):
```
IDEA → DISCOVERY → REQUIREMENTS_DESIGN → APPROVAL → DEVELOPMENT →
INTERNAL_TESTING → BUSINESS_TESTING_UAT → DEPLOYMENT → STABILIZATION → COMPLETED
```
Each arrow is gated: transition API checks all `required=true`
`StageGateChecklistItem` rows for the *current* stage are `checked=true`
before writing `ProjectStageHistory` and advancing `currentStage`.

---

## 5. Build sequence

1. **Schema** — new Prisma migration: drop recruitment models; add
   Project, ProjectStageHistory, StageGateChecklistItem, Milestone,
   ProjectTask, Blocker, ScopeChange, DelayReason; update `Role` and
   `DocumentOwnerType` enums. Seed script rewritten with gate-checklist
   templates (assignment Sec 5 exit criteria, verbatim).
2. **Lib layer** — `lib/checklist-engine.ts` (generic), `lib/project-
   stages.ts` (state machine + gate enforcement), `lib/project-health.ts`
   (computation + delay-reason enforcement), `lib/authz.ts` updated.
3. **API routes** (`app/api/v1/projects/...`) — CRUD, stage transition,
   gate checklist toggle, milestones, tasks, blockers, scope changes,
   dashboard aggregation endpoint.
4. **UI** (`app/(dashboard)/projects/...`) — Portfolio list, Project
   workspace (Overview / People / Tasks & Milestones / Blockers / Files /
   Stage & Gates tabs), Project creation wizard, Management Dashboard.
5. **Prototype journey** (assignment Sec 12D, demoed end-to-end): create
   project → assign AI analyst → complete Discovery gate → complete
   Design gate + approval → start Development → milestone goes overdue
   (auto → DELAYED + forced reason) → blocker recorded → blocker resolved
   → Development gate completed → UAT approved → deployed → closed.
6. **Tests** — Vitest unit tests for stage-gate engine, health
   computation, delay-reason enforcement, RBAC matrix; integration tests
   for the prototype-journey API sequence.

---

## 6. NOT in scope (assignment Sec 11, explicit)

- Financial accounting, employee attendance, GitHub/source-code
  management, complex resource planning, full Jira functionality, full
  ERP integration, advanced autonomous AI agents.
- Materialized dashboard rollups (deferred — same precedent as prior
  TalentFlow review; revisit if live queries prove slow in production).
- Full UI test coverage (deferred — known gap, core logic is covered).

---

## 7. Verification

- `npx prisma migrate dev` succeeds against the new schema; seed script
  runs clean.
- `npm run build` / `tsc --noEmit` passes with old recruitment code fully
  removed (no dangling imports).
- `npx vitest run` — all new unit + integration tests pass.
- Manual walk of the full prototype journey (Sec 12D) in the browser:
  new project → discovery gate → design gate + approval → development →
  forced delay reason on overdue milestone → blocker → resolution →
  development complete → UAT → deployed → closed — confirm the dashboard
  reflects each state change and stage-gate enforcement actually blocks
  premature advancement.

---

## Status

- [x] Schema migration — `prisma/migrations/20260903065707_init_project_domain`,
      old recruitment migrations deleted and dev DB reset (user-confirmed).
- [x] Lib layer — `lib/stage-gate-templates.ts` (Sec 5 exit criteria, plain
      data so `prisma/seed.ts` can import it outside the Next bundler),
      `lib/checklist-engine.ts`, `lib/project-stages.ts` (forward-only
      one-at-a-time gated transitions), `lib/project-health.ts`
      (BLOCKED > DELAYED > AT_RISK > ON_TRACK computation +
      delay-reason-required check), `lib/project-authz.ts` (Sec 9
      permission matrix). `prisma/seed.ts` rewritten: 5 role users +
      2 demo projects (one mid-Development with a resolved blocker and an
      overdue milestone with delay reason on record, one fresh IDEA).
      Document-download authz checker for `DocumentOwnerType.PROJECT`
      registered in `instrumentation.ts`.
- [x] API routes — full CRUD + stage-transition/checklist-gate/milestone/
      task/blocker/scope-change endpoints under `app/api/v1/projects/*`,
      `app/api/v1/dashboard/management`, `app/api/v1/my-work`. Fixed a
      dashboard bug post-build: `attentionItems[].needsDelayReason` now
      checks `milestoneRequiresDelayReason()` instead of "any overdue
      milestone exists" (was wrongly flagging milestones that already
      have a reason recorded). `components/shell/nav-items.ts`/
      `icons.tsx` repointed at the new domain (Home / My Work / Portfolio
      / Management Dashboard / Administration). `tsc --noEmit` clean.
- [x] UI — Portfolio (`app/(dashboard)/projects/page.tsx` +
      `ProjectsTable.tsx`, client-side filters), project creation
      (`projects/new` + `ProjectCreateForm.tsx`), project workspace
      (`projects/[id]` + `ProjectWorkspace.tsx` with `SectionTabs`:
      Overview/People/Stage & Gates/Milestones & Tasks/Blockers/Files),
      Management Dashboard (`dashboard/page.tsx`, attention-items first),
      My Work (`my-work/page.tsx`), Home (`page.tsx`). `lib/api-client.ts`
      gained `patchJson`. New client-safe `lib/project-permissions.ts`
      (split out of `lib/project-authz.ts`, which stayed `server-only`)
      so Client Components can gate buttons on `hasProjectPermission`
      without pulling `server-only`/`next/headers` into the browser
      bundle — this was caught as a real 500 (`'server-only' cannot be
      imported from a Client Component module`) via a dev-server smoke
      test of the project workspace page, not just `tsc`.
      `components/projects/projectTone.ts` holds the client-safe
      stage/health/status label+tone maps and a `nextStage()` mirror of
      the server-only version in `lib/project-stages.ts`.
      Verified live: login, portfolio, stage-gate checklist seeding,
      gate-blocked transition (422), successful transition, dashboard
      aggregation — all via `curl` against a running dev server, plus a
      full `prisma migrate reset` + reseed from scratch. `tsc --noEmit`
      and `eslint` both clean.

      **Delegation note:** three background sub-agent attempts at this
      UI build stalled or went meta/confused without writing files (see
      session history) — one of them (`aee6807e3b14c8d9b`) turned out to
      still be running well after being assumed dead and concurrently
      overwrote `ProjectMilestonesTasksPanel.tsx` with its own valid
      alternative implementation while this was being built directly;
      it was caught via `ListAgents` and stopped with `TaskStop`. The
      bulk of this layer was ultimately built directly in-session rather
      than delegated, after that pattern repeated.
- [x] Prototype journey wired end-to-end — full Sec 12D sequence walked
      live against a running dev server via `curl` (session, not
      throwaway): create project (IDEA) → assign AI analyst → transition
      to DISCOVERY, complete its 4-item gate → transition to
      REQUIREMENTS_DESIGN, complete its 4-item gate ("design approved")
      → transition to APPROVAL → assign developer, transition to
      DEVELOPMENT → create a milestone with a past due date (health
      correctly flips ON_TRACK→DELAYED) → record a blocker (health
      correctly flips DELAYED→BLOCKED, confirming BLOCKED takes priority)
      → record the milestone's delay reason → resolve the blocker
      (health correctly falls back to DELAYED, not ON_TRACK, since the
      milestone is still overdue) → mark the milestone DONE (health
      correctly returns to ON_TRACK) → complete the DEVELOPMENT gate →
      transition to INTERNAL_TESTING → BUSINESS_TESTING_UAT, complete
      its 4-item gate ("UAT approved") → DEPLOYMENT → STABILIZATION →
      COMPLETED. `ProjectStageHistory` recorded all 10 stages in order;
      an out-of-date `version` on one PATCH attempt was correctly
      rejected with 409 (optimistic locking caught it, not a bug); the
      project workspace and management dashboard pages both render
      clean (200, no error boundary) with the completed project.
- [x] Tests (Vitest) — added as this rebuild's foundation (no test
      framework existed in the repo before). `vitest.config.ts` aliases
      `server-only` to a no-op stub (`test/stubs/server-only.ts`) since
      that guard only resolves inside Next's webpack bundler, not plain
      Node/Vitest. `npm test` runs `vitest run`.
      - Unit (no DB, 18 tests): `test/unit/project-permissions.test.ts`
        (full RBAC matrix per assignment Sec 9, including the
        MANAGEMENT-is-view-only and BUSINESS_OWNER/DEVELOPER boundary
        cases), `test/unit/project-health.test.ts`
        (isMilestoneOverdue/isMilestoneAtRisk edge cases), `test/unit/
        project-stages.test.ts` (STAGE_ORDER matches Sec 3 verbatim,
        nextStage), `test/unit/stage-gate-templates.test.ts` (Sec 5
        exit criteria verbatim, only the 4 gated stages have templates).
      - Integration (real dev Postgres, namespaced+torn-down fixtures,
        15 tests): `test/integration/project-lifecycle.test.ts` —
        gate-blocked vs. gate-satisfied transitions, forward-only/no-
        skip enforcement, freely-transitioning an ungated stage,
        `computeProjectHealth`'s full BLOCKED > DELAYED > AT_RISK >
        ON_TRACK priority ladder (including BLOCKED masking an overdue
        milestone, and falling back to DELAYED not ON_TRACK once a
        blocker resolves while the milestone stays overdue), DONE
        milestones never counting toward health, `milestoneRequires
        DelayReason`'s three states, and `seedStageGateChecklist`
        idempotency. Verified clean from a full `prisma migrate reset` +
        reseed, not just against already-warm state.
      - Not built: HTTP-layer route-handler tests (would need mocking
        `next/headers`' cookie jar per request) — the same request
        sequences are instead covered by the manual `curl` walk above,
        which exercises the actual route handlers end-to-end. Full UI
        component tests remain the same known, flagged gap as TODOS.md
        already states for the prior domain.

## 8. QA (2026-09-03, post-build)

Full end-to-end QA run as 4 parallel agents against a live dev server +
seeded DB — see `qa/SUMMARY.md` and the 4 `qa/checklist-*.md` files for
full detail. **99/99 checklist items pass** after fixes. Two issues found:

1. **Critical, fixed** — document downloads were unconditionally denied
   (403) for every role, including AI_TEAM_LEAD/MANAGEMENT. Root cause:
   a boot-time authz-checker registry in `lib/documents.ts`/
   `instrumentation.ts` whose module instance wasn't guaranteed to match
   the route handler's under Next 16 + Turbopack dev. Fixed by removing
   the registry indirection (this domain has one `DocumentOwnerType`, so
   the pluggable-registry pattern — built for the deleted multi-owner-
   type recruitment domain — no longer earned its complexity) and
   inlining the check directly. Commit `345a2b7`.
2. **Cosmetic, fixed** — leftover "TalentFlow" branding (title, header
   wordmark, login copy, two doc comments) from the app's prior
   recruitment-ATS incarnation. Commit `f68249a`.

The core, highest-risk logic — gated stage transitions, checklist
enforcement, health computation's full priority ladder, delay-reason
enforcement, optimistic locking, and the full RBAC matrix — passed
exhaustive live testing with zero issues, corroborating the Vitest
integration suite.

See `.claude/plans/misty-inventing-cake.md` for the full `/plan-eng-review`
transcript (architecture decisions with tradeoffs, what-already-exists,
NOT-in-scope, review report).
