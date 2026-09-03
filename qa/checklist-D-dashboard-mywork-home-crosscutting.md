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
- [ ] Only AI_TEAM_LEAD / MANAGEMENT can view it — other roles are redirected (page) / 403 (API)
- [ ] "Needs attention" section lists every project with health BLOCKED or DELAYED, sorted BLOCKED first
- [ ] For a BLOCKED project, the shown "reason" is the oldest unresolved blocker's description — verify against the actual DB row, not just "a" description
- [ ] For a DELAYED project, the shown "reason" is the most-overdue milestone's name
- [ ] `needsDelayReason` flag is FALSE for a delayed milestone that already has a DelayReason recorded (this was a bug fixed earlier in the build — re-verify it's actually correct in the live UI, not just in the route source)
- [ ] `totalActiveProjects` excludes COMPLETED projects — verify by completing a project (or using one already at COMPLETED from the earlier prototype-journey walk) and confirming the count doesn't include it
- [ ] "Projects by stage" counts sum to the total number of projects across all stages (cross-check against the portfolio page's total row count)
- [ ] "Projects by health" counts sum to the total number of projects
- [ ] "Expected this month" only lists projects whose expectedDeliveryDate falls in the current calendar month
- [ ] "Upcoming milestones" only lists non-DONE milestones due within 7 days
- [ ] "Overdue milestones" only lists non-DONE milestones with a past due date
- [ ] Analyst/developer workload counts match the number of active (non-COMPLETED) projects each is assigned to — spot check one analyst by counting manually

## My Work (`/my-work`, `GET /api/v1/my-work`)
- [ ] Logged in as a user assigned to at least one project (owner/analyst/developer): that project appears under "Your projects"
- [ ] Logged in as a user assigned to NO active projects: empty state renders, not a blank/broken page
- [ ] Open tasks list only shows tasks owned by the current user with status != DONE
- [ ] Open milestones list only shows milestones owned by the current user with status != DONE, overdue/at-risk pills are accurate

## Home (`/`)
- [ ] Loads for every role without error
- [ ] Open task/milestone counts match what `/my-work` shows for the same user
- [ ] "Needs attention" summary only shows for roles with VIEW_MANAGEMENT_DASHBOARD (AI_TEAM_LEAD/MANAGEMENT) — hidden for others
- [ ] Links to `/my-work`, `/dashboard` (if shown), `/projects` all work

## Cross-cutting
- [ ] Check browser console for JS errors / React hydration warnings on: `/`, `/projects`, `/projects/new`, `/projects/[id]` (all 6 tabs), `/dashboard`, `/my-work` — use gstack browse ($B) for this, not curl, since console errors only show in a real browser
- [ ] Mobile viewport (375x812): nav, portfolio table, and project workspace tabs are usable, not visually broken (SegmentedTrack, SectionTabs specifically — they were built with responsive behavior in mind, verify it)
- [ ] Every list/table has a real empty state somewhere in the app (not literally checked already by another lane) — spot check one you haven't seen covered
- [ ] Try an obviously malformed request against 2-3 API routes (missing required field, wrong type) and confirm a clean 400 VALIDATION_ERROR envelope, not a 500

### Bugs found
(none yet)
