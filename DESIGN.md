# Design System — Anwar AI ProjectFlow

Anwar AI ProjectFlow is an internal project-governance tool for Anwar Group's
AI and software initiatives (portfolio table, project workspace, joining
coordination, blockers/milestones/tasks). This document is the source of
truth for the visual system: colors, type, spacing, radius, elevation, and
the canonical component recipes. It is encoded exactly in `app/globals.css`
— do not add a palette entry or component variant without updating both
files together (see `CLAUDE.md`).

Light is the default theme, aimed at a non-technical management audience who
read this dashboard in daylight offices and paste screenshots into decks.
Dark is an opt-in override (`[data-theme="dark"]`, toggled by `next-themes`).
See the Decisions Log at the bottom for why this replaced the earlier
black-surface + lime-accent "agent-builder" system.

---

## 1. Color

### Surfaces

| Token | Light (default) | Dark | Usage |
|---|---|---|---|
| `surface-shell` | `#f7f8f9` | `#1d2125` | App shell / outermost background |
| `surface-0` | `#ffffff` | `#22272b` | Card/panel base |
| `surface-1` | `#ffffff` | `#22272b` | Sidebar / modal background |
| `surface-2` | `#f1f2f4` | `#282e33` | Secondary surface (search field, segmented track) |
| `surface-3` | `#dcdfe4` | `#38414a` | Tertiary surface (chips, cards) |
| `surface-4` | `#c1c7d0` | `#454f59` | Raised surface (active segmented item) |

The shell sits one step below the card (`#f7f8f9` vs. `#ffffff`) so a white
card visibly separates from the page instead of hard-cutting against a pure
white background — the same reason no surface in this system is `#ffffff`
everywhere or `#000000` anywhere.

### Text and accent

| Token | Light | Dark | Usage |
|---|---|---|---|
| `text-high` | `#172b4d` | `#dee4ea` | Primary text |
| `text-med` | `#44546f` | `#9fadbc` | Secondary text |
| `text-low` | `#7a869a` | `#7a869a` | Tertiary text, placeholders |
| `primary-high` | `#2e2c79` | `#b4b2ee` | Accent text (active nav label, links) |
| `primary-med` | `#3f3d9e` | `#8683dd` | Accent fill (buttons, toggle) |
| `primary-wash` | `rgba(63,61,158,.08)` | `rgba(134,131,221,.20)` | Tinted accent background |
| `primary-onaccent` | `#ffffff` | `#14132e` | Text on an accent-filled surface |

One pigment: **ink indigo** (hue ~260°), not a stock SaaS blue. Chosen
specifically to read as "governance software" rather than the generic
`#2563eb`/`#0c66e4` corporate-blue every dashboard defaults to, while
staying unambiguously professional and staying far enough from the
warn/danger/success hues below that it never gets mistaken for a status
color. `info-*` is a genuinely distinct teal, reserved for informational
banners only, never used for CTAs or active state. `link-visited` is a
distinct plum (`#8a3b6b` / `#d98cb8`) so a followed link is never confused
with the brand accent.

### Outline / status

| Token | Light | Dark |
|---|---|---|
| `outline-base/low/med/high` | `rgba(9,30,66,.04/.08/.14/.20)` | `rgba(255,255,255,.04/.08/.14/.20)` |
| `warn-high/med/wash/outline` | `#7f5f01` / `#ffab00` / 16% / 40% | `#ffc94a` / `#ffab00` / 16% / 40% |
| `danger-high/med/wash/outline` | `#ae2e24` / `#e2483d` / 12% / 32% | `#ff9c8f` / `#f15b50` / 16% / 40% |
| `info-high/med/wash/outline` | `#206a83` / `#2898bd` / 14% / 36% | `#6cc3e0` / `#42b2d7` / 16% / 40% |
| `success-high/med/wash/outline` | `#216e4e` / `#1f845a` / 14% / 36% | `#7ee2b8` / `#4bce97` / 16% / 40% |

Every status color follows the same recipe: `-wash` background + `-outline`
border + `-high` text form one badge/banner; `-med` is the solid fill for a
button or dot.

## 2. Typography

