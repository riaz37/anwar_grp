# QA Lane A — Auth, RBAC, Portfolio, Project Creation

Owner: Agent A. Dev server: http://localhost:3000 (already running — do not
restart it). DB is already migrated + seeded (`prisma/seed.ts` — 5 role
users, password `ProjectFlow!2026` for all: analyst@, developer@, owner@,
teamlead@, management@anwargroup.test).

Mark each row `[x] PASS`, `[x] FAIL — <bug>`, or `[ ] not tested` as you go.
Add a `### Bugs found` section at the bottom with repro steps for anything
failing. If you fix something small and unambiguous, do it as its own git
commit (`fix(qa): <description>`) and note the commit SHA next to the item.

## Auth
- [ ] Login with each of the 5 seeded users succeeds, session cookie set, redirects to home
- [ ] Login with wrong password fails cleanly (no 500, clear error)
- [ ] Logout clears session, subsequent authed request fails
- [ ] Visiting any `(dashboard)` route while unauthenticated redirects to `/login`
- [ ] `GET /api/v1/auth/me` reflects the logged-in user correctly

## RBAC (spot-check via API, cross-reference lib/project-permissions.ts)
- [ ] DEVELOPER cannot `POST /api/v1/projects` (403)
- [ ] AI_ANALYST can `POST /api/v1/projects` (201)
- [ ] MANAGEMENT cannot `POST` a blocker/milestone/task (403 on all three)
- [ ] MANAGEMENT CAN `GET /api/v1/dashboard/management` (200)
- [ ] DEVELOPER/AI_ANALYST cannot `GET /api/v1/dashboard/management` (403)
- [ ] "Create project" button on Portfolio page is hidden for DEVELOPER, BUSINESS_OWNER, MANAGEMENT; shown for AI_ANALYST/AI_TEAM_LEAD

## Portfolio (`/projects`)
- [ ] Page loads, lists all seeded projects, no console errors
- [ ] Search filters by name correctly (try partial match, case-insensitive?)
- [ ] Stage filter narrows the list correctly
- [ ] Health filter narrows the list correctly
- [ ] Empty state renders correctly if all filters combine to zero results
- [ ] Each row links to the correct `/projects/[id]`
- [ ] Health pill colors match projectTone.ts mapping (ON_TRACK=success/green, AT_RISK=warning, DELAYED=error, BLOCKED=neutral)
- [ ] Expected delivery date renders in the right format, tabular-nums font

## Project creation (`/projects/new`)
- [ ] Form loads with business unit / department / user dropdowns populated
- [ ] Department dropdown filters correctly when business unit changes
- [ ] Submitting with required fields empty shows inline validation errors (not a raw 500/network error)
- [ ] Submitting a valid form creates the project, redirects to `/projects/[id]`
- [ ] New project starts at stage IDEA, health ON_TRACK
- [ ] analyst/developer are optional — submitting without them succeeds
- [ ] A non-privileged role (DEVELOPER) visiting `/projects/new` directly is redirected away

### Bugs found
(none yet)
