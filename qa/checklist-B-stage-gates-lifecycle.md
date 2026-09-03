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
- [ ] businessProblem / expectedOutcome / stage / health / expected delivery all render correctly
- [ ] "Latest update" line shows something sensible (not blank, not wrong date math)
- [ ] Scope change form: submitting without a `newExpectedDeliveryDate` doesn't change the project's delivery date
- [ ] Scope change form: submitting WITH a new date DOES update `Project.expectedDeliveryDate` and shows in the list below
- [ ] Scope change form is hidden/disabled for a role without RECORD_SCOPE_CHANGE (e.g. DEVELOPER)

## People tab
- [ ] Owner/analyst/developer display correctly, "Unassigned" shown for null
- [ ] Reassignment form: changing analyst/developer and saving works, `version` increments
- [ ] Reassignment with a stale `version` (simulate: open two tabs, edit in one, save in the other) returns a 409 conflict, UI shows a sensible error — NOT a silent failure or crash
- [ ] Reassignment form is hidden for a role without EDIT_REQUIREMENTS

## Stage & Gates tab — this is the core gated-workflow logic, test thoroughly
- [ ] Fresh project at IDEA: no checklist items shown, "Advance to Discovery" button enabled
- [ ] Advancing to DISCOVERY seeds exactly 4 checklist items with the exact assignment Sec 5 labels: "Business problem documented", "Current process understood", "Users identified", "Expected outcome defined"
- [ ] With 0/4 checked, "Advance to Requirements & Design" is disabled (or clicking it shows a clear error, not a silent no-op)
- [ ] Checking 3/4 items: advance is still blocked
- [ ] Checking all 4/4: advance button becomes enabled/succeeds
- [ ] Un-checking a previously-checked item works (toggle both directions)
- [ ] Advancing to REQUIREMENTS_DESIGN seeds its own 4-item template ("Requirements completed", "Workflow approved", "UI/UX or solution design completed", "Technical approach defined") — the DISCOVERY items no longer show (only current-stage items are fetched)
- [ ] Advancing through APPROVAL (no template — should advance freely with zero checklist items shown)
- [ ] Advancing to DEVELOPMENT seeds its 3-item template
- [ ] Stage history section shows every transition made so far, in order, with actor name and timestamp
- [ ] Attempting to call `POST /api/v1/projects/[id]/stage-transition` with a `toStage` that SKIPS a stage (e.g. IDEA straight to APPROVAL) returns a 422, not a 200
- [ ] Attempting to transition backward (e.g. DISCOVERY back to IDEA) returns a 422
- [ ] A role without TRANSITION_STAGE permission (e.g. MANAGEMENT) gets a 403 on the transition endpoint, and the "Advance" button is hidden/disabled in the UI for that role
- [ ] A role without TOGGLE_CHECKLIST_ITEM permission (MANAGEMENT) cannot check/uncheck items via the API (403), checkboxes are disabled in UI

### Bugs found
(none yet)
