# Design System — Anwar TalentFlow

## Product Context
- **What this is:** A low-friction Talent Acquisition coordination system —
  one recruiter, one current stage, one next action/owner/due-date per
  active application, visible by role.
- **Who it's for:** TA administrators, recruiters, department heads/hiring
  managers, interview panelists, HR leadership, authorized audit users,
  technical administrators.
- **Space/industry:** Internal HR/recruiting ops tooling (category peers:
  Greenhouse, Lever, Workday Recruiting, BambooHR).
- **Project type:** Internal web app — dense data workspace + role-based
  dashboards, not a marketing site.

## Aesthetic Direction
- **Direction:** Industrial/Utilitarian — function-first, data-dense, muted
  palette.
- **Decoration level:** Minimal — typography and spacing do the work; status
  color is reserved for meaning, never decoration.
- **Mood:** Calm and trustworthy. This is a coordination layer over an
  existing manual process (Sec 1 of the assignment spec), not a
  feature-flexing ATS competing on breadth — the UI should feel like a
  well-organized shared source of truth, not enterprise software performing
  its own importance.
- **Reference sites:** Greenhouse, Lever (candidate-profile consolidation,
  pipeline-stage visualization — safe/category-convention choices).

## Typography
- **Display/Hero:** General Sans — clean grotesk, quiet personality, avoids
  the default-Inter "gave up on typography" signal.
- **Body:** Instrument Sans — warm, highly legible, restrained.
- **UI/Labels:** same as body (Instrument Sans).
- **Data/Tables:** Geist, `font-variant-numeric: tabular-nums` — built for
  numeric alignment (stage counts, scores, ageing days, dashboard metrics).
- **Code/config views:** IBM Plex Mono (approval-chain config JSON,
  audit-log detail views for technical/audit roles).
- **Loading:** Fontshare CDN for General Sans/Instrument Sans
  (`https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600&f[]=instrument-sans@400,500,600`),
  Google Fonts for Geist and IBM Plex Mono.
- **Scale:** 12px (caption/meta) · 14px (body-small, table rows) · 16px
  (body default) · 18px (subheading) · 22px (section heading) · 28px (page
  title) · 36px (rare, dashboard hero stat only).

## Color
- **Approach:** Restrained — one accent, semantic colors reserved for
  status meaning, not decoration.
- **Primary/accent:** `#B5793A` (warm ochre/brass) — primary actions,
  links, focus states. Deliberate departure from default enterprise-SaaS
  blue, to avoid TalentFlow reading as "generic ATS #5."
- **Neutrals (light):** background `#FAFAF8` (warm off-white, not stark
  white), surface `#FFFFFF`, primary text `#1A1A1E`, muted text `#6B6B74`,
  border `#E4E2DD`.
- **Neutrals (dark):** background `#14131A`, surface `#1C1B24`, primary
  text `#EDEDF0`, muted text `#9A98A3`, border `#2E2C38`.
- **Semantic:** success `#2F7D5C` (muted green — e.g. Delivered, Filled,
  Joined), warning `#B8862F` (muted ochre-adjacent, distinguishable from
  accent — e.g. overdue, awaiting approval), error `#B23B3B` (muted red,
  not alarm-red — e.g. Failed, Rejected), info `#3D6E96` (muted blue — e.g.
  On Hold, informational banners).
- **Dark mode:** redesign surfaces (not just inverted), reduce saturation
  ~15% on all semantic colors to avoid glare in low-light use.

## Spacing
- **Base unit:** 8px.
- **Density:** Comfortable by default. Compact-mode toggle deferred to
  TODOS.md (2026 dashboard-UX research shows power users doing high-volume
  queue processing want it, but it's not MVP-blocking).
- **Scale:** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64).

## Layout
- **Approach:** Grid-disciplined — strict columns, predictable alignment.
  Not a place for creative/editorial layout; Sec 7 of the assignment spec
  already fixes a 9-item nav structure (Home, My Tasks, Requisitions,
  Candidates, Interviews, Messages, Joining, Reports, Administration) that
  the layout serves, not reinterprets.
- **Grid:** 12-column on desktop (≥1024px), single-column stacked with
  persistent left rail collapsed to icons on tablet (768–1023px), bottom
  bar (Home/My Tasks/Candidates) + slide-out drawer for the rest on mobile
  (<768px) — locked in `/plan-design-review`.
- **Max content width:** 1440px (dashboards/tables can use full width
  within this; forms and detail panels cap at 720px for readability).
- **Border radius:** sm 4px (inputs, pills), md 8px (cards, panels), lg
  12px (modals), full 9999px (status pills, avatars only).

## Motion
- **Approach:** Minimal-functional — only transitions that aid
  comprehension: stage-change confirmation, the inline conflict banner
  appearing (see `/plan-design-review` decision on optimistic-locking UX),
  message-status badge updates. No decorative animation, no scroll
  choreography — this is a calm ops tool, not a marketing surface.
- **Easing:** enter `ease-out`, exit `ease-in`, move `ease-in-out`.
- **Duration:** micro 50–100ms (hover, focus ring), short 150–250ms (banner
  appear, badge update), medium 250–400ms (panel/drawer open), long
  400–700ms (page transition, rare).

## Accessibility (from `/plan-design-review`)
- Body text ≥16px, contrast ≥4.5:1 in both light and dark mode.
- Touch targets ≥44px on all message-approval and joining-checklist action
  buttons.
- Keyboard nav: every approval/decision action reachable and triggerable
  without a mouse.
- Stage-change and conflict-banner events use an ARIA live region so
  status changes are announced, not just visually shown.
- Visited vs. unvisited link distinction preserved everywhere.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-02 | Initial design system created | Created by `/design-consultation` based on the Anwar TalentFlow assignment spec, the `/plan-eng-review` architecture decisions, and the `/plan-design-review` structural UX decisions (task-first Home, calm register, inline conflict banner, mobile nav, candidate tab-strip). Research: Greenhouse/Lever category conventions + 2026 dashboard-UX trends (WebSearch, see build-plan doc). |
| 2026-09-02 | Skipped AI-mockup preview (Phase 5) | `$D` (gstack designer) needs an OpenAI API key not configured in this environment; user opted to skip the HTML-preview fallback too and write DESIGN.md directly from the Phase 3 proposal. |
