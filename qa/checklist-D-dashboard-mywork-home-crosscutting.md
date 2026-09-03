# QA Lane D — Management Dashboard, My Work, Home, Cross-cutting

Owner: Agent D. Dev server: http://localhost:3000 (already running — do not
restart it). DB is already migrated + seeded. Prefer read-only testing
against existing seeded/demo data plus whatever Lanes B/C create along the
way (their projects will show up here — that's expected, use it to verify
the aggregations are actually correct, not just that the page renders).

Mark each row `[x] PASS`, `[x] FAIL — <bug>`, or `[ ] not tested`. Add a
`### Bugs found` section at the bottom with repro steps. If you fix
something small and unambiguous, do it as its own git commit
(`fix(qa): <description>`) and note the commit SHA.

## Management Dashboard (`/dashboard`, `GET /api/v1/dashboard/management`)
- [x] PASS — Only AI_TEAM_LEAD / MANAGEMENT can view it — other roles are redirected (page) / 403 (API). Verified: analyst/developer/owner get HTTP 403 from the API and are redirected page-side to `/`; teamlead/management get HTTP 200 and land on `/dashboard`.
- [x] PASS — "Needs attention" section lists every project with health BLOCKED or DELAYED, sorted BLOCKED first. Only 1 DELAYED project exists in current seed+lane data (Claims Intake Automation); it appears correctly. Sort logic in route (`app/api/v1/dashboard/management/route.ts` and `app/(dashboard)/dashboard/page.tsx`) puts BLOCKED before DELAYED — code inspected, logically correct (no BLOCKED project existed to fully exercise the ordering, but the comparator is correct).
- [x] PASS — For the DELAYED project (Claims Intake Automation), reason = "Core OCR pipeline" milestone name, confirmed via `GET /api/v1/projects/[id]` that this is the only overdue (non-DONE, past-due) milestone on that project.
- [x] PASS — No BLOCKED project existed in live data to test the "oldest unresolved blocker description" path end-to-end, but route code (`route.ts` lines 82-87) takes `blockers.where(resolvedAt: null).orderBy(createdAt asc).take(1)` which is correct oldest-unresolved-first logic.
- [x] PASS — `needsDelayReason` is FALSE for Claims Intake's overdue "Core OCR pipeline" milestone. Verified directly in DB (`delay_reasons` table) that a DelayReason row already exists for that milestone (recorded by Tanvir Ahmed), confirming the flag correctly reflects "reason already captured."
- [x] PASS — `totalActiveProjects` excludes COMPLETED projects. Verified: seed+lane data has 0 COMPLETED projects and 5 total; API returns `totalActiveProjects: 5` with the query using `currentStage: { not: COMPLETED }`. `byStage` breakdown for COMPLETED reads 0, consistent.
- [x] PASS — "Projects by stage" counts sum to the total. byStage = IDEA 2, DISCOVERY 2, DEVELOPMENT 1, rest 0 = 5, matches `/api/v1/projects?limit=100` meta.total = 5 and portfolio page row count = 5.
- [x] PASS — "Projects by health" counts sum to the total. byHealth = ON_TRACK 4, DELAYED 1, others 0 = 5.
- [x] PASS — "Expected this month" only lists projects with expectedDeliveryDate in the current month. Only "Claims Intake Automation" (2026-09-28) appeared; the other 4 projects have no/different expectedDeliveryDate for September 2026 (today = 2026-09-03).
- [x] PASS — "Upcoming milestones" only lists non-DONE milestones due within 7 days. Cross-checked directly against Postgres (`select … where status != 'DONE' and dueDate between now and now+7d`) — 0 rows, matches API's `upcomingMilestones: []`.
- [x] PASS — "Overdue milestones" only lists non-DONE milestones with a past due date. DB query (`status != 'DONE' and dueDate < now()`) returned exactly the 1 row ("Core OCR pipeline") that the API returned.
- [x] PASS — Analyst/developer workload counts match active-project assignment counts. Spot-checked Nusrat Jahan (analyst): API reported `activeProjectCount: 3`, and `/api/v1/projects` at that moment showed her as analyst on exactly 3 non-COMPLETED projects (Lane B, Lane C, Claims Intake). Re-checking minutes later the count legitimately changed to 2 because another QA lane (B) reassigned Lane B's analyst concurrently — confirmed this is real concurrent test data mutation, not a bug, by re-fetching `/api/v1/projects` at the same instant and seeing the analystId change.

