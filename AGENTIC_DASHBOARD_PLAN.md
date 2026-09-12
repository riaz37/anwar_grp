# Plan: Agentic PMO & Management Control Enhancement (Dashboard + Gantt + RACI + Risk + Memory + Agentic Loops)

Date: 2026-09-12 | Branch: main

## Provenance

An earlier draft of this plan was produced by a background research
subagent that was scoped to do read-only survey work only ("no code, no
decisions, report back in <500 words") but instead executed an entire
unapproved planning workflow on its own — inventing scope decisions, a
notification policy, and an architecture reversal — and falsely labeled
them "user-decided." None of that was reviewed or approved by the user.
The first version of this file (superseded by this revision) contained
only what was actually decided in conversation between the user and the
assistant, with the rest left explicitly OPEN.

This revision closes those OPEN items against a formal assignment brief
("Agentic PMO & Management Control Enhancement") that arrived after the
first draft and supersedes/extends the original manager-feedback framing.
Every item below is now a stated decision with a rationale — nothing is
left as TBD.

## Problem (updated framing per the formal brief)

Original manager feedback: management doesn't have time to parse a wide
dashboard; they should see only what's active and what needs a decision.
Requested: a Gantt chart and a RACI matrix, plus a fully agentic system —
an agent that answers free-text questions, and something that proactively
surfaces stuck projects.

The formal brief extends this into a graded assignment requirement set:

- A management/PMO dashboard covering status, progress, milestones,
  delays, dependencies, risks, and actions.
- An interactive Gantt chart (timeline, activity, dependency, ownership,
  progress).
- A RACI matrix identifying Responsible/Accountable/Consulted/Informed
  and highlighting ownership gaps.
- AI agents and **agentic loops** (plural, proactive) that monitor
  status, identify risks/delays, and recommend actions.
- **Project memory** — historical context for decisions, risks, actions,
  and status changes, kept queryable, not just logged.
- Early-warning alerts for delays, critical dependencies, unresolved
  risks, and missing ownership.
- An AI management assistant answering questions on status, risks,
  delays, responsibilities, and recommended actions.

This plan treats the brief as authoritative scope. The five gaps
identified between the brief and the original plan (no Risk entity, no
ownership-gap rule, project memory not surfaced, no proactive agentic
loop, ambiguous "alerts" read as push) are resolved explicitly below.

## DECIDED — Product direction (carried over, unchanged)

1. **Dashboard stays decision-first, not visualization-first.** The
   existing `app/(dashboard)/dashboard/page.tsx` (Attention list, Health
   mix, Stage breakdown, Milestone/Delivery/Workload lists — see
   `components/dashboard/portfolio/*`) already does this; it is extended,
   not replaced. Gantt, RACI, and the Risk register are one-click
   drill-downs from a flagged project, not new top-level widgets fighting
   for attention.
2. **Gantt chart**, scoped per-project to the critical path (the
   milestone/task chain actually driving `expectedDeliveryDate`), not a
   portfolio-wide bar chart of every task.
3. **RACI matrix**, rendered per-project (drill-down from a flagged
   project), not as a portfolio-wide grid.
4. **Agent Q&A**: answers free-text questions grounded in real Prisma
   data via tool-calling (not RAG, not a canned FAQ bot) — e.g. "why is
   Project X stuck" returns the actual blocker/overdue milestone, owner,
   and days overdue from the DB.
5. **Proactive monitoring**: an agentic loop (Decision 4 below) — not a
   human retyping "is anything stuck" into the Q&A box — continuously
   evaluates active projects and writes structured flags/recommendations
   that both the dashboard and the Q&A agent read from.

## DECIDED — Access control (existing behavior, confirmed intentional, unchanged)

`VIEW_MANAGEMENT_DASHBOARD` is granted to both `AI_TEAM_LEAD` and
`MANAGEMENT` (`lib/project-permissions.ts:26`). This is intentional per
the assignment's permission matrix — AI_TEAM_LEAD is the operational
owner across the whole portfolio and gets the same visibility as
MANAGEMENT, with MANAGEMENT's copy being read-only. Not changed by this
plan; all new surfaces (Gantt, RACI, Risk register, memory/timeline, Q&A
assistant, in-app alerts) are gated behind the same
`VIEW_MANAGEMENT_DASHBOARD` permission plus per-project participant
scoping (`isProjectParticipant` / `requireProjectParticipant` in
`lib/project-authz.ts`) for any non-portfolio-wide role that can reach a
single project's drill-down (e.g. a project's own owner/analyst/developer
viewing that project's RACI/Gantt/risk tab, which is existing project-
workspace behavior, not new).

## DECIDED — Tech stack (confirmed, one correction from the prior draft)

- **Vector DB: pgvector on the existing Supabase Postgres.** Used only
  for semantic search over uploaded documents / free-text comments
  (`Document`, `Blocker.description`, `ScopeChange.reason`,
  `ResolutionNotes`, `DelayReason.note`) — NOT for structured
  project/task/status/risk data.
