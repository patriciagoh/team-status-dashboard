# Handoff: Team Status Dashboard — "Command View" (Matcha Oat)

## Overview

A **twice-daily, read-only dashboard** that answers one question for managers and
leadership: **"What is each person working on right now, why, and what changed since
the last look?"** — sourced from Linear (and, optionally, Slack). It replaces clicking
through Linear with a single roster that classifies every person's current work and
surfaces who is off-plan or firefighting.

This package documents the **"Command View"** design direction: a dense, above-the-fold
single-table layout, styled with the **Matcha Oat** design system. It ships in three
interchangeable visual themes — **Paper** (default), **Terminal** (dark), and
**Editorial** (serif/yolk magazine).

The product is explicitly **not** a productivity scorecard and **not** time tracking. It
describes *what* and *why*, never *how much* or *how well*. Tone is neutral and
descriptive; low-confidence inferences read as tentative, and any person can correct
their own row.

---

## About the design files

The files in this bundle are **design references created in HTML + React (inline
Babel)** — a working prototype showing the intended look and behavior. They are **not
production code to ship directly.**

The task is to **recreate this design in the target codebase's environment** (React,
Vue, Svelte, etc.) using its established component primitives and patterns. The existing
data backend already produces the roster (a Python pipeline → snapshot JSON → classified
roster; see "Data contract" below) — this design is the **renderer / front-end** for
that roster. If no front-end environment exists yet, pick the most appropriate framework
and implement there.

The single most reusable artifact is **`tokens.css`** — the complete Matcha Oat design
tokens as CSS custom properties. Map these into whatever theming mechanism the target
uses (Tailwind `theme.extend`, CSS-in-JS theme object, design-token JSON, etc.).

## Fidelity

**High-fidelity.** All colors, typography, spacing, radii, shadows, and interaction
timings are final and exact. Recreate the UI pixel-faithfully using the codebase's own
component primitives. Exact values are listed under "Design tokens" and per-component
specs under "Screens / components".

---

## Screens / Views

There is **one screen**: the Team Status dashboard. Width is fluid; the prototype is
designed at **1440px** content width (`max-width: 1440px`, centered). Below that it
reflows; the central "Working on" column is the only flexible (`1fr`) column.

Vertical structure, top to bottom:

1. **Header bar**
2. **Summary strip** (key stats + "Where the effort is going")
3. **Roster table** (grouped by team, with per-team overview rows and expandable person rows)

### 1. Header bar
- Flex row, space-between, vertically centered.
- **Left:** `h1` "Team status" in Newsreader serif 26px / weight 400 / tracking −0.02em
  (`--ink`), followed by a Space Mono 12px caption "/ engineering · 26 people"
  (`--muted`), baseline-aligned, 12px gap.
- **Right (snapshot freshness):** a small matcha dot (7px, `--matcha`) that **pulses**
  (see Motion), then Space Mono 12px 700 "Snapshot · Tuesday 9:02 AM ET" (`--ink-2`),
  then Space Mono 12px 400 "next refresh 2:00 PM ET" (`--muted`). 14px gap.

### 2. Summary strip
- CSS grid, `grid-template-columns: auto 1fr`, 32px gap, vertically centered.
- Container padding for the whole page: `38px 48px 44px`.

**2a. Key stats (left cell)** — a flex row, 34px gap, with a 1px right divider
(`--line-2`) and 34px right padding. Four stat tiles, each a vertical stack (5px gap):
  - Big number: **Hanken Grotesk 700, 38px, tracking −0.03em.**
  - Label: Hanken Grotesk 600, 10.5px, tracking 0.1em, UPPERCASE, `--muted`.
  - The four tiles + number color:
    - `15` **on plan** — `--ink`
    - `3` **off plan** — `--yolk-deep`
    - `2` **firefighting** — `--rust-deep`
    - `9` **changed** — `--ink`

**2b. "Where the effort is going" (right cell)** — a typographic breakdown, **no chart**:
  - Eyebrow: Hanken 600, 10px, tracking 0.13em, UPPERCASE, `--muted`, 12px below.
  - A flex row bounded **top and bottom by 1px `--line` hairlines**. One item per
    non-zero category (in calm→urgent order), each separated by a 1px `--line` right
    divider, `13px 22px 13px 0` padding, 22px right margin.
  - Each item: a baseline row with a big count (**Hanken 700, 24px, tracking −0.03em**) +
    a Space Mono 11px percentage (`--muted`); below it the category label (Hanken 600,
    10.5px, tracking 0.1em, UPPERCASE, `--muted`).
  - **Count color = signal only:** planned → `--matcha-deep`; unplanned → `--yolk-deep`;
    incident → `--rust-deep`; all others → `--ink`. (This is the core color rule — see
    "Color is reserved for signal".)

