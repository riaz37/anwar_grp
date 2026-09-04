# Design System — Anwar AI ProjectFlow

Anwar AI ProjectFlow is an internal project-governance tool for Anwar Group's
AI and software initiatives (portfolio table, project workspace, joining
coordination, blockers/milestones/tasks). This document is the source of
truth for the visual system: colors, type, spacing, radius, elevation, and
the canonical component recipes. It is encoded exactly in `app/globals.css`
— do not add a palette entry or component variant without updating both
files together (see `CLAUDE.md`).

Source: ported from `agent-builder-frontend`'s `design.md` (a dark-theme,
black-surface + lime accent system extracted from its Figma file), adapted
to this app's real nav/data/auth. See the Decisions Log at the bottom for
why this replaced the earlier "Blueprint" (ultramarine) system.

---

## 1. Color

Dark is the default theme (`:root`); light is an override via
`[data-theme="light"]` on `<html>`, toggled by `next-themes`
(`attribute="data-theme"`).

### Surfaces

| Token | Dark | Light | Usage |
|---|---|---|---|
| `surface-shell` | `#000000` | `#ffffff` | App shell / outermost background |
| `surface-0` | `#070707` | `#ffffff` | Card/panel base |
| `surface-1` | `#111111` | `#f9f9fa` | Sidebar / modal background |
| `surface-2` | `#171717` | `#f4f4f6` | Secondary surface (search field, segmented track) |
| `surface-3` | `#212121` | `#ebecf0` | Tertiary surface (chips, cards) |
| `surface-4` | `#2d2d2d` | `#ebecf0` | Raised surface (active segmented item) |

### Text and accent

| Token | Dark | Light | Usage |
|---|---|---|---|
| `text-high` | `#ffffff` | `#0a0c11` | Primary text |
| `text-med` | `#ffffffb8` (~72%) | `#5b616d` | Secondary text |
| `text-low` | `#ffffff7a` (~48%) | `#767c86` | Tertiary text, placeholders |
| `primary-high` | `#f2fc80` | `#ecfa41` | Accent text (active nav label) |
| `primary-med` | `#f0fb67` | `#f0fb67` | Accent fill (buttons, toggle) — same in both themes |
| `primary-wash` | `#ecfa411f` (12%) | `#ecfa4166` (40%) | Tinted accent background |
| `primary-onaccent` | `#63691b` | `#63691b` | Text on an accent-filled surface |

One pigment: the lime accent. There is no second brand hue — `info-*` is a
genuinely distinct blue reserved for informational banners only, never used
for CTAs or active state.

### Outline / status

| Token | Dark | Light |
|---|---|---|
| `outline-base/low/med/high` | `#ffffff08/0f/17/1f` | `#00000008/0f/17/1f` |
| `warn-high/med/wash/outline` | `#ffd666` / `#ffab00` / 12% / 30% | `#8a5200` / `#ffab00` / 16% / 40% |
| `danger-high/med/wash/outline` | `#ffac82` / `#ff6a2f` / 12% / 30% | `#b71d18` / `#ff6a2f` / 12% / 32% |
| `info-high/med/wash/outline` | `#7dd3fc` / `#38bdf8` / 12% / 30% | `#0b6bcb` / `#38bdf8` / 16% / 40% |
| `success-high/med/wash/outline` | `#9efbcd` / `#13f584` / 12% / 30% | `#0a6c43` / `#13f584` / 16% / 40% |

Every status color follows the same recipe: `-wash` background + `-outline`
border + `-high` text form one badge/banner; `-med` is the solid fill for a
button or dot.

## 2. Typography

Font family: **Inter** everywhere (self-hosted `next/font/google`, variable
`--font-inter`), **Geist Mono** for every numeral compared against another
numeral (dates, counts, ageing days).

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
| `display-1` | fluid 26–34 | Page `<h1>` — not in the source scale, added since this app has real dashboard page titles the dense scale didn't cover |
| `metric` | fluid 24–30 | Stat readouts (counts, dashboard numbers) |

