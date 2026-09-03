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

## Milestones
- [ ] Adding a milestone with a future due date: health stays ON_TRACK (or AT_RISK if within 3 days — check both)
- [ ] Adding a milestone with a due date 1-2 days out: project health becomes AT_RISK
- [ ] Adding a milestone with a PAST due date: project health immediately becomes DELAYED, milestone shows "Overdue" pill in UI
- [ ] Marking an overdue milestone's status to DONE without a delay reason: PATCH returns 422 `DELAY_REASON_REQUIRED`, UI surfaces an inline prompt (not a silent failure)
- [ ] Submitting the delay-reason form (category + note) alongside the status change succeeds, milestone becomes DONE, `completedAt` is set
- [ ] Once a delay reason exists for a milestone, further edits to it (e.g. changing its name) do NOT re-prompt for a reason
- [ ] After the only overdue milestone is marked DONE, project health returns to ON_TRACK (assuming no other issues)
- [ ] A role without MANAGE_MILESTONES (e.g. DEVELOPER, BUSINESS_OWNER) cannot create/edit milestones via API (403); "Add milestone" is hidden in UI for that role
- [ ] Milestone list orders by due date ascending

## Tasks
- [ ] Adding a task (action + owner, no deadline) succeeds, deadline renders as "—" or similar, not "Invalid Date"
- [ ] Adding a task WITH a deadline and a `relatedMilestoneId` succeeds, milestone name shows next to the task
- [ ] Changing a task's status via the inline select works and persists (reload page, still shows new status)
- [ ] A role without UPDATE_TASK cannot create/update tasks (403); form/status-select hidden or disabled in UI

## Blockers
- [ ] Recording a blocker on a healthy (ON_TRACK) project immediately flips health to BLOCKED
- [ ] Recording a blocker on a project that ALSO has an overdue milestone: health is BLOCKED, not DELAYED (BLOCKED takes priority — verify via GET /api/v1/projects/[id])
- [ ] Resolving the blocker (with resolution notes) removes it from the "unresolved" list, moves it to "resolved"
- [ ] After resolving the ONLY blocker, if an overdue milestone still exists, health falls back to DELAYED (not ON_TRACK) — this is a specific documented behavior, verify it exactly
- [ ] After resolving the ONLY blocker with no other issues, health falls back to ON_TRACK
- [ ] A role without RECORD_BLOCKER (BUSINESS_OWNER, MANAGEMENT) cannot record a blocker (403); form hidden in UI
- [ ] A role without RESOLVE_BLOCKER (BUSINESS_OWNER, MANAGEMENT) cannot resolve one (403); "Resolve" button hidden/disabled in UI
- [ ] Unresolved blockers list before resolved blockers list in the UI

## Files
- [ ] Uploading a file (PDF or image, under the size limit) to a project succeeds, shows in the file list with correct name/size/uploader
- [ ] Uploading a disallowed file type is rejected client-side with a clear message (check `lib/upload-constraints.ts` for the allowlist first)
- [ ] Uploading an oversized file is rejected with a clear message
- [ ] Downloading an uploaded file works (click download, get a real presigned URL, file is fetchable)
- [ ] A user who is NOT a participant on the project (not owner/analyst/developer, not AI_TEAM_LEAD/MANAGEMENT, not same-department BUSINESS_OWNER) is denied download (403) — this exercises the `isProjectParticipant` authz checker registered in instrumentation.ts

### Bugs found
(none yet)