### 3. Roster table
- A single card: `--paper` bg, 1px `--line-2` border, **16px radius**, `overflow:hidden`,
  no resting shadow. 24px top margin.

**3a. Column header row** — grid, `grid-template-columns: 34px 196px 1fr 132px 150px 86px`,
16px gap, `11px 16px` padding, `--oat` bg, 1px `--line-2` bottom border. Labels: Hanken
600, 10px, tracking 0.12em, UPPERCASE, `--muted`. Columns: `#`, `Person`, `Working on`,
`Why`, `Since last look`, `Ticket` (last is right-aligned).

**3b. Team overview row** (one per team, replaces the old per-team cards) — a flex row,
18px gap, `15px 16px 14px` padding, `--oat` bg, 1px `--line` bottom border, and a 1px
`--line-2` top border between teams. Contents left→right:
  - Team name: **Hanken 700, 12px, tracking 0.14em, UPPERCASE, `--matcha-deep`** + a Space
    Mono 11px headcount (`--muted`).
  - **Tally:** non-zero categories as "count + label" pairs (Space Mono 13px 700 count,
    color = signal rule above; Hanken 400 11.5px lowercase label `--muted`).
  - A flexible 1px `--line` hairline rule that fills remaining space.
  - **Off-plan callout** (right): Space Mono 11px 700 — "{n} off-plan" in `--rust-deep`
    if any incident/unplanned, else "all on plan" in `--matcha-deep`.

**3c. Person row** — grid, same `34px 196px 1fr 132px 150px 86px` template, 16px gap,
`11px 16px` padding (`13px 16px` in Editorial theme), `cursor:pointer`. Bottom border 1px
`--line` (none on last row). Cells:
  - **# index:** Space Mono 400 12.5px `--muted`, tabular-nums, zero-padded ("01").
  - **Person:** avatar (26px circle, see below) + name (Newsreader 500, 15px, `--ink`,
    nowrap) + role (Space Mono 10px, `--muted`).
  - **Working on:** the current work, ellipsis-truncated single line. **Normal
    confidence:** Hanken 400, 13.5px, `--ink`. **Low confidence:** Newsreader *italic*
    400, 13.5px, `--matcha-deep`, prefixed with a muted italic "~ " — this is the
    tentative treatment.
  - **Why:** a category chip (see Chip spec).
  - **Since last look:** if changed, a Space Mono 11px 700 note (`--ink-2`) with a 5px
    leading dot (`--matcha` if "new this snapshot", else `--yolk`); if unchanged, Space
    Mono 11px "no change" (`--muted`).
  - **Ticket:** Space Mono 11px 700, `--matcha-deep`, right-aligned (em-dash if none),
    plus a hover-only "→" arrow (`--matcha-deep`, fades in).

**3d. Expanded person row** (on click) — a panel, `4px 14px 18px 52px` padding, `--oat`
bg. Inside: a card (`--paper`, 1px `--line` border, 8px radius, `15px 18px` padding) as a
2-column grid (1fr 1fr, 24px gap):
  - **Left — "Open items":** eyebrow (Hanken 600 10px tracking 0.13em UPPERCASE `--muted`)
    then a list of tickets (Space Mono 13px `--ink-2`, each with a 4px `--matcha` dot).
  - **Right — "Why" block (signature device):** a **`--yolk-tint` block**, 1px `#EAD9AE`
    border, 8px radius, `13px 16px` padding. Label "WHY" (Hanken 700, 10.5px, tracking
    0.16em, UPPERCASE, `--yolk-deep`); body (**Hanken 400, 14.5px, `--yolk-tint-text`
    `#6A5320`** — note: **sans, not serif**). Below the block: the low-confidence tag (if
    applicable) and a text button "Correct {firstName}'s row →" (Hanken 600 12px
    `--matcha-deep`; arrow nudges +4px on hover).

#### Avatar
26px (24–34px depending on context) circle, `--paper` bg, **1.5px border colored by the
person's category dot**, initials in Space Mono 700 (~⅓ of size), `--ink-2`. Initials are
a privacy-light abbreviation (first name + last initial → "Maya R." shows "MR").