Weight: 500 = normal/body, 600 = labels/titles/emphasis. No third weight.
Letter spacing 0 except `display-1`/`metric` (-0.02em).

## 3. Spacing

4px-rooted, prefixed `ds-` to avoid colliding with Tailwind's built-in
spacing keys (which `max-w`/`min-w`/`w`/`h` also read from):
`xxs`(2) `xs`(4) `sm`(6) `md`(8) `lg`(10) `xl`(12) `2xl`(16) `4xl`(20)
`5xl`(24) `6xl`(28) `7xl`(32, modal padding) `9xl`(48, page-content padding).

## 4. Radius

One scale: `sm` 8px (small buttons), `md`/`lg` 10–12px (default controls,
inputs, tabs), `xl` 12px (cards, list containers), `2xl` 16px, `3xl` 20px
(feature cards), `5xl` 28px (modals — the most elevated surface always gets
the largest radius), `pill` fully rounded (avatars, chips, primary CTAs).

## 5. Elevation

Base shadow: `elevation-e1`/`e2` for flat buttons and cards, `e6` for the
most elevated surfaces (modals). Every interactive filled surface (buttons,
active nav item, pills) layers an outer drop-shadow **and** an inset
highlight — `shadow-primary-button` / `shadow-secondary-button` — giving the
glossy/tactile look. Don't skip the inset layer when adding a new filled
control. `shadow-input-inner` is a subtle inset for text inputs/search
fields.

## 6. Components

### Sidebar

304px fixed width, `surface-1` background, 1px `outline-low` right border.
Profile pill header (32px logo + wordmark). Nav items: 40px row, `rounded-lg`
(10px), icon + `body-1` label. Active state: `primary-wash` background,
`primary-high` label at 600 weight, `shadow-e1` + inset highlight. Bottom
block: logout item, profile row (gradient avatar, initials in
`primary-onaccent`), theme toggle (light/dark only — no fake third "system"
icon; `next-themes` already tracks OS preference on first load).

### Top bar

76px height, `outline-med` bottom border. Left: breadcrumb + page title.
Right: button group — one primary (accent fill + `shadow-primary-button`)
plus secondary actions (`surface-3` fill + `shadow-secondary-button`). Every
button: `h-8` (32px), `rounded-sm` (8px), `caption-2` weight-600 label,
optional 16px leading icon.

### Buttons — the only two variants

- **Primary/accent**: `primary-wash` bg, `primary-high` text,
  `shadow-primary-button`.
- **Secondary/neutral**: `surface-3` bg, `text-med` text,
  `shadow-secondary-button`.

### Cards / list items

Canonical "result card": tag pill (`primary-wash` bg, `primary-high` text) →
title (`title-1` weight-600) → description (`para`, `text-low`) → metadata
chip row → CTA row. Used for template pickers, project cards, and any list of
selectable items.

### Modals

Centered, `surface-1` background, 1px `outline-low` border, `rounded-5xl`,
`shadow-e6`. Structure: header (title + close), body, footer action row. This
is the one recipe every dialog/sheet in the app uses.

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

## 9. Accessibility

16px+ body text where practical, 4.5:1/3:1 contrast minimums (light-mode
`text-low` was darkened from the raw Figma value to clear AA), 44px touch
targets on mobile, full keyboard operability, visited-link color kept
distinct and scoped to prose (`.link`) only.

## Decisions Log

- **2026-09-03** — Replaced the "Blueprint" ultramarine system (hairline
  aesthetic, Schibsted Grotesk + Geist Mono, one blue pigment) with this
  system, ported from `agent-builder-frontend`'s Figma-sourced design.md, per
  explicit user direction to standardize on that project's design language
  and component library. Domain-specific pages from the source project
  (Calls, Telephony, AI Assistants, Flow Editor) were **not** ported — this
  app has no backend for any of that; only the token system, primitives, and
  shell/auth/card/modal patterns were adopted.
