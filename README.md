# Anwar AI ProjectFlow

A lightweight project-governance system for Anwar Group's internal AI team —
built for the *Anwar AI ProjectFlow* candidate assignment
(`Anwar_AI_ProjectFlow_Candidate_Assignment.pdf`).

**North star:** open the system and know, within a few seconds, where every
AI project stands, what's late, why it's late, who needs to act, and when
it will ship — without asking anyone for a verbal update.

For the full write-up (problem understanding, architecture decisions, data
model, and build status) see **[`PROJECT_PLAN.md`](./PROJECT_PLAN.md)**. For
end-to-end QA results see **[`qa/SUMMARY.md`](./qa/SUMMARY.md)**. Visual
design system: **[`DESIGN.md`](./DESIGN.md)**.

## What it does

- **10-stage gated pipeline** (Idea → Discovery → Requirements & Design →
  Approval → Development → Internal Testing → UAT → Deployment →
  Stabilization → Completed) — a project only advances once its current
  stage's exit-criteria checklist is fully checked off. Stage is never a
  status a PM types over Slack.
- **Computed health**, not self-reported: `BLOCKED` (an unresolved blocker)
  overrides `DELAYED` (an overdue milestone) overrides `AT_RISK` (due within
  3 days) overrides `ON_TRACK`.
- **Forced delay reasons** — the moment a milestone goes overdue, a reason
  from a fixed taxonomy (requirements not finalized, resource unavailable,
  scope change, etc.) must be recorded before that milestone can be edited
  further.
- **5 roles** (AI Analyst, Developer, Business Owner, AI Team Lead,
  Management) with a permission matrix enforced server-side.
- **Management Dashboard** that leads with "what needs my attention today
  and why," not just aggregate charts.

## Tech stack

Next.js (App Router, `/api/v1` REST API + SPA) · PostgreSQL via Prisma ·
credentials-based session auth · S3-compatible document storage (presigned
URLs) · Vitest (unit + integration).

## Getting started

### 1. Start infra

```bash
docker compose up -d
```

Starts Postgres (`localhost:5433`) and MinIO (S3-compatible storage,
`localhost:9000`).

### 2. Configure environment

```bash
cp .env.example .env
```

Defaults in `.env.example` already match `docker-compose.yml`.

### 3. Install, migrate, seed

```bash
npm install
npm run db:migrate
npm run db:seed
```

Seeds 5 business units and users across all 5 roles. **Password for every
seeded user: `ProjectFlow!2026`.** A few logins:

| Email | Role |
|---|---|
| `management@anwargroup.test` | Management |
| `teamlead@anwargroup.test` | AI Team Lead |
| `analyst@anwargroup.test` | AI Analyst |
| `developer@anwargroup.test` | Developer |
| `owner@anwargroup.test` | Business Owner |

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing

```bash
npm test
```

Runs the full Vitest suite (33 tests: RBAC matrix, health computation,
stage-gate transitions, delay-reason enforcement as pure-logic unit tests;
full stage-lifecycle integration tests against the real dev Postgres). The
integration tests hit a live database, so on a cold/remote connection the
default 5s per-test timeout can be tight — if you see timeouts rather than
assertion failures, re-run with:

```bash
npx vitest run --testTimeout=30000
```

## Project structure

```
app/(dashboard)/projects/   Portfolio, project creation, project workspace
app/(dashboard)/dashboard/  Management Dashboard
app/(dashboard)/my-work/    Personal work queue
app/api/v1/                 REST API (projects, stages, milestones, tasks,
                             blockers, scope changes, documents, dashboard)
lib/project-stages.ts       Gated stage-transition state machine
lib/project-health.ts       Health computation + delay-reason enforcement
lib/checklist-engine.ts     Generic stage-gate checklist engine
lib/project-authz.ts        Server-only RBAC permission matrix
lib/project-permissions.ts  Client-safe mirror for gating UI
prisma/schema.prisma        Data model
prisma/seed.ts              Demo data (5 roles, 2 demo projects)
test/unit/                  Pure-logic tests (no DB)
test/integration/           Full lifecycle tests (real Postgres)
qa/                          Manual QA checklists + summary
```

## Scope

Deliberately **not** built (per assignment Sec 11): financial accounting,
employee attendance, GitHub/source-code management, complex resource
planning, full Jira/ERP functionality, autonomous AI agents, or push
notifications (the dashboard/My Work/Home pages are pull-based by design —
see `PROJECT_PLAN.md` §3 #7 for the rationale). Known, flagged gaps are
tracked in [`TODOS.md`](./TODOS.md).