#### Category chip (`.d2-chip` style)
Pill (`border-radius: 999px`), inline-flex, 7px gap, `5px 13px 5px 11px` padding,
**Space Mono 700, 12px**, 1px border, with a 7px leading category dot. Field color is
**reserved for signal**:
  - **incident** → bg `--rust-tint` (#F6E2DA), text `--rust-deep`, border #EBC9BD
  - **unplanned** → bg `--yolk-tint`, text #6A5320, border #EAD9AE
  - **planned** → bg `--matcha-tint`, text `--matcha-deep`, border #DBE3CF
  - **support** → bg #EDEADD, text #6C6647, border #DCD6C3 (warm neutral)
  - **lent-out** → bg #F1EFE9, text `--ink-2`, border `--line-2`
  - **ad-hoc** → bg `--paper`, text `--ink-2`, border `--line-2`

---

## The six work categories

Order is **calm → urgent** (drives the breakdown + tally ordering). Each category has a
small "language dot" color, always shown next to a text label (hue is never the only cue).

| key | label | dot hex | signal | meaning |
|---|---|---|---|---|
| `planned` | Planned | `#6E8B57` matcha | calm | On the roadmap / current cycle |
| `adhoc` | Ad-hoc | `#A8B58F` sage | calm | No-ticket request, picked up directly |
| `lent` | Lent-out | `#C7BDA6` taupe | neutral | Helping another team this cycle |
| `support` | Support | `#8E8569` olive | neutral | Customer escalation / on rotation |
| `unplanned` | Unplanned | `#E8B23C` yolk | **attention** | Off-plan work that appeared this cycle |
| `incident` | Incident | `#C0533A` rust | **urgent** | Active incident / outage response |

**"Off-plan" = incident + unplanned. "Firefighting" = incident only.**

Each person also carries a **confidence**: `high` or `low`. Low-confidence rows are
inferred (e.g. from commit activity or a Sentry assignment, not a board) and must read as
tentative: italic serif "Working on" text + a dashed "inferred · low confidence" tag.

---

## Color is reserved for signal (core rule)

Matcha Oat is "one accent, used sparingly." In this dashboard, **color carries meaning,
not decoration**:
- **Planned** work is calm matcha green (the good baseline).
- **Unplanned** uses the yolk accent (attention).
- **Incident** uses rust (urgent) — so firefighting visually floats up.
- **Support / lent-out / ad-hoc** ride small warm-neutral dots + labels, no loud fields.

Do **not** reintroduce a multi-color stacked bar or a cool blue. The distribution is
shown **typographically** (counts), never as a rainbow chart.

---

## Interactions & behavior

All motion uses plain `ease`; nothing bounces. Timing vocabulary (from Matcha Oat):
- `.18s` color-only shifts · `.20s` lifts/arrows/buttons · `.22s` row slide+wash · `.25s` underline grow.

- **Row hover:** background fills with a left→right yolk wash
  `linear-gradient(90deg, rgba(232,178,60,0.16), rgba(232,178,60,0) 60%)`, the row slides
  right `translateX(5px)`, and the trailing "→" fades in. Transition `.22s`. (Row's parent
  has `overflow:hidden` so the slide clips cleanly.)
- **Row click:** toggles the expanded panel; trailing glyph swaps "→" → "⌄"; row keeps a
  static `rowHover` background while open.
- **Team overview-card hover** (only in the older card variant, now replaced by rows):
  lift `translateY(-3px)` + brown shadow.
- **Snapshot dot:** ambient matcha pulse ring — `@keyframes` box-shadow 0 → 9px spread of
  `rgba(110,139,87,...)`, 2s ease-out infinite. **Gate behind
  `@media (prefers-reduced-motion: reduce)` → animation: none.**
- **"Correct … row →" button:** arrow nudges `translateX(4px)` on hover (.2s).
- **Inline link / email:** yolk underline grows; arrow slides.

No real-time updates — the page represents one snapshot (refreshed twice daily by the
backend). Everything is read-only except the per-person "correct my row" affordance.

---

## State management

The view is essentially **stateless / data-driven** apart from per-row expand:
- **Input:** the classified roster (see Data contract). Shape per person: `{ name,
  initials, role, team, cat, conf, what, ticket, since, detail: { tickets[], note } }`.
- **Local UI state:** each row owns a boolean `open` (expanded). That's the only
  component state. Theme is a top-level prop (`paper` | `terminal` | `editorial`).
- **Derived values** (compute once from the roster): per-category counts; totals; `changed`
  = anyone with a `since` note; `offPlan` = incident+unplanned; `firefighting` = incident;
  per-team counts + off-plan count.
- **"Correct my row"** would post a correction keyed by person + date to the backend's
  corrections overlay (the inferred value is preserved underneath). Not wired in the mock.

---

## Data contract (how the roster is produced — for backend integration)

The existing tool is a Python pipeline; the design consumes its output. Pipeline:
`Linear API (+ Slack) → pull engine → snapshot JSON (one per run) → classify + diff →
roster`. Key rules the front-end relies on:
- **Classifier** assigns each person a category (`planned / unplanned / incident /
  support / lent-out / ad-hoc`) and a confidence (`high` / `low`). Incident/support
  override cycle membership.
- **Diff** compares the two latest snapshots → per-person "since you last looked" notes
  (e.g. "moved off PLAT-401 → incident", "new this snapshot") + a team summary.
- **Corrections** overlay (keyed by person + date) lets anyone adjust their own row; the
  inferred value is kept underneath.
- **Slack** enrichment (optional) fills only *empty* rows with ad-hoc / no-ticket work;
  never overrides a ticket.

`data.js` in this bundle is fictional demo data shaped exactly like the real roster — use
it as the integration fixture.

---

## Design tokens

Full set in **`tokens.css`**. Summary:

**Neutrals (warm):** `--oat #FAF7EF` (page) · `--paper #FFFFFF` (cards) · `--ink #23211B`
(primary text) · `--ink-2 #4C483E` (secondary) · `--muted #777165` (meta, AA 4.5:1) ·
`--line #E8E2D5` (hairlines) · `--line-2 #DAD3C3` (card borders).

**Matcha (brand):** `--matcha #6E8B57` (non-text: dots/rules) · `--matcha-deep #4E6B3A`
(green text, 5.6:1) · `--matcha-tint #EDF1E5` (fields, border #DBE3CF).

**Yolk (single accent):** `--yolk #E8B23C` (underlines/washes) · `--yolk-deep #8E6416`
("why" labels, 4.9:1) · `--yolk-tint #FBEDC6` (the "Why" block, text `#6A5320`).

**Rust (urgent signal):** `--rust #C0533A` · `--rust-deep #9A3D29` · `--rust-tint #F6E2DA`
(border #EBC9BD).

**Dark surface (Terminal theme):** `#26241D` (panel), see `TSD_THEMES.terminal` for the
full dark token map.

**Type:** `--serif` Newsreader (headlines, names — 400, italic for emphasis/low-confidence)
· `--sans` Hanken Grotesk (UI, body, big stat numbers — 400–700) · `--mono` Space Mono
(tickets, indices, timestamps, all numerals/stats — 400/700) · `--script` Sacramento
(signature moments only; unused here). Load via Google Fonts.

**Radii:** 8px (`--r-sm`, inputs/inner cards) · 12px (`--r-card`) · 14px (`--r-lg`, team
cards) · 16px (`--r-xl`, the table) · 999px (`--r-pill`, chips).

**Shadows (brown-tinted, never black, used only on hover):** card `0 14px 30px
rgba(60,50,30,0.10)`.

**Spacing:** 8pt rhythm. Page padding `38px 48px 44px`. Generous whitespace > density.

**Motion:** see Interactions. Easing is plain `ease`; honor `prefers-reduced-motion`.

---

## Themes

The same layout renders in three Matcha Oat treatments via a `theme` prop. The full
per-theme token maps live in `TSD_THEMES` (top of `CommandView.jsx`):
- **`paper`** — the default. Oat page, white table, matcha team eyebrows, hairline borders.
- **`terminal`** — dark "git-log" surface (`#26241D` panel on `#1B1A14` page), cream text;
  chips and signal colors are lightened for contrast (see `TSD_THEMES.terminal`).
- **`editorial`** — magazine: serif title with a yolk underline, a rotated washi-tape
  snapshot tag (`rgba(232,178,60,0.42)`, −1.5°), serif team names ruled in yolk.

---

## Assets

- **No image assets.** Avatars are initials in CSS circles; all dots/rules are CSS.
- **Fonts:** Newsreader, Hanken Grotesk, Space Mono (Google Fonts). Sacramento optional.
- **Icons:** none required. The only glyphs are typographic: "→", "⌄", "·", "~".

---

## Files in this bundle

| File | What it is |
|---|---|
| `tokens.css` | **Start here.** All Matcha Oat design tokens + the pulse keyframes. |
| `CommandView.jsx` | The full dashboard component (theme-aware). The reference implementation. |
| `components.jsx` | Shared primitives: `CatChip`, `Avatar`, `DistributionBar`/`UnitDots` (unused in final), `Eyebrow`, etc. |
| `data.js` | Fictional demo roster, shaped like the real classified roster (integration fixture). |
| `Team Status — Command View.html` | Standalone runnable prototype (Paper theme). Open in a browser. |
| `Team Status — 3 Themes.html` | All three themes side-by-side on a canvas. |
| `screenshots/` | Full-page renders of each theme + an expanded-row state. |

To run the prototype: serve the folder and open `Team Status — Command View.html`.