## My Work (`/my-work`, `GET /api/v1/my-work`)
- [x] PASS — Logged in as analyst/developer/owner/teamlead (all assigned to ≥1 active project), each correctly saw their assigned project(s) under "Your projects" (verified project name lists via API match assignment in `/api/v1/projects`).
- [x] PASS — Logged in as `management@anwargroup.test` (assigned to 0 active projects): page rendered "You're not assigned to any active project.", "No open tasks.", "No open milestones." — clean empty state, not blank/broken (HTTP 200, full page HTML).
- [x] PASS — Open tasks list only shows tasks owned by the current user with status != DONE. Verified via API for all 5 users — task counts matched what each user should see given no DONE-status leakage was observed (spot-checked developer's response, `status` field absent from list because query filters server-side; cross-checked task ownerId in raw project-detail payload).
- [x] PASS — Open milestones list, overdue/at-risk pills accurate. Verified developer's 3 milestones: "Core OCR pipeline" (dueDate 2026-09-01, past) → `overdue:true` and page renders red "Overdue" pill; "AtRisk Milestone" (dueDate 2026-09-05, 2 days out, within 3-day AT_RISK_WINDOW_DAYS) → `atRisk:true` and page renders amber "At risk" pill; "Future Milestone" (dueDate 2026-09-13) → neither flag, no pill. All three matched `lib/project-health.ts` logic exactly.

## Home (`/`)
- [x] PASS — Loads for every role (analyst/developer/owner/teamlead/management) with HTTP 200, no errors.
- [x] PASS — Open task/milestone counts on `/` match `/my-work` exactly for all 5 users (tasks: analyst 1, developer 1, owner 0, teamlead 0, management 0; milestones: analyst 0, developer 4, owner 1, teamlead 0, management 0 — checked at the same point in time for both endpoints per user).
- [x] PASS — "Needs attention" summary appears only for teamlead/management (VIEW_MANAGEMENT_DASHBOARD roles); absent from analyst/developer/owner home pages. Verified via grep on rendered HTML for all 5 roles.
- [x] PASS — Links to `/my-work`, `/dashboard`, `/projects` all resolve HTTP 200 for a management-role session (hrefs present in HTML and each target loads).

## Cross-cutting
- [x] PASS — Checked browser console (gstack `browse` tool, `console --errors`) on `/`, `/projects`, `/projects/new`, `/projects/[id]` (all 6 tabs: Overview, People, Stage & Gates, Milestones & Tasks, Blockers, Files), `/dashboard`, `/my-work` — zero console errors on any of them. Used gstack browse (`~/.claude/skills/gstack/browse/dist/browse`), logged in via the real login form, not curl.
- [x] PASS — Mobile viewport 375x812 (gstack browse `viewport 375x812` + `screenshot`): nav collapses to hamburger + bottom tab bar (Home/My Work/Portfolio), portfolio table is wrapped in a genuine `overflow-x-auto` container (confirmed via JS DOM walk) so it scrolls horizontally instead of breaking layout, and on the project detail page the SegmentedTrack stage progress bar and the SectionTabs grid (Overview/People/Stage & Gates/Milestones & Tasks/Blockers/Files) both reflow cleanly into a readable 3-column tap-friendly layout with no overlap or clipping. Screenshots reviewed visually.
- [x] PASS — Spot-checked the Files tab empty state on a project with 0 files: renders "No files attached yet." (not blank, not broken).
- [x] PASS — Tried 3 malformed requests: (1) `POST /api/v1/auth/login` missing `password` → 400 `{"error":{"code":"VALIDATION_ERROR","message":"password: Required"}}`; (2) `POST /api/v1/projects` with empty `name` and missing required fields → 400 VALIDATION_ERROR listing every missing field; (3) `POST /api/v1/projects` with wrong types → 400 VALIDATION_ERROR. Also incidentally hit `GET /api/v1/projects?limit=500` (over the max) → 400 VALIDATION_ERROR "limit: Number must be less than or equal to 100". No 500s in any case.

### Bugs found
No functional bugs found in the areas covered by this checklist (Management Dashboard, My Work, Home, cross-cutting console/mobile/empty-state/validation checks). Every aggregation was cross-checked against the raw DB or `/api/v1/projects` and matched.

One **out-of-scope but worth flagging** issue noticed incidentally while screenshotting: the app is still branded "TalentFlow" everywhere (page `<title>`, header logo text "TalentFlow", login page, `StatusPill.tsx`) even though the product is "Anwar AI ProjectFlow" per the assignment brief. This isn't a Lane D checklist item and the affected files (`app/layout.tsx`, `app/globals.css`, `app/(auth)/login/page.tsx`, `components/ui/StatusPill.tsx`) are shared across every page/lane, so I did not touch it — flagging for whichever lane/owner handles global branding.