Font family: **Inter** everywhere (self-hosted `next/font/google`, variable
`--font-inter`), **Geist Mono** for every numeral compared against another
numeral (dates, counts, ageing days). Unchanged from the prior system — the
scale was never lime-specific and already reads as a serious data product.

| Token | Size / line-height | Usage |
|---|---|---|
| `caption-1` | 11 / 16 | Sidebar section labels, uppercase micro-labels |
| `caption-2` | 12 / 16 | Segmented control labels, small buttons, avatar initials |
| `body-1` | 13 / 24 | Default UI text — nav items, buttons, table cells |
| `body-2` | 15 / 24 | Input text, onboarding-style CTA labels |
| `para` | 13 / 20 | Multi-line description text |
| `title-1` | 15 / 24 | Card titles |
| `heading-1` | 22 / 32 | Panel titles |
| `heading-2` | 26 / 32 | Modal titles |
| `display-1` | fluid 26–34 | Page `<h1>` |
| `display-hero` | fluid 38–104 | **Marketing only.** The landing-page `<h1>` |
| `display-2` | fluid 30–60 | **Marketing only.** Landing-page section `<h2>` |
| `metric` | fluid 24–30 | Stat readouts (counts, dashboard numbers) |

`display-hero`/`display-2` are scoped by convention to the `(marketing)`
route group and must not appear in `(dashboard)`.

Weight: 500 = normal/body, 600 = labels/titles/emphasis. No third weight.
Letter spacing 0 except `display-1`/`metric` (-0.02em).

## 3. Spacing

4px-rooted, prefixed `ds-` to avoid colliding with Tailwind's built-in
spacing keys (which `max-w`/`min-w`/`w`/`h` also read from):
`xxs`(2) `xs`(4) `sm`(6) `md`(8) `lg`(10) `xl`(12) `2xl`(16) `4xl`(20)
`5xl`(24) `6xl`(28) `7xl`(32, modal padding) `9xl`(48, page-content padding).

## 4. Radius

