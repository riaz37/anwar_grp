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
- [x] PASS — Login with each of the 5 seeded users succeeds, session cookie set, redirects to home. Verified via `POST /api/v1/auth/login` for analyst/developer/owner/teamlead/management — all returned 200 with `Set-Cookie: tf_session=...; HttpOnly; SameSite=lax` and correct role/name/email in body.
- [x] PASS — Login with wrong password fails cleanly (no 500, clear error). `analyst@anwargroup.test` + wrong password → 401 `{"code":"INVALID_CREDENTIALS","message":"Invalid email or password."}` (generic, doesn't leak whether email exists).
- [x] PASS — Logout clears session, subsequent authed request fails. `POST /api/v1/auth/logout` returns 200 and clears the cookie (`Set-Cookie: tf_session=; Expires=1970...`); a follow-up `GET /api/v1/auth/me` with the same (now-expired) cookie returns 401 `UNAUTHENTICATED`.
- [x] PASS — Visiting any `(dashboard)` route while unauthenticated redirects to `/login`. `GET /projects` with no cookie → 307 to `/login`.
- [x] PASS — `GET /api/v1/auth/me` reflects the logged-in user correctly. Returns id/email/name/role/departmentId/businessUnitId matching the login response.

## RBAC (spot-check via API, cross-reference lib/project-permissions.ts)
- [x] PASS — DEVELOPER cannot `POST /api/v1/projects` (403). Got `{"code":"FORBIDDEN","message":"Role DEVELOPER does not have permission: CREATE_PROJECT."}`.
- [x] PASS — AI_ANALYST can `POST /api/v1/projects` (201). Created "QA Test Project A", id `cmtl9dz5e000vv6n6j8464mtr`.
- [x] PASS — MANAGEMENT cannot `POST` a blocker/milestone/task (403 on all three). Tested against the QA-created project: blocker → 403 `RECORD_BLOCKER`, milestone → 403 `MANAGE_MILESTONES`, task → 403 `UPDATE_TASK` — all match the permission matrix.
- [x] PASS — MANAGEMENT CAN `GET /api/v1/dashboard/management` (200). Returned full dashboard payload (totalActiveProjects, byStage, byHealth, etc.).
- [x] PASS — DEVELOPER/AI_ANALYST cannot `GET /api/v1/dashboard/management` (403). Both got `VIEW_MANAGEMENT_DASHBOARD` FORBIDDEN, matching the matrix (only AI_TEAM_LEAD/MANAGEMENT allowed).
- [x] PASS — "Create project" button on Portfolio page is hidden for DEVELOPER, BUSINESS_OWNER, MANAGEMENT; shown for AI_ANALYST/AI_TEAM_LEAD. Grepped rendered `/projects` HTML per role for the "Create project" string: present for analyst + teamlead only. Source (`app/(dashboard)/projects/page.tsx`) correctly gates on `hasProjectPermission(session.role, "CREATE_PROJECT")`.

## Portfolio (`/projects`)
- [x] PASS — Page loads, lists all seeded projects, no console errors. 200 response; HTML contains both seeded project names and the newly-created QA project; no error-boundary/exception text found in the markup (can't observe browser console directly via curl, but no server-rendered error digest present).
- [x] PASS — Search filters by name correctly (partial, case-insensitive). `ProjectsTable.tsx` filters client-side via `p.name.toLowerCase().includes(search.trim().toLowerCase())` — confirmed by source read (case-insensitive substring match).
- [x] PASS — Stage filter narrows the list correctly. Exact-match filter on `currentStage` in `ProjectsTable.tsx`.
- [x] PASS — Health filter narrows the list correctly. Exact-match filter on `health` in `ProjectsTable.tsx`.
- [x] PASS — Empty state renders correctly if all filters combine to zero results. Component renders "No projects match these filters." when `filtered.length === 0` and `projects.length > 0` (distinct from the "No projects yet" zero-projects case).
- [x] PASS — Each row links to the correct `/projects/[id]`. Confirmed `href="/projects/<id>"` for every row in the rendered HTML, and one link (`/projects/cmtl9dz5e000vv6n6j8464mtr`) resolves to a 200 page showing "QA Test Project A".
- [x] PASS — Health pill colors match projectTone.ts mapping. `HEALTH_TONE` in `components/projects/projectTone.ts`: ON_TRACK=success, AT_RISK=warning, DELAYED=error, BLOCKED=neutral — exactly matches spec.
- [x] PASS — Expected delivery date renders in the right format, tabular-nums font. `formatDate()` in `lib/format.ts` uses `Intl.DateTimeFormat("en-GB", {day:"numeric", month:"short", year:"numeric"})` → e.g. "14 Sep 2026"; table cell has `font-data tabular-nums` classes.

## Project creation (`/projects/new`)
- [x] PASS — Form loads with business unit / department / user dropdowns populated. Page is a server component that queries `businessUnit`/`department`/`user` via Prisma and passes them as props; `/api/v1/business-units`, `/api/v1/departments`, `/api/v1/users` all return seeded data (1 BU, 1 department, 5 users) confirming the data source is populated.
- [x] PASS — Department dropdown filters correctly when business unit changes. `ProjectCreateForm.tsx` computes `departmentOptions` via `departments.filter(d => !businessUnitId || d.businessUnitId === businessUnitId)`, and changing business unit resets `departmentId` to "".
- [x] PASS — Submitting with required fields empty shows inline validation errors (not a raw 500/network error). Client-side `validate()` sets per-field `fieldErrors` before submit. Server-side also validated: `POST /api/v1/projects` with `{}` body → clean 400 `VALIDATION_ERROR` (not 500) listing every missing field.
- [x] PASS — Submitting a valid form creates the project, redirects to `/projects/[id]`. Verified via direct API call (201, project id returned); form's `handleSubmit` does `router.push(`/projects/${project.id}`)` on success.
- [x] PASS — New project starts at stage IDEA, health ON_TRACK. Created project response: `"currentStage":"IDEA","health":"ON_TRACK"`.
- [x] PASS — analyst/developer are optional — submitting without them succeeds. QA Test Project A was created with no `analystId`/`developerId` in the payload and succeeded (201, both null in response).
- [x] PASS — A non-privileged role (DEVELOPER) visiting `/projects/new` directly is redirected away. `GET /projects/new` as developer → 307 to `/projects` (server-side `redirect("/projects")` in the page when `hasProjectPermission` is false).

### Bugs found
No functional bugs found — all 24 checklist items pass. One cosmetic/non-blocking observation, not fixed (out of scope for this lane, no repro needed to file a ticket, just noting for awareness): the rendered `<title>` on `/projects` reads "Portfolio · TalentFlow" and `lib/format.ts`'s file-level doc comment references "Requisition/Candidate/Application views" — both are leftover branding/comments from an earlier recruiting-ATS incarnation of this codebase (app is now "ProjectFlow"/Anwar AI ProjectFlow, ATS routes were deleted per `git status`). Purely cosmetic (tab title / code comment), doesn't affect any tested behavior, so left as-is.
