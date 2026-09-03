# QA Lane B — Project Workspace: Overview, People, Stage & Gates

Owner: Agent B. Dev server: http://localhost:3000 (already running — do not
restart it). DB is already migrated + seeded. Use the seeded demo project
"Claims Intake Automation" (mid-Development, has a resolved blocker and a
delayed milestone with a delay reason already recorded — look it up via
`GET /api/v1/projects?businessUnitId=...` or just query the portfolio page)
plus create your own fresh test project(s) via `POST /api/v1/projects` for
lifecycle testing so you don't disturb the demo data other lanes may also
be looking at.

Mark each row `[x] PASS`, `[x] FAIL — <bug>`, or `[ ] not tested`. Add a
`### Bugs found` section at the bottom with repro steps. If you fix
something small and unambiguous, do it as its own git commit
(`fix(qa): <description>`) and note the commit SHA.

## Overview tab
- [x] PASS — businessProblem / expectedOutcome / stage / health / expected delivery all render correctly. Verified via `GET /api/v1/projects/cmtl9dux3000pv6n6lhnqtihy` and server-rendered `/projects/[id]` HTML for the fresh test project "QA Lane B Test Project".
- [x] PASS — "Latest update" line shows something sensible. After a stage transition, rendered HTML showed: `Latest update: Stage advanced to DEVELOPMENT — 0 days ago`. `daysSince()` in lib/format.ts is `Math.max(0, floor((now-then)/86400000))`, correct/non-negative.
- [x] PASS — Scope change form: `POST .../scope-changes` with `{"reason":"minor tweak, no date change"}` (no `newExpectedDeliveryDate`) returned 201, and `Project.expectedDeliveryDate` stayed `2026-12-01T00:00:00.000Z` afterward (version unchanged too — scope-change route only bumps project version when a date is supplied).
- [x] PASS — Scope change form WITH `newExpectedDeliveryDate: 2027-03-15` returned 201 and `Project.expectedDeliveryDate` became `2027-03-15T00:00:00.000Z`; both scope changes appear in `GET .../scope-changes`, newest first.
- [x] PASS — DEVELOPER (no RECORD_SCOPE_CHANGE) got 403 `{"code":"FORBIDDEN","message":"Role DEVELOPER does not have permission: RECORD_SCOPE_CHANGE."}` from the API, and the "Record scope change" button string is absent from the DEVELOPER's server-rendered page while present on the analyst's (components/projects/ProjectOverviewPanel.tsx gates it with `hasProjectPermission(currentUserRole, "RECORD_SCOPE_CHANGE")`).

## People tab
- [x] PASS — Owner/analyst/developer display correctly; component (components/projects/ProjectPeoplePanel.tsx) renders `project.analyst?.name ?? "Unassigned"` / same for developer.
- [x] PASS — Reassignment: `PATCH /api/v1/projects/[id]` with correct `version` reassigned analyst, `version` incremented 6→7, response reflected the new `analystId`.
- [x] PASS — Reassignment with a stale `version` (6, after it had moved to 7) returned `409 {"code":"CONFLICT","message":"This project has been modified since you last loaded it. Refresh and try again."}` — a clean conflict response, not a crash or silent failure.
- [x] PASS — DEVELOPER (no EDIT_REQUIREMENTS) got 403 `{"code":"FORBIDDEN","message":"Role DEVELOPER does not have permission: EDIT_REQUIREMENTS."}`; UI gates the "Reassign people" button and form behind the same `canEdit` check.

## Stage & Gates tab — this is the core gated-workflow logic, test thoroughly
- [x] PASS — Fresh project at IDEA: `GET .../checklist` returned `{"items":[],"readiness":{"total":0,"checked":0,"percent":100}}`; advance button in UI is enabled (`gateSatisfied` is vacuously true when `checklistItems` is empty) and TRANSITION_STAGE-permitted roles could call the transition endpoint successfully.
- [x] PASS — Advancing IDEA→DISCOVERY seeded exactly 4 items with the exact Sec 5 labels: "Business problem documented", "Current process understood", "Users identified", "Expected outcome defined" (all `required: true`).
- [x] PASS — With 0/4 checked, `POST .../stage-transition {"toStage":"REQUIREMENTS_DESIGN"}` returned 422 `STAGE_TRANSITION_INVALID` — "All required checklist items for DISCOVERY must be checked before advancing."
- [x] PASS — With 3/4 checked, same call still returned 422 with the same message.
- [x] PASS — With 4/4 checked, the transition succeeded (200), stage moved to REQUIREMENTS_DESIGN, version incremented.
- [x] PASS — Un-checking a previously-checked item works and re-checking it works (toggled item "Business problem documented" false→true→ verified via GET, both PATCH calls returned 200 with correct `checked`/`checkedAt`/`checkedById`).
- [x] PASS — Advancing to REQUIREMENTS_DESIGN seeded its own 4-item template ("Requirements completed", "Workflow approved", "UI/UX or solution design completed", "Technical approach defined"); `GET .../checklist` only returns items where `stage === project.currentStage`, so the DISCOVERY items no longer appear.
- [x] PASS — Checked all 4 REQUIREMENTS_DESIGN items, advanced to APPROVAL (200); `GET .../checklist` at APPROVAL returned `{"items":[],"readiness":{"percent":100}}` (no template, per lib/stage-gate-templates.ts). Advancing APPROVAL→DEVELOPMENT with zero checklist items succeeded immediately (vacuous gate), confirming APPROVAL advances freely.
- [x] PASS — Advancing to DEVELOPMENT seeded its 3-item template: "Required functionality developed", "Internal testing completed", "Major known bugs resolved".
- [x] PASS — `GET .../stage-history` showed all 5 transitions (IDEA seed row + 4 forward moves) in reverse-chronological order (`changedAt desc`), each with `actor.name`/`actor.role` and `changedAt`, and forward moves carry an `evidenceSnapshot` of the checklist state at the time of transition.
- [x] PASS — IDEA→APPROVAL (skip) on a fresh project returned 422 `STAGE_TRANSITION_INVALID` — "Stages cannot be skipped — advance one stage at a time."
- [x] PASS — DISCOVERY→IDEA (backward) returned 422 — "A project can only move forward — it cannot re-enter its current or a prior stage."
- [x] PASS — MANAGEMENT (no TRANSITION_STAGE) got 403 on `POST .../stage-transition`; UI's `ProjectStageGatesPanel` disables the Advance button via `disabled={!canTransition || !gateSatisfied || advancing}`.
- [x] PASS — MANAGEMENT (no TOGGLE_CHECKLIST_ITEM) got 403 on `PATCH .../checklist/[itemId]`; UI disables each checkbox via `disabled={!canToggle || busyItemId === item.id}`.

### Bugs found
None. Every item in this lane's checklist passed against the live API and rendered UI, tested against a fresh project (`cmtl9dux3000pv6n6lhnqtihy`, "QA Lane B Test Project") created via `POST /api/v1/projects` and driven end-to-end from IDEA through DEVELOPMENT.

Testing note (not a product bug): zsh arrays are 1-indexed, so an early pass at scripting checklist-item toggles with `${IDS[0]}` silently hit an empty path segment and got Next.js's 308/405 route-normalization behavior for `/checklist/` with no id. That was a test-script bug, not an app bug — confirmed by re-running the same PATCH with explicit item ids, which worked correctly every time.