Small and mostly-square — the deliberate tell against "AI slop" pill
buttons. `sm` 4px (small buttons), `md`/`lg` 6px (default controls, inputs,
tabs — this is the one radius most of the app's chrome uses), `xl` 8px
(cards, list containers), `2xl` 10px, `3xl` 12px (feature cards), `5xl` 16px
(modals — the most elevated surface still gets the largest radius, just a
smaller one than before). `pill` fully rounded survives only where it always
meant something else: avatars, status dots/chips, and marketing hero CTAs —
**never a default button.**

## 5. Elevation

Flat by design: no glossy inset highlight on filled controls (the previous
system's `shadow-primary-button` layered an inner highlight for a
tactile/glossy look — that read as an app trying to look expensive, not a
tool a manager trusts). `--shadow-primary-button` and
`--shadow-secondary-button` now resolve to `none`; a button's affordance
comes from its background/border color and a `hover:brightness` shift, not a
shadow. Cards and modals still use a real elevation scale
(`elevation-e1`/`e2` for flat cards, `e6` for modals) — a soft, single-source
drop shadow, not a glow.

## 6. Components

### Sidebar

304px fixed width, `surface-1` background, 1px `outline-low` right border.
Profile pill header (32px logo + wordmark). Nav items: 40px row, `rounded-lg`
(6px), icon + `body-1` label. Active state: `primary-wash` background,
`primary-high` label at 600 weight. Bottom block: logout item, profile row
(initials in `primary-onaccent`), theme toggle (light/dark only — no fake
third "system" icon; light is the fixed default).

### Top bar

76px height, `outline-med` bottom border. Left: breadcrumb + page title.
Right: button group — one primary (solid `primary-med` fill, white text)
plus secondary actions (`surface-2` fill + border). Every button: `h-8`
(32px), `rounded-sm` (4px), `caption-2` weight-600 label, optional 16px
leading icon.

### Buttons — the only two variants

- **Primary/accent**: solid `primary-med` fill, `primary-onaccent` text. No
  shadow.
- **Secondary/neutral**: `surface-2`/`surface-3` bg, `text-med` text,
  hairline border.

Never pill-shaped, never glossy. A button reads as clickable through color
contrast and a subtle `hover:brightness` shift, not a highlight.

### Cards / list items

Canonical "result card": tag pill (`primary-wash` bg, `primary-high` text) →
title (`title-1` weight-600) → description (`para`, `text-low`) → metadata
chip row → CTA row. Used for template pickers, project cards, and any list of
selectable items.

### Modals

Centered, `surface-1` background, 1px `outline-low` border, `rounded-5xl`
(16px), `shadow-e6`. Structure: header (title + close), body, footer action
row. This is the one recipe every dialog/sheet in the app uses.

### Tables

`surface-1` rows, `outline-low` row dividers, `tabular-nums` on every numeric
column, sortable headers use a chevron affordance, not a full re-render of
the header cell.

## 7. Layout

12-col grid ≥1024px; icon-only rail 768–1023px; bottom tab bar + slide-out
sheet <768px. Max widths: `container-shell` 1440px (dashboards/tables),
`container-form` 576px (modals/forms), `container-page` 1180px (marketing).
Nav: Home, Portfolio, Management Dashboard, My Work.

## 8. Motion

Transform/opacity only. `ease-enter`/`ease-exit`/`ease-move` cubic-beziers,
100/200/300/500ms duration bands. Full `prefers-reduced-motion` kill-switch —
durations and delays both zeroed, entrance animations dropped to their
resting (visible) state rather than merely sped up.

There is **no animation library** in this app and none should be added. The
marketing route group's motion is four CSS utilities in `globals.css`, all
stagger-driven by a `--i` custom property:

| Utility | Effect |
|---|---|
| `.rise-in` | One-shot entrance, already used across the app |
| `.word-mask` | Per-word clipping box; the child unrolls from beneath it (landing `<h1>`) |
| `[data-reveal]` | Scroll-triggered fade/rise, armed by `components/marketing/ScrollReveal.tsx` |
| `.glare-sweep` | One specular pass across an elevated showcase panel |
| `.glow-parallax` | Scroll parallax via `animation-timeline: view()`, behind `@supports` |

**Fails visible.** `[data-reveal]`'s hidden state is scoped to a
`.reveal-armed` class that `ScrollReveal` only adds after mounting and
confirming `IntersectionObserver`. A script failure, an old browser, reduced
motion, or a crawler therefore all get the fully-rendered page — no content
on a public page may ever depend on JavaScript to become visible.

Decorative light (`components/marketing/GlowField.tsx`, and the cropped
glows in sections 03 and Access) is the one place raw `rgba()` accent paint
is allowed: it is a light rig, not a semantic colour, and no token names
"the brand pigment at 14%". It is always `aria-hidden`,
`pointer-events-none`, behind content, and dimmed hard under
`[data-theme="light"]` where an indigo wash would eat body-copy contrast.

## 9. Accessibility

16px+ body text where practical, 4.5:1/3:1 contrast minimums (`primary-high`
and every status `-high` value were checked against both surface-0 and
surface-1, not just against white), 44px touch targets on mobile, full
keyboard operability, visited-link color kept distinct and scoped to prose
(`.link`) only.

## Decisions Log

- **2026-09-13** — Replaced the black-surface + lime-accent "agent-builder"
  system with this one, per explicit user direction: the tool serves a
  non-technical management audience and needed to read as professional
  (light-default, Jira/Atlassian-register) rather than as an AI-startup demo.
  Dropped the lime pigment entirely (no residual "secondary" use). The first
  accent pick (a flat `#0c66e4` corporate blue) was rejected as generic
  off-the-shelf SaaS blue; replaced with an ink-indigo (`#3f3d9e` / hue
  ~260°) chosen for distinctiveness and separation from the status hues.
  Radius scale shrunk (12px → 6px default) and pill buttons were retired in
  favor of small-radius rectangles; button/card shadows were flattened
  (no glossy inset highlight) to match the calmer, flatter register.
- **2026-09-12** — Light-theme `primary-high` darkened from the raw Figma
  `#ecfa41` to `#6b7a12` for AA text contrast. (Superseded by the palette
  replacement above — kept here for history.)
- **2026-09-03** — Replaced the "Blueprint" ultramarine system (hairline
  aesthetic, Schibsted Grotesk + Geist Mono, one blue pigment) with the
  black+lime "agent-builder" system, per explicit user direction at the
  time. (Superseded by the 2026-09-13 entry above.)
