# QA Summary — Anwar AI ProjectFlow, 2026-09-03

Full end-to-end QA of the Project domain rebuild, run as 4 parallel agents
each owning a lane (checklist files in this directory), against a live dev
server + seeded Postgres DB.

## Results

| Lane | Scope | Result |
|---|---|---|
| [A](checklist-A-auth-portfolio-creation.md) | Auth, RBAC, Portfolio, Project creation | 24/24 PASS |
| [B](checklist-B-stage-gates-lifecycle.md) | Stage-gate lifecycle (core gated workflow) | 24/24 PASS |
| [C](checklist-C-milestones-tasks-blockers-files.md) | Milestones, Tasks, Blockers, Files | 24 PASS, 1 FAIL → fixed |
| [D](checklist-D-dashboard-mywork-home-crosscutting.md) | Management Dashboard, My Work, Home, cross-cutting | 27/27 PASS |

**99/99 checklist items pass** after fixes. 1 real bug found and fixed, 1
cosmetic issue (flagged independently by two lanes) found and fixed.

## Bugs found and fixed

1. **Document downloads always denied (critical — the Files feature was
   completely non-functional).** `lib/documents.ts` kept its download-authz
   checker in a module-level `Map` populated once by `instrumentation.ts`'s
   boot hook. Under Next 16 + Turbopack dev, the instrumentation module
   instance and a route handler's module instance of `lib/documents.ts`
   are not guaranteed to be the same object, so the `Map` instrumentation
   populated was never the one the route handler read from — every
   download request failed closed with 403, for every role, including
   AI_TEAM_LEAD/MANAGEMENT. Fixed by removing the registry indirection
   entirely (this domain has exactly one `DocumentOwnerType`, so the
   pluggable-registry pattern — built for a prior 6-owner-type recruitment
   domain — was solving a problem that no longer exists) and inlining the
   PROJECT participant check directly in `isAuthorizedToDownload()`.
   Commit `345a2b7`. Re-verified live after a full server restart.

2. **Stale "TalentFlow" branding** (cosmetic, no behavior impact) —
   page `<title>`/metadata, header wordmark, login page copy, two doc
   comments — leftover from this codebase's prior recruitment-ATS
   incarnation, independently flagged by Lanes A and D. Commit `f68249a`.

## What was NOT found to be broken

The core, highest-risk logic — the gated 10-stage transition machine,
stage-gate checklist seeding/enforcement, health computation's
BLOCKED > DELAYED > AT_RISK > ON_TRACK priority ladder (including the
BLOCKED-masks-overdue-milestone and falls-back-to-DELAYED-not-ON_TRACK
edge cases), delay-reason enforcement, optimistic locking (409 on stale
`version`), and the full RBAC permission matrix across all 5 roles — all
passed exhaustive testing with zero issues. This is the logic the Vitest
integration suite (`test/integration/project-lifecycle.test.ts`) also
covers, and QA's live, real-database testing corroborates it.

## Post-QA state

- `tsc --noEmit`: clean
- `eslint`: clean
- `npx vitest run`: 33/33 pass
- Live re-verification after the fixes: login, download (previously
  broken, now works), and branding all confirmed on a fresh dev-server
  boot.
