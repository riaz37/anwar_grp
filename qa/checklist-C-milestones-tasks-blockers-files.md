# QA Lane C — Project Workspace: Milestones & Tasks, Blockers, Files

Owner: Agent C. Dev server: http://localhost:3000 (already running — do not
restart it). DB is already migrated + seeded. Create your own fresh test
project(s) via `POST /api/v1/projects` (as AI_ANALYST or AI_TEAM_LEAD) so
you don't disturb demo data other lanes may be looking at — advance it to
DEVELOPMENT stage first (analyst/dev assigned, walk the gates) so milestones
and blockers are relevant to a project actually in flight.

Mark each row `[x] PASS`, `[x] FAIL — <bug>`, or `[ ] not tested`. Add a
`### Bugs found` section at the bottom with repro steps. If you fix
something small and unambiguous, do it as its own git commit
(`fix(qa): <description>`) and note the commit SHA.

Test project used throughout: `cmtl9ekr9001lv6n6u9006v3e` ("QA Lane C Test
Project"), created via POST /api/v1/projects as AI_ANALYST, walked
IDEA → DISCOVERY → REQUIREMENTS_DESIGN → APPROVAL → DEVELOPMENT by checking
each stage's required gate items and calling stage-transition.

## Milestones
- [x] PASS — Adding a milestone with a future due date (10 days out): health stayed ON_TRACK
- [x] PASS — Adding a milestone with a due date 2 days out: health became AT_RISK
- [x] PASS — Adding a milestone with a PAST due date: health immediately became DELAYED; GET .../milestones annotates it `"overdue": true` (UI renders "— overdue" text next to the milestone, not a literal "Overdue"-labeled Pill component — functionally equivalent, cosmetic naming difference from the checklist wording only)
- [x] PASS — Marking an overdue milestone's status to DONE without a delay reason: PATCH returned 422 `DELAY_REASON_REQUIRED`; UI (`ProjectMilestonesTasksPanel.tsx`) catches this code and opens an inline delay-reason form (`delayPromptFor` state) instead of a silent failure
- [x] PASS — Submitting status+delayReasonCategory+delayReasonNote together: 200, milestone becomes DONE, `completedAt` set to current timestamp
- [x] PASS — Verified with a second overdue milestone: renaming it while still overdue/PENDING with no reason returns 422; after submitting a delay reason once (via a status change), a subsequent rename-only PATCH with no delay reason fields succeeds (200) — no re-prompt
- [x] PASS — After marking the only overdue/at-risk milestones DONE (with no other outstanding issues), health returned to ON_TRACK
- [x] PASS — DEVELOPER and BUSINESS_OWNER both get 403 `FORBIDDEN` (`MANAGE_MILESTONES`) on POST and PATCH `/milestones`; UI hides the "Add milestone" button and the status `<select>` when `hasProjectPermission(role, "MANAGE_MILESTONES")` is false
- [x] PASS — GET `/milestones` order confirmed ascending by dueDate (2026-08-20, 2026-09-05, 2026-09-13 returned in that order)

## Tasks
- [x] PASS — Task with action+owner, no deadline: `deadline: null` in response; UI only renders the "— due ..." suffix `{t.deadline && ...}`, so it renders nothing (not "Invalid Date") when absent
- [x] PASS — Task with deadline + relatedMilestoneId: created successfully; UI looks up `milestoneNameById.get(t.relatedMilestoneId)` and appends the milestone name next to the task
- [x] PASS — Changing a task's status via PATCH persists; re-fetching GET `/tasks` shows the new status (`IN_PROGRESS`)
- [x] PASS — MANAGEMENT (no UPDATE_TASK) gets 403 on both POST and PATCH `/tasks`; UI hides "Add task" button and status `<select>` when `canUpdate` is false

## Blockers
- [x] PASS — Recording a blocker on an ON_TRACK project immediately flips health to BLOCKED
- [x] PASS — Recording a blocker while an overdue milestone also exists: health is BLOCKED (verified via GET /api/v1/projects/[id]), confirming BLOCKED > DELAYED priority in `computeProjectHealth`
- [x] PASS — Resolving a blocker (with resolutionNotes) sets `resolvedAt`/`resolvedById`/`resolutionNotes`; GET `/blockers` returns unresolved blockers first, resolved ones after (verified with 2 blockers: one left unresolved, one resolved — unresolved item listed first)
- [x] PASS — After resolving the only active blocker while an overdue milestone still exists, health fell back to DELAYED (not ON_TRACK) — exact documented behavior confirmed
- [x] PASS — After resolving the only blocker with no other outstanding issues (no overdue/at-risk milestones), health fell back to ON_TRACK
- [x] PASS — BUSINESS_OWNER and MANAGEMENT both get 403 `FORBIDDEN` (`RECORD_BLOCKER`) on POST `/blockers`; UI (`ProjectBlockersPanel.tsx`) hides the record form when `canRecord` is false
- [x] PASS — BUSINESS_OWNER and MANAGEMENT both get 403 `FORBIDDEN` (`RESOLVE_BLOCKER`) on PATCH `/blockers/[id]` with `resolve:true`; UI hides the "Resolve" button when `canResolve` is false
- [x] PASS — Unresolved blockers list before resolved blockers list, confirmed via GET (see above)

## Files
- [x] PASS — Uploaded a real PDF (1MB, under the 20MB limit) via presign-upload → PUT to the presigned S3/MinIO URL → POST `/api/v1/documents` to create the row. Confirmed in DB: correct `fileName` ("spec.pdf"), `sizeBytes` (1048576), `uploadedById` (the uploading analyst)
- [x] PASS — POST `/api/v1/documents/presign-upload` with `contentType: "application/x-msdownload"` (disallowed) returns 400 `DOCUMENT_VALIDATION_ERROR` with a clear message listing the allowlist — not a 500. Client-side `lib/upload-constraints.ts` / `validateUploadFile()` mirrors the same allowlist and is wired into `components/ui/DocumentUpload.tsx` for pre-flight rejection
- [x] PASS — POST `/api/v1/documents/presign-upload` with `sizeBytes: 26214400` (>20MB) returns 400 `VALIDATION_ERROR` ("Number must be less than or equal to 20971520") — clean Zod rejection, not a 500. (Note: this is caught by the Zod schema's `.max(MAX_UPLOAD_SIZE_BYTES)` before ever reaching `lib/documents.ts`'s own size check, so the friendlier `DocumentValidationError` message never fires for this exact field, but the request is still safely and clearly rejected.)
- [ ] FAIL — Downloading an uploaded file does NOT work for anyone, including roles that should always be authorized. See bug #1 below.
- [x] PASS (as a consequence of bug #1) — A non-participant is indeed denied download (403), but so is every participant and even AI_TEAM_LEAD/MANAGEMENT — the checker fails closed unconditionally, so this specific behavior (deny non-participants) is not meaningfully verifiable in isolation from bug #1.

### Bugs found

**#1 (not fixed — needs a real re-architecture, out of scope for a QA hotfix): `POST /api/v1/documents/presign-download` always returns 403 for every user, including project participants and AI_TEAM_LEAD/MANAGEMENT.**

Root cause: `lib/documents.ts` keeps its `downloadAuthzCheckers` registry as a
module-level `Map` (`const downloadAuthzCheckers = new Map(...)`), populated
once by `instrumentation.ts`'s `register()` hook at server boot. In this dev
environment (Next 16.3.4, Turbopack), each route handler module
(`app/api/v1/documents/presign-upload/route.ts`,
`app/api/v1/documents/[id]/presign-download/route.ts`, etc.) gets its own
freshly-evaluated instance of `lib/documents.ts` per request — confirmed by
temporarily logging a random instance ID at module-scope and seeing a
different ID on every request to different (and the same) route handlers.
Because of this, the `Map` that `instrumentation.ts` populated is never the
same `Map` instance that `isAuthorizedToDownload()` reads from inside the
route handler — so `downloadAuthzCheckers.get("PROJECT")` is always
`undefined`, and the documented fail-closed behavior ("no checker
registered ⇒ deny") applies to literally every request, defeating the
entire "PROJECT" authorization rule registered in `instrumentation.ts`.

Repro:
```
# any logged-in user, any document
curl -s -b <cookiejar> "http://localhost:3000/api/v1/documents/<documentId>/presign-download"
# => {"success":false,"data":null,"error":{"code":"FORBIDDEN","message":"You are not authorized to download this document."}}
# even for AI_TEAM_LEAD, whose checker branch is `if (user.role === "AI_TEAM_LEAD" ...) return true` unconditionally
```

Expected: a project participant (owner/analyst/developer, same-department
BUSINESS_OWNER, or AI_TEAM_LEAD/MANAGEMENT) gets a valid presigned download
URL (200); a non-participant gets 403.

Actual: everyone gets 403, always — the `isProjectParticipant` rule
registered in `instrumentation.ts` never executes.

Why not fixed here: the correct fix requires re-architecting how the
authorization checker is wired up so it's guaranteed to live in the same
module instance the route handler reads from — e.g. calling
`registerDocumentDownloadAuthzChecker("PROJECT", ...)` directly from a
module that's already imported by the route handler itself (such as a
top-level side effect in `lib/project-authz.ts`, imported by
`app/api/v1/documents/[id]/presign-download/route.ts` transitively) instead
of relying on `instrumentation.ts`'s one-time boot hook plus a bare
module-level singleton `Map`. This is a structural/deployment-topology
issue, not a one-line fix, and changing it risks affecting how later
phases (CANDIDATE, APPLICATION, etc. `DocumentOwnerType`s, per the doc
comment in `lib/documents.ts`) are expected to register their own
checkers — so it needs a decision from whoever owns that pattern rather
than a QA-time patch. Given the instruction to only fix small, unambiguous,
safe bugs, this was left unfixed and is reported here instead.

Verification note: I added a temporary `console.log` inside
`isAuthorizedToDownload()` and at the top of `lib/documents.ts` to confirm
this diagnosis (checker `Map` keys were `[]` on every request, and the
module got a fresh random instance ID on every request), then reverted both
edits — `git diff lib/documents.ts` is clean, nothing was committed for this
bug.