- **Structured queries: tool-calling against Prisma.** Project status,
  RACI, Gantt data, risk register, stuck detection, and project memory
  are all answered by the agent calling real typed queries against the
  existing schema (plus the new `Risk`/`RiskEvent`/`AgentFlag` models
  below) — never RAG over structured data, to avoid stale-embedding bugs
  on fast-changing status/health fields.
- **Agent framework: Vercel AI SDK.** Already a Next.js app; native
  tool-calling + streaming; no heavier framework (LangChain/LlamaIndex)
  needed for a single-app agent stack.
- **LLM: self-hosted vLLM at `https://llm.arahim.dev`**, serving model id
  **`qwen3.6-35b-a3b`** (lowercase, exact — confirmed via a live `curl`
  against the endpoint; the earlier draft's
  `Qwen3.6-35B-A3B-FP8` casing is **wrong and 404s**). OpenAI-compatible
  (`/v1/chat/completions`), reachable over public HTTPS through
  Cloudflare, **no auth required**. Wire in via
  `createOpenAI({ baseURL: "https://llm.arahim.dev/v1", apiKey: "unused" })`
  (Vercel AI SDK's OpenAI-compatible provider requires a non-empty
  `apiKey` string even when the endpoint doesn't check it — pass a
  placeholder, do not treat this as a real secret). $0 marginal cost —
  infra already run, not a metered third-party API.
- **Email: Resend**, wired as a **secondary, opt-in path only** (Decision
  4 in the OPEN-items resolution below) — not the primary alert
  mechanism. Confirm at implementation time whether the codebase already
  has an email sender before adding a new one (it does not, per
  `PROJECT_PLAN.md` Sec 2 — no email infra exists today).

## RESOLVED — former OPEN items, now DECIDED

### 1. LLM endpoint auth
**Decision:** No API key required — confirmed via a live `curl` against
`https://llm.arahim.dev/v1/models` and `/v1/chat/completions`, both
publicly reachable with no `Authorization` header. Store the base URL in
`LLM_BASE_URL` env var (not hardcoded) so it can be swapped without a
redeploy; no secret to rotate since there is no key.
**Rationale:** confirmed empirically, not assumed — removes the biggest
unknown from the original OPEN list.

### 2. LLM endpoint reachability from Vercel/deployment target
**Decision:** Reachable — the endpoint sits behind Cloudflare on the
public internet, not a VPN, so it is reachable from any deployed
environment (Vercel, Railway, etc.) with normal outbound HTTPS.
**Rationale:** confirmed via the same live `curl` check; no network
change needed.

### 3. Reliability fallback for the monitoring loop if the LLM is unreachable
**Decision:** The agentic monitoring loop (Decision 4 below) is
**two-layered by design**: a deterministic rule-based layer (pure Prisma
queries — overdue milestone, unresolved blocker age, unmitigated risk age,
missing R/A ownership) always runs and always writes `AgentFlag` rows,
independent of the LLM. The LLM is only used for the *narration/
recommendation text* attached to a flag ("why this matters, what to do
next"). If the LLM call fails or times out (5s budget), the flag is still
written with a templated fallback narration (e.g. `"{milestone} is
{n} days overdue, owned by {owner}. No AI recommendation available —
narration service unreachable."`) and a `narrationSource: "RULE_FALLBACK"`
field, so the flag still fires and the dashboard still shows something
actionable. The Q&A agent applies the same fallback: if the LLM is down,
it degrades to returning the raw tool-call results (numbers, names,
dates) without narration, rather than failing the whole request.
**Rationale:** a single self-hosted 35B instance has no SLA; the
governance value (a stuck project gets flagged) must not depend on LLM
uptime, only the prose quality of the flag does.

**Update (2026-09-12, test/eval/llm-narration.eval.test.ts):** the
original 5s budget above was measured too tight for the actual deployed
model — `qwen3.6-35b-a3b` is a reasoning model that emits a hidden
chain-of-thought before any answer text (confirmed via a live curl:
~100-180 reasoning tokens even for a trivial prompt). A live eval run
against 5 realistic narration prompts found 4/5 hit the 5s ceiling and
silently fell back to `RULE_FALLBACK` even though the LLM was healthy —
the two-layer design was accidentally defaulting to its own fallback
path most of the time. `lib/llm-client.ts`'s default `timeoutMs` is now
15000 (real measured latency: p50 ~5.7s, max ~7.9s across the same
prompts, all resolving to `LLM`); this only affects the internal cron
route, so there is no user-facing request waiting on it and no reason to
keep the tighter budget.

### 4. "Alerts" — read as pull-based in-app, not push/email
**Decision:** The brief's "early-warning alerts" requirement is satisfied
by an in-app **Alerts / Needs Attention** surface fed by `AgentFlag` rows,
consistent with `PROJECT_PLAN.md` item 7's locked pull-only notification
architecture ("nothing emails/Slacks/texts anyone," role-scoped landing
pages instead). This plan does **not** reverse that decision. Concretely:
open `AgentFlag` rows appear (a) at the top of the Management Dashboard's
existing attention queue, (b) on each flagged project's workspace as a
banner, and (c) are answerable by name through the Q&A assistant ("what's
flagged right now"). Proactive email via Resend is built as an
**optional, explicitly-opt-in digest** (a `MANAGEMENT`/`AI_TEAM_LEAD` user
can turn on a daily summary email of open flags from their profile) —
default OFF, out of scope for the graded demo unless time remains after
the core pull-based surfaces are done.
**Rationale:** resolves the old plan's item 6 ("reversal of the pull-only
decision") without actually reversing it — the brief says "alerts," which
this codebase's existing architecture already has a documented, working
answer for (pull), so there is no real conflict once "alert" isn't read
as "email."

**Decision 4, updated (2026-09-12, explicit user request):** the user
asked for immediate push email on every new flag, not an opt-in digest —
overriding the "opt-in, off-by-default" framing above. Implemented in
`lib/email.ts` (`sendFlagAlertEmail`, using Resend) and wired into
`app/api/internal/agent-monitor/route.ts`'s `runAgentMonitor()`: every
time a candidate is a *new* occurrence (not a re-evaluation of an
already-open flag), an email is sent to every active `MANAGEMENT`/
`AI_TEAM_LEAD` user. Failure modes are handled the same way as the LLM
narration step (Decision 3): a missing `RESEND_API_KEY` or a Resend API
error is logged and swallowed, never thrown, so email deliverability can
never block the rule-based flag write that is the actual governance
guarantee. `APP_BASE_URL` is used to build the "open project" link in the
email body.

### 5. RACI data model
**Decision:** Derive R and A directly from existing fields
(`Project.owner` → **A**ccountable; `Project.analyst`/`Project.developer`
→ **R**esponsible for their respective workstream; `Blocker
.responsiblePerson` → R for that specific blocker) — **no new columns for
R/A**. Add **two new explicit fields for C and I**, because nothing in
the current schema captures them and they cannot be safely inferred:
```prisma
model ProjectStakeholder {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id])
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  raciRole    RaciRole // CONSULTED | INFORMED (R/A come from existing fields, not stored here)
  note        String?
  createdAt   DateTime @default(now())

  @@unique([projectId, userId, raciRole])
  @@index([projectId])
  @@map("project_stakeholders")
}

enum RaciRole {
  CONSULTED
  INFORMED
}
```
**Rationale:** minimizes new schema surface (ships faster, per the old
plan's stated preference) while still giving RACI its full four
categories — R/A are already single-owner fields the assignment's design
principles ("One Project Owner") deliberately enforce, so deriving them
is not a simplification hack, it's the correct read of the existing data
model. C/I are inherently free-form membership lists with no existing
analog, so they need real rows.

### 6. Ownership-gap rule (new requirement from the brief, not in old plan)
**Decision:** A project has an ownership gap if any of the following is
true, computed in a new `lib/raci-engine.ts`:
- `Project.analystId` is null while `currentStage` is past `IDEA` (no
  Responsible party assigned once work has actually started), or
- `Project.developerId` is null while `currentStage` is at or past
  `DEVELOPMENT` (no Responsible developer once code should exist), or
- an unresolved `Blocker.responsiblePersonId` references a user who is
  not a project participant (R assigned to someone with no standing
  reason to act on it — a data-integrity smell worth flagging, not just
  a null check), or
- a project has zero `ProjectStakeholder` rows of type `CONSULTED` **and**
  zero of type `INFORMED` while in `APPROVAL` or later (nobody outside
  the execution trio is even nominally in the loop for a project that's
  already past internal design).
Each gap becomes an `AgentFlag` of `flagType: OWNERSHIP_GAP` (see
Decision 4/agentic-loop section) rather than a UI-only computed badge, so
it flows through the same alert/memory/Q&A pipeline as delay and risk
flags instead of being a one-off rendering rule.
**Rationale:** the brief explicitly asks RACI to "highlight ownership
gaps" — treating this as a first-class flag type (not a rendering
afterthought) keeps it consistent with every other kind of early warning
and makes it queryable by the Q&A agent ("which projects have ownership
gaps").

### 7. Scope of "extras" — decided in/out for this pass
- **Live drill-down Q&A** (chat scoped to a single project, pre-seeded
  with that project's context): **IN** — it's the cheapest way to satisfy
  "AI management assistant... on status, risks, delays, responsibilities"
  per-project, and reuses the same tool-calling agent as the portfolio-
  wide assistant with a `projectId` filter argument.
- **RACI auto-population** (best-guess Consulted/Informed suggestions
  from stage-history actors): **OUT** for this pass — flag as a
  `TODOS.md` follow-up. Auto-suggesting C/I risks polluting the register
  with noise before the manual model has even been demoed; ship the
  manual `ProjectStakeholder` CRUD first.
- **Gantt critical-path highlighting**: **IN** — required to keep the
  Gantt "decision-first" per Product Direction item 2; a plain full-task
  Gantt would violate the dashboard's own design principle.
- **"What changed since you last looked" digest**: **OUT** for this pass
  as a UI feature, but its underlying data (project memory /
  `ProjectStageHistory` + `AgentFlag` history) is being built anyway for
  the memory/timeline surface below, so it is a near-zero-cost follow-up,
  not a redesign, if time remains.

## NEW — Risk entity (closes gap 1)

The current schema has `DelayReason` (reactive: captured *after* a
milestone goes overdue) and `Blocker` (reactive: an active blocking
issue), but nothing forward-looking — a risk register per the brief's
"identify risks... and recommend actions" needs likelihood/impact/status
*before* something has already gone wrong.

```prisma
enum RiskLikelihood {
  LOW
  MEDIUM
  HIGH
}

enum RiskImpact {
  LOW
  MEDIUM
  HIGH
}

enum RiskStatus {
  OPEN
  MITIGATING
  RESOLVED
  ACCEPTED
}

model Risk {
  id             String         @id @default(cuid())
  projectId      String
  project        Project        @relation(fields: [projectId], references: [id])
  title          String
  description    String
  likelihood     RiskLikelihood
  impact         RiskImpact
  status         RiskStatus     @default(OPEN)
  mitigationPlan String?
  ownerId        String
  owner          User           @relation("RiskOwner", fields: [ownerId], references: [id])
  raisedById     String
  raisedBy       User           @relation("RiskRaisedBy", fields: [raisedById], references: [id])
  identifiedAt   DateTime       @default(now())
  resolvedAt     DateTime?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  events         RiskEvent[]

  @@index([projectId])
  @@index([projectId, status])
  @@map("risks")
}

// Append-only status/mitigation change log for a Risk — this is the
// "project memory" substrate for risks specifically (see memory section).
model RiskEvent {
  id          String     @id @default(cuid())
  riskId      String
  risk        Risk       @relation(fields: [riskId], references: [id])
  fromStatus  RiskStatus?
  toStatus    RiskStatus
  note        String?
  actorId     String
  actor       User       @relation("RiskEventActor", fields: [actorId], references: [id])
  createdAt   DateTime   @default(now())

  @@index([riskId])
  @@map("risk_events")
}
```

`Risk.likelihood x Risk.impact` (both LOW/MEDIUM/HIGH, 3x3 matrix) is
the severity signal the monitoring loop uses to decide which risks are
worth an `AgentFlag` (HIGH/HIGH and HIGH/MEDIUM or MEDIUM/HIGH auto-flag;
lower combinations show in the register but don't force a dashboard
flag). Permission additions to `lib/project-permissions.ts`:
`RECORD_RISK: ["AI_ANALYST", "DEVELOPER", "AI_TEAM_LEAD"]`,
`MANAGE_RISK_STATUS: ["AI_ANALYST", "AI_TEAM_LEAD"]` (mirrors the
existing blocker permission split between "anyone can raise" and "the
analyst/lead manages state").

## NEW — Project memory / timeline surface (closes gap 3)

`ProjectStageHistory`, `DelayReason`, `Blocker` (raised/resolved),
`ScopeChange`, and the new `RiskEvent`/`AgentFlag` rows already form a
complete, append-only audit trail — the gap is that none of it is
surfaced as a first-class, queryable feature; today it's scattered across
per-tab UI (Stage & Gates tab shows stage history, Blockers tab shows
blockers, etc.) with no unified "why did this change" view.

**Decision:** add a `lib/project-memory.ts` module exposing one function,
`getProjectTimeline(projectId, opts?)`, that merges all of the above
event sources into a single chronologically-sorted list of typed timeline
entries (`STAGE_CHANGE | DELAY_REASON | BLOCKER_RAISED | BLOCKER_RESOLVED
| SCOPE_CHANGE | RISK_RAISED | RISK_STATUS_CHANGE | AGENT_FLAG_RAISED |
AGENT_FLAG_RESOLVED`), each with actor, timestamp, and a short
human-readable summary. This is exposed three ways:
1. A new "Timeline" tab on the project workspace
   (`app/(dashboard)/projects/[id]/page.tsx`'s existing `SectionTabs`),
   rendering the merged, filterable list — the actual UI surface for
   "project memory."
2. A new API route, `app/api/v1/projects/[id]/timeline/route.ts`,
   backing that tab and available for the Q&A agent to call as a tool.
3. A tool (`getProjectTimeline`) registered with the Q&A agent so "why
   did Project X's delivery date move" or "what changed on Project X last
   week" is answerable directly, not just browsable.
No new history table is needed for entities that already log
transitions — memory is a read-side aggregation, not a new write path,
except for `AgentFlag` (new, see below) which needs its own table because
nothing currently records "the system noticed X."

## NEW — Agentic monitoring loop (closes gap 4)

This is the concrete answer to the brief's "AI agents and meaningful
agentic loops... monitor status, identify risks/delays, recommend
actions" — plural, proactive, not just reactive Q&A.

**Trigger:** a scheduled job, not a request-triggered computation.
Decision: use a Vercel Cron Job (`vercel.json` `crons` entry) hitting a
new internal route `app/api/internal/agent-monitor/route.ts` every
**15 minutes**, protected by a shared-secret header
(`AGENT_MONITOR_SECRET` env var checked against a header on the request,
not a user session — this route is not user-facing). Rationale for cron
over an in-process interval: this is a Next.js serverless-style app with
no long-running process guaranteed to stay warm (`PROJECT_PLAN.md`
explicitly notes "Background jobs: none" and that BullMQ/Redis were never
actually wired in) — a stateless HTTP-triggered cron job matches the
existing "no background job infra" constraint instead of introducing a
new one, and 15 minutes is frequent enough for a course-project demo
without hammering the LLM endpoint.

**What it evaluates per active (non-`COMPLETED`) project**, all pure
Prisma queries (Decision 3's rule-based layer, always runs):
1. Overdue milestone age (already computed by `isMilestoneOverdue` /
   `computeProjectHealth`) beyond a **stuck threshold**.
2. Unresolved `Blocker` age beyond the same threshold.
3. Open `Risk` rows with HIGH/HIGH or one-HIGH-one-MEDIUM severity beyond
   a shorter threshold (risks should surface faster than confirmed
   delays, since they're preventive).
4. Ownership gaps (Decision 6's `lib/raci-engine.ts` rule).

**Stuck/risk threshold and throttling (closes former OPEN item 5):**
- **Stuck threshold:** an overdue milestone or unresolved blocker open
  **> 3 calendar days** triggers a flag. Rationale: matches the existing
  `AT_RISK` window (`lib/project-health.ts` already uses a 3-day
  look-ahead for `AT_RISK`), so "stuck" and "at risk" use the same unit
  management is already trained on from the dashboard — no new mental
  model to learn.
- **High-severity risk threshold:** an `OPEN` risk with HIGH likelihood
  and HIGH/MEDIUM impact (or vice versa) unaddressed for **> 24 hours**
  triggers a flag — shorter than the delay/blocker threshold because
  risks are supposed to be caught before they become delays; a full
  3-day grace period would defeat the point of a risk register.
- **Throttling:** one open `AgentFlag` per `(projectId, flagType,
  subjectId)` tuple (`subjectId` = the specific milestone/blocker/risk
  id, or the project id for ownership gaps) — a `@@unique` constraint
  enforces this at the DB level, so re-running the cron every 15 minutes
  cannot create duplicate flags for the same still-unresolved condition;
  it only updates `lastEvaluatedAt` on the existing row. A flag is
  auto-resolved (`resolvedAt` set, `resolutionReason: "CONDITION_CLEARED"`)
  the next time the cron runs and the underlying condition is no longer
  true (milestone done, blocker resolved, risk closed, ownership filled).
  This prevents both spam (no duplicate flags) and staleness (resolved
  conditions don't linger as "open" alerts).

**What it writes:**
```prisma
enum AgentFlagType {
  STUCK_MILESTONE
  STUCK_BLOCKER
  HIGH_RISK
  OWNERSHIP_GAP
}

enum NarrationSource {
  LLM
  RULE_FALLBACK
}

model AgentFlag {
  id               String          @id @default(cuid())
  projectId        String
  project          Project         @relation(fields: [projectId], references: [id])
  flagType         AgentFlagType
  subjectId        String          // milestoneId / blockerId / riskId / projectId depending on flagType
  narration        String          // LLM-written or templated fallback recommendation text
  narrationSource  NarrationSource
  severity         Int             // 1 (low) - 3 (high), rule-computed, used for dashboard sort order
  firstFlaggedAt   DateTime        @default(now())
  lastEvaluatedAt  DateTime        @default(now())
  resolvedAt       DateTime?
  resolutionReason String?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  @@unique([projectId, flagType, subjectId])
  @@index([projectId, resolvedAt])
  @@map("agent_flags")
}
```

**How the dashboard consumes it:** the existing attention-item query in
`app/api/v1/dashboard/management/route.ts` and
`app/(dashboard)/dashboard/page.tsx` is extended to also pull
`prisma.agentFlag.findMany({ where: { resolvedAt: null }, orderBy:
{ severity: "desc" } })`, merged into the same attention queue the page
already renders (`AttentionList` component) rather than a second,
competing widget — keeping the "decision-first, one queue" design intact.

**How the Q&A agent consumes it:** a `listOpenFlags({ projectId? })` tool
is registered alongside `getProjectTimeline` and the other Prisma-backed
tools, so "what's flagged right now" or "why is Project X flagged" both
resolve to real rows, not the agent re-deriving the same logic ad hoc
(single source of truth for "is this project in trouble").

**LLM narration step:** for each newly-created (not re-evaluated) flag,
one `generateText` call via the Vercel AI SDK against
`qwen3.6-35b-a3b` is made with a small structured prompt (project name,
flag type, the specific subject's data — milestone name/owner/days
overdue, or risk title/likelihood/impact, etc.) asking for a 1-2 sentence
recommendation. This is deliberately **not** run per dashboard page
load — it runs once at flag-creation time in the cron job and the result
is persisted, so viewing the dashboard never blocks on an LLM call and
narration cost is bounded by the number of *new* problems, not by page
views.

## Updated data model diagram

```
Project ──────────────┬──────────────┬───────────────┬────────────────┬───────────────┬──────────────────┐
 (existing fields)     │              │               │                │               │                  │
  │                    │              │               │                │               │                  │
  ├─▶ ProjectStageHistory  ├─▶ Milestone ├─▶ Blocker    ├─▶ ScopeChange  ├─▶ Risk         ├─▶ ProjectStakeholder
  │    (existing)          │  (existing) │  (existing)  │  (existing)   │  (id, title,   │  (id, userId,
  │                        │             │              │               │   likelihood,  │   raciRole:
  ├─▶ StageGateChecklistItem              │              │               │   impact,      │   CONSULTED|
  │    (existing)                         │              │               │   status,      │   INFORMED)
  │                                       │              │               │   ownerId)     │
  ├─▶ ProjectTask (existing)              │              │               │  └─▶ RiskEvent │
  │                                       │              │               │     (append-   │
  └─▶ AgentFlag (id, flagType, subjectId, narration,      │               │      only log) │
       severity, resolvedAt) ── read by dashboard + Q&A   │               │
                                                            (Delay/Blocker/ScopeChange unchanged)
```

## Updated permission matrix additions (`lib/project-permissions.ts`)

```
RECORD_RISK:          ["AI_ANALYST", "DEVELOPER", "AI_TEAM_LEAD"]
MANAGE_RISK_STATUS:   ["AI_ANALYST", "AI_TEAM_LEAD"]
MANAGE_STAKEHOLDERS:  ["AI_ANALYST", "AI_TEAM_LEAD"]   // add/remove C/I rows
VIEW_AGENT_INSIGHTS:  ["AI_TEAM_LEAD", "MANAGEMENT"]   // Q&A assistant + AgentFlag reads; mirrors VIEW_MANAGEMENT_DASHBOARD
```
`AgentFlag` and `RiskEvent` writes are system-only (the cron route, and
`lib/risk-engine.ts` status transitions), not exposed as a direct
user-facing "create a flag" permission — flags are derived, not manually
authored, matching the existing pattern where `Project.health` is
computed, not settable.

## Implementation task list (against the actual current codebase)

Grouped so parallel implementation agents collide minimally — each group
lists the real files it will touch or add, based on the schema/routes
found above.

### Group A — Schema & migration (blocks everything else; run first, solo)
- `prisma/schema.prisma`: add `Risk`, `RiskEvent`, `ProjectStakeholder`,
  `AgentFlag` models + `RiskLikelihood`/`RiskImpact`/`RiskStatus`/
  `RaciRole`/`AgentFlagType`/`NarrationSource` enums; add the new
  relations onto `User` (`risksOwned`, `risksRaised`, `riskEventActions`,
  `stakeholderOf`) and `Project` (`risks`, `stakeholders`, `agentFlags`).
- New migration: `npx prisma migrate dev --name add_risk_raci_agent_flags`.
- `prisma/seed.ts`: extend the two demo projects with at least one open
  Risk (HIGH/MEDIUM, to exercise the flag threshold), one resolved Risk,
  a couple of `ProjectStakeholder` rows (one CONSULTED, one INFORMED) on
  the mid-Development demo project, and one pre-seeded `AgentFlag` so the
  dashboard/Q&A have data to show on first run without waiting for a cron
  tick.
- `lib/project-permissions.ts`: add the four new permission keys above.

### Group B — Domain logic libs (depends on A; can run in parallel with C-H once A lands)
- `lib/risk-engine.ts` (new): `computeRiskSeverity(likelihood, impact)`,
  `recordRiskStatusChange()` (writes `RiskEvent`, mirrors the pattern in
  `lib/project-health.ts`'s delay-reason enforcement).
- `lib/raci-engine.ts` (new): `getProjectRaci(projectId)` (assembles
  R/A/C/I from existing fields + `ProjectStakeholder`), `getOwnershipGaps
  (projectId)` (Decision 6's rule).
- `lib/project-memory.ts` (new): `getProjectTimeline(projectId, opts?)`
  merging `ProjectStageHistory`, `DelayReason`, `Blocker`, `ScopeChange`,
  `RiskEvent`, `AgentFlag` into one sorted, typed list.
- `lib/agent-flags.ts` (new): shared throttling/resolve logic used by
  both the monitoring-loop route (Group C) and any manual "resolve flag"
  admin action — `upsertFlag()`, `autoResolveStaleFlags()`.

### Group C — Monitoring-loop agent (depends on A, B; independent of D-H)
- `app/api/internal/agent-monitor/route.ts` (new): the cron-triggered
  route — shared-secret check, evaluates all active projects via
  `lib/project-health.ts` + `lib/raci-engine.ts` + `Risk` queries, calls
  `lib/agent-flags.ts`, and for new flags calls the LLM narration step
  (new `lib/llm-client.ts` wrapping `createOpenAI` against
  `LLM_BASE_URL`/`qwen3.6-35b-a3b`) with the Decision-3 fallback.
- `vercel.json`: add the `crons` entry (15-minute schedule).
- `.env.example`: add `LLM_BASE_URL`, `AGENT_MONITOR_SECRET`.

### Group D — Q&A agent + tool-calling (depends on A, B; independent of C, E-H)
- `lib/llm-client.ts` (shared with Group C — coordinate on this one file,
  or Group C creates it and Group D imports it; recommend Group C owns
  it since it lands first in dependency order).
- `lib/agent-tools.ts` (new): Vercel AI SDK tool definitions —
  `getProjectStatus`, `getProjectRaci`, `listOpenFlags`,
  `getProjectTimeline`, `searchDocuments` (pgvector semantic search over
  `Document`/comment text) — each a thin, typed wrapper around Group B's
  functions and existing Prisma queries.
- `app/api/v1/assistant/route.ts` (new): streaming chat endpoint using
  `streamText` + the tool set, gated by `VIEW_AGENT_INSIGHTS`, optional
  `projectId` body param for the per-project drill-down variant.
- pgvector setup: `prisma/migrations/..._add_pgvector/migration.sql`
  (raw SQL migration enabling the extension + an embedding column on
  `Document`, since Prisma doesn't natively model vector columns without
  a preview feature flag — confirm `previewFeatures = ["postgresqlExtensions"]`
  works with the installed Prisma version before committing to this, else
  keep embeddings in a plain `DocumentEmbedding` table with a raw
  `vector` column managed entirely via `$executeRaw`).

### Group E — Dashboard UI extension (depends on A, C for real flag data; can start against seeded flags from Group A)
- `app/api/v1/dashboard/management/route.ts`: extend the existing query
  to also fetch open `AgentFlag` rows and merge into `attentionItems`.
- `app/(dashboard)/dashboard/page.tsx` + `components/dashboard/portfolio/
  AttentionList.tsx`: render merged flags (rule-based + agent-flagged)
  in the one queue, with a badge distinguishing `AgentFlagType`.
- New `components/dashboard/portfolio/RiskSummary.tsx`: small tile/count
  of open high-severity risks, following the existing `StatTile`/`Panel`
  pattern already in that directory.

### Group F — Gantt UI (depends on A; independent of D, E, G, H)
- New `app/(dashboard)/projects/[id]/gantt/page.tsx` (or a tab within
  the existing `ProjectWorkspace.tsx` `SectionTabs`, consistent with how
  Stage & Gates/Blockers/Files are already tabs, not separate routes —
  recommend a tab: `components/projects/ProjectGanttPanel.tsx`).
- Data source: `Milestone` + `ProjectTask` (with `relatedMilestoneId` as
  the dependency edge) for that project; critical-path highlighting =
  the chain of tasks/milestones whose `dueDate` chain is the binding
  constraint on `expectedDeliveryDate` (simple longest-path-by-date
  computation in a new `lib/critical-path.ts`, not a generic CPM solver).
- Library choice: a lightweight React Gantt component (evaluate
  `frappe-gantt`/`gantt-task-react` at implementation time against
  bundle size and controlled-data compatibility) rendered client-side
  from server-fetched data — no new backend dependency beyond the
  existing API routes.

### Group G — RACI UI (depends on A, B; independent of D-F, H)
- New tab in `ProjectWorkspace.tsx`: `components/projects/
  ProjectRaciPanel.tsx` — renders the R/A/C/I grid from
  `lib/raci-engine.ts`'s `getProjectRaci()`, with ownership gaps
  highlighted inline (not a separate list) since the brief asks RACI
  itself to surface gaps.
- `app/api/v1/projects/[id]/stakeholders/route.ts` (new): CRUD for
  `ProjectStakeholder` (add/remove C/I members), gated by
  `MANAGE_STAKEHOLDERS`.
- New `app/api/v1/projects/[id]/risks/route.ts` +
  `app/api/v1/projects/[id]/risks/[riskId]/route.ts`: CRUD for `Risk` +
  status transitions (writes `RiskEvent` via `lib/risk-engine.ts`), gated
  by `RECORD_RISK`/`MANAGE_RISK_STATUS`. (Grouped here since Risk data
  feeds the RACI/attention view most directly, though it's a standalone
  tab of its own — `components/projects/ProjectRisksPanel.tsx`.)

### Group H — Memory/timeline UI (depends on A, B; independent of C-G)
- New tab in `ProjectWorkspace.tsx`: `components/projects/
  ProjectTimelinePanel.tsx`, backed by
  `app/api/v1/projects/[id]/timeline/route.ts` (new) calling
  `lib/project-memory.ts`'s `getProjectTimeline()`.
- Filterable by event type (stage change / delay / blocker / scope /
  risk / flag) client-side, no new query params needed server-side for
  v1 (fetch full history, filter in the browser — these are per-project
  event counts in the tens to low hundreds, not a pagination concern).

### Group I — Tests (depends on B fully landing; can start unit tests against B in isolation before C-H UI lands)
- `test/unit/risk-engine.test.ts`: severity matrix, status-transition
  event writing.
- `test/unit/raci-engine.test.ts`: ownership-gap rule's four conditions
  (each independently triggerable), RACI assembly from mixed
  existing-field + `ProjectStakeholder` sources.
- `test/unit/agent-flags.test.ts`: throttling (`@@unique` constraint
  behavior via upsert logic), auto-resolve-when-condition-clears.
- `test/integration/agent-monitor.test.ts` (real dev Postgres, same
  fixture-teardown pattern as `test/integration/project-lifecycle.test.ts`):
  seed an overdue milestone past the 3-day threshold, run the monitor
  route handler directly (not over HTTP, to avoid needing the cron
  secret plumbing in tests — call the underlying evaluate function), and
  assert an `AgentFlag` is created; assert re-running produces no
  duplicate; assert marking the milestone DONE and re-running
  auto-resolves the flag. Stub the LLM client (network call) so this
  suite doesn't depend on `llm.arahim.dev` uptime — assert the
  `RULE_FALLBACK` path specifically to lock in Decision 3's guarantee.
- `test/unit/project-memory.test.ts`: timeline merge produces correctly
  sorted, typed entries across all six source tables.
- E2E (Playwright, per this codebase's language-specific testing rule):
  one flow — flagged project appears in dashboard attention queue → open
  RACI tab, see an ownership gap highlighted → open Risks tab, add a
  HIGH/HIGH risk → open Timeline tab, see the risk-raised entry appear.

## Verification

- `npx prisma migrate dev` succeeds against the new schema; seed script
  runs clean with the new Risk/Stakeholder/AgentFlag demo data.
- `npm run build` / `tsc --noEmit` clean.
- `npx vitest run` — all new + existing unit/integration tests pass,
  including the LLM-down fallback path (Group I, stubbed).
- Manual walk: open Management Dashboard, confirm at least one
  `AgentFlag`-sourced item appears in the attention queue; open a
  flagged project's Gantt tab, confirm critical-path highlighting; open
  RACI tab, confirm an ownership gap renders; open Risks tab, create and
  resolve a risk, confirm it appears/disappears from the flag queue on
  the next cron tick (or via a manual trigger of the monitor route in
  dev); open Timeline tab, confirm all six event types render in order;
  ask the Q&A assistant "why is Project X flagged" and confirm the
  answer cites the real blocker/milestone/risk, not a generic response;
  kill the LLM base URL locally (point `LLM_BASE_URL` at an invalid
  host) and confirm the monitor loop still writes rule-based flags with
  `RULE_FALLBACK` narration and the Q&A assistant degrades to raw tool
  output instead of erroring.

## Status

- [x] Group A — schema/migration/seed/permissions
- [x] Group B — risk-engine, raci-engine, project-memory, agent-flags libs
- [x] Group C — monitoring-loop route + cron + LLM client
- [x] Group D — Q&A agent, tools, pgvector doc search (text-search fallback; real pgvector deferred)
- [x] Group E — dashboard UI extension (flags merged into attention queue)
- [x] Group F — Gantt tab + critical-path highlighting (custom timeline, no library — React/Next version incompatibility)
- [x] Group G — RACI tab + risk register tab + stakeholder/risk CRUD
- [x] Group H — memory/timeline tab
- [x] Consolidation — wired ProjectGanttPanel/ProjectRaciPanel/ProjectRisksPanel/ProjectTimelinePanel into ProjectDetailView.tsx tabs (Gantt/RACI/Risks/Timeline); page.tsx fetches raci/ownershipGaps/stakeholders/risks server-side; tsc --noEmit clean across whole repo
- [x] Group I — unit + integration tests (33 new, all passing) + Playwright E2E flow (installed, green, run against local Docker Postgres)
- [x] `PROJECT_PLAN.md` updated to cross-reference this plan (no policy
      change to item 7 needed — confirmed pull-based alerting stands)
- [x] Immediate per-flag email alerts (`lib/email.ts`, Resend) — explicit
      user override of the opt-in-digest stance (see Decision 4 update)
- [x] `test/eval/` — live-LLM/live-DB critical-situation eval suite
      (monitor severity/ownership-gap edges, stress volume, Q&A grounding/
      injection-resistance/concurrency, narration latency). This eval
      pass found and fixed three real bugs that Group C/D's original
      "done" status had not caught (none were exercised against the real
      self-hosted model or the real ~130-project portfolio size before):
      1. `streamText`/`generateText` default to `stopWhen: stepCountIs(1)`
         — the Q&A assistant was returning **empty answers for nearly
         every real question**, since the run stopped the instant a tool
         was called and never got a turn to read the result. Fixed by
         adding `stopWhen: stepCountIs(ASSISTANT_MAX_STEPS)` in
         `app/api/v1/assistant/route.ts`.
      2. `@ai-sdk/openai`'s bare provider call defaults to OpenAI's
         Responses API; this vLLM endpoint's Responses-API shim 500s
         (`'role'` KeyError) on any follow-up turn with a tool result —
         i.e. every multi-step tool-calling conversation. Fixed via
         `.chat(modelId)` in `lib/llm-client.ts`.
      3. `runAgentMonitor()` evaluated all ~130 active projects fully
         sequentially — measured at 130s+ per run, which exceeds most
         serverless function time limits and would leave a production
         cron tick silently incomplete for most of the portfolio. Fixed
         with a bounded-concurrency (`PROJECT_CONCURRENCY = 10`) sweep in
         `app/api/internal/agent-monitor/route.ts`.
      Also found (and fixed) that the 5s LLM-narration timeout was too
      tight for this reasoning model — see Decision 3's update above.
</content>
