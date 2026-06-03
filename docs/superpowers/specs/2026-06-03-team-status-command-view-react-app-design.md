# Team Status Dashboard — "Command View" React App (Matcha Oat)

**Date:** 2026-06-03
**Author:** Patricia Goh (with Claude)
**Status:** Draft for review
**Builds on:** `2026-05-29-team-status-dashboard-design.md` (the Python pipeline) and the
`design_handoff_team_status` "Command View" handoff (high-fidelity, Matcha Oat).

## Problem

The existing `team-status-dashboard` renders its roster as a server-side Jinja
`dashboard.html`. The **Command View** design handoff is a new, high-fidelity front
end for that same roster — a dense, above-the-fold single-table view that classifies
every person's current work and surfaces who is off-plan or firefighting. We want to
build it as a **real, maintainable React app** that can grow into the full product,
styled with the **Matcha Oat** design system.

This is a **visual / front-end layer**, not a new product. The data contract is the
roster the Python pipeline already produces (and the handoff's `data.js` mirrors).

## Goals

- Recreate the Command View **pixel-faithfully** (Paper theme) using a clean React +
  Tailwind codebase that can grow into the full app.
- Consume **Matcha Oat** as the design-token source of truth (the `wcag-explainer`
  consumer pattern: git dependency + Tailwind preset + `tokens.css`/`fonts.css`).
- Keep the code **clean and well-bounded**: one job per unit, a pure data-deriver, a
  typed data contract that the Python pipeline can later emit verbatim.
- Preserve **WCAG 2.2 AA** (contrast, focus, reduced motion, color-plus-label).
- Ship it **deployed** as the repo's GitHub Pages site (public, fictional data).

## Non-Goals (this build)

- **Not** wiring the Python pipeline to emit `roster.json` — that is an explicit later
  phase. This build is front-end-only, against a checked-in fixture.
- **Not** the Terminal or Editorial themes — **Paper only**.
- **Not** a working "correct my row" — the button is display-only, per the handoff.
- **Not** changing the Python pipeline, classifier, or the existing tests.

## Locked decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Stack | React + Vite + TypeScript + Tailwind |
| Location | `web/` subdirectory of the existing `team-status-dashboard` repo (monorepo) |
| Design system | `matcha-oat-design-system` as a git dependency + Tailwind preset + `tokens.css`/`fonts.css` |
| Theme | **Paper only** |
| Data source | **Fixture-first** — typed `RosterData` contract + `public/roster.json` (from `data.js`) |
| Category tokens | **App-local** semantic layer on Matcha Oat primitives (not pushed upstream) |
| Deploy | **New app takes over** the repo's GitHub Pages site; old staticrypt workflow stops deploying |
| Access | **Public, no gate** (data is 100% fictional) |
| "Correct my row" | Display-only affordance (not wired) |

## Architecture

```
team-status-dashboard/
├── src/team_status/        # existing Python pipeline — UNTOUCHED this build
├── .github/workflows/
│   ├── dashboard.yml       # old demo — deploy steps removed (kept, no longer publishes)
│   └── web.yml             # NEW — build + test + deploy web/ to Pages
└── web/                    # the React app
    ├── index.html
    ├── package.json        # deps incl. matcha-oat-design-system (github:)
    ├── vite.config.ts      # base path for Pages project site
    ├── tailwind.config.ts  # presets: [matchaOat]
    ├── tsconfig.json
    ├── postcss.config.js
    ├── public/
    │   └── roster.json     # the fixture — the data seam (from handoff data.js)
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css       # @tailwind layers + token imports
        ├── tokens.categories.css   # app-local work-category token layer
        ├── types.ts        # the RosterData contract
        ├── roster.ts       # pure: load + derive counts/groupings
        └── components/
            ├── Header.tsx
            ├── SummaryStrip.tsx     # StatTiles + EffortBreakdown
            ├── RosterTable.tsx      # ColumnHeader + per-team rows
            ├── TeamOverviewRow.tsx
            ├── PersonRow.tsx        # + ExpandedPanel
            ├── CategoryChip.tsx
            ├── Avatar.tsx
            └── SinceNote.tsx
```

Each unit has one job: `roster.ts` is pure logic (no JSX) and holds all derivation;
components are presentation; `types.ts` is the shared contract; `tokens.categories.css`
is the only file allowed to introduce app-level raw values.

## Data contract (`types.ts`)

Mirrors the handoff `data.js` exactly, so the fixture and any future pipeline output
share one shape. `roster.json` is the serialized form.

```ts
export type Category =
  | 'planned' | 'adhoc' | 'lent' | 'support' | 'unplanned' | 'incident';
export type Confidence = 'high' | 'low';
export type Signal = 'calm' | 'neutral' | 'attn' | 'urgent';

export interface PersonDetail { tickets: string[]; note: string; }

export interface Person {
  name: string;          // already abbreviated, e.g. "Maya R."
  initials: string;      // "MR"
  role: string;          // "EM", "Sr. Eng", "Staff", "Eng"
  team: string;
  cat: Category;
  conf: Confidence;
  what: string;          // the "Working on" line
  ticket: string | null; // primary ticket id, or null (em-dash)
  since: string | null;  // "since last look" note, or null = no change
  detail: PersonDetail;
}

export interface Team { name: string; lead: string; people: Person[]; }

export interface Snapshot {
  day: string; time: string; prev: string; next: string;
  slackConnected: boolean;
}

export interface RosterData { teams: Team[]; snapshot: Snapshot; }
```

Category **metadata** (label, dot token, calm→urgent order, signal, blurb) is a static
map in `roster.ts` keyed by `Category` — it is presentation/config, not roster data.

## Derived values (`roster.ts`, pure)

One pure function `derive(roster: RosterData)` computes, once:

- `all`: flattened people (each tagged with `team`).
- `counts`: per-category totals across everyone.
- `total`, `onPlan` (planned), `offPlan` (incident + unplanned), `firefighting`
  (incident), `changed` (anyone with a non-null `since`).
- per-team: category tally (non-zero, in calm→urgent order) + the team's off-plan count.
- `catOrder`: the calm→urgent category key order (drives breakdown + tally ordering).

This is the unit-test surface — no DOM needed.

## Components & rendering

- **`App`** — fetches `roster.json` (Vite `BASE_URL`), runs `derive`, renders Header →
  SummaryStrip → RosterTable. Handles loading/empty/error states honestly.
- **`Header`** — serif "Team status" + mono caption; right side: pulsing matcha snapshot
  dot (reduced-motion gated) + mono freshness text from `snapshot`.
- **`SummaryStrip`** — `StatTiles` (on-plan / off-plan / firefighting / changed, with the
  exact number colors from the handoff) and `EffortBreakdown` (typographic per-category
  counts + percentages between hairlines — **no chart**, the core color-is-signal rule).
- **`RosterTable`** — the single card; a `ColumnHeader` grid, then for each team a
  `TeamOverviewRow` followed by its `PersonRow`s.
- **`TeamOverviewRow`** — team name eyebrow + headcount, the non-zero category tally, a
  flexible hairline, and the off-plan / "all on plan" callout.
- **`PersonRow`** — the `34px 196px 1fr 132px 150px 86px` grid: index, `Avatar` + name +
  role, the "Working on" line (low-confidence = italic serif `--matcha-deep` with a "~"
  prefix), `CategoryChip`, `SinceNote`, and the right-aligned ticket with a hover "→".
  It is a real `<button>` with `aria-expanded` toggling the `ExpandedPanel`.
- **`ExpandedPanel`** — two-column: "Open items" ticket list + the signature yolk "Why"
  block (sans body on `--yolk-tint`), plus the low-confidence tag and the display-only
  "Correct {first}'s row →" button.
- Leaves: **`CategoryChip`** (pill, dot + label, per-category field colors from the token
  layer), **`Avatar`** (initials circle, 1.5px border in the category dot color),
  **`SinceNote`** (leading dot: matcha if "new this snapshot", else yolk; muted "no
  change" otherwise).

## Token strategy

- **Matcha Oat primitives** (oat/paper/ink/matcha/yolk/`--bad`-rust, type, radii, motion,
  `--focus`) come from the preset + imported `tokens.css` / `fonts.css`. Untouched.
- **`tokens.categories.css`** defines the **work-category** semantic layer:
  - `--dot-planned: var(--matcha)`, `--dot-unplanned: var(--yolk)`,
    `--dot-incident: var(--bad-border)` (rust) — mapped to primitives.
  - `--dot-adhoc`, `--dot-lent`, `--dot-support` and the per-category **chip** bg/text/
    border (the warm-neutral fields for support/lent/adhoc, plus `--rust-tint`) — the few
    genuinely new values, documented here because they're this app's domain semantics, not
    portfolio-wide. Chip text colors are chosen/verified ≥4.5:1 on their field.
- These map into Tailwind via `tailwind.config.ts` `theme.extend` so components use
  semantic utilities, never raw hex.

## Accessibility (WCAG 2.2 AA)

- **Contrast:** green text uses `--matcha-deep`; category chip/`--rust`/yolk text verified
  ≥4.5:1 on their fields (reuse Matcha Oat's AA values; verify the new warm-neutrals).
- **Use of color (1.4.1):** every category is **color + text label** (chip label, tally
  label) — hue is never the only cue. Confidence is signaled by italic + "~" + a text tag,
  not color alone.
- **Focus visible (2.4.7):** `var(--focus)` ring on expandable rows, the correct button,
  and any links.
- **Keyboard / SR:** person rows are `<button aria-expanded>` controlling the panel.
- **Reduced motion (2.3.3):** a `prefers-reduced-motion: reduce` block disables the
  snapshot pulse and collapses the row wash/slide and arrow nudges.
- **Target size (2.5.8):** rows and the correct button reserve ≥24px hit areas.

## Testing & tooling

- **Vitest + React Testing Library** (the `wcag-explainer` stack).
  - Pure: `derive` — counts, off-plan/firefighting, changed, per-team tallies, ordering.
  - Render: categories appear as **text labels** (not just color); a low-confidence person
    renders the tentative treatment; clicking a row toggles `aria-expanded` and reveals the
    "Why" note; an empty/"no tracked activity" person renders honestly.
- **Guardrail:** `check-no-raw-values.mjs` (from matcha-oat) runs in `web.yml` over
  `web/src/**`, with `tokens.categories.css` as the one allowed values file.
- **Type-check + lint** in CI.

## Deploy

- New **`web.yml`**: install → typecheck → test → guardrail → `vite build` → deploy
  `web/dist` to GitHub Pages (project-site `base` path configured in `vite.config.ts`).
- The old **`dashboard.yml`** keeps building the Python demo but its **deploy/publish
  steps are removed** so the two don't fight over the Pages artifact. The Command View
  becomes the repo's published site. Data is fictional, so it's **public, no staticrypt**.

## Build order (for the plan)

1. `web/` scaffold: Vite + React + TS + Tailwind; matcha-oat dependency + preset; fonts +
   token imports; `npm run dev` renders a styled placeholder.
2. Data contract + fixture: `types.ts`, `public/roster.json` (port `data.js`),
   `roster.ts` `derive` (TDD — pure tests first).
3. Token layer: `tokens.categories.css` + Tailwind `theme.extend`; category metadata map.
4. Leaf components: `CategoryChip`, `Avatar`, `SinceNote` (faithful, with render tests).
5. `Header` + `SummaryStrip` (StatTiles + EffortBreakdown).
6. `RosterTable` + `TeamOverviewRow` + `PersonRow` + `ExpandedPanel` (grid, hover/expand,
   reduced-motion).
7. Accessibility pass: focus rings, `aria-expanded`, color-plus-label, reduced-motion;
   verify new chip contrasts.
8. CI `web.yml` (typecheck + test + guardrail + build) and Pages deploy; retire the old
   deploy steps. Verify the live URL renders the Command View.

## Risks & open items

- **New chip contrast:** the warm-neutral support/lent/adhoc chip text must be verified
  ≥4.5:1 on its field (Matcha Oat values are AA; the few new ones need a check).
- **Pages base path:** project-site deploys need the correct `base` in `vite.config.ts`
  or assets 404.
- **Data drift later:** when the Python pipeline is wired to emit `roster.json`, it must
  match `types.ts` (roles, why-notes, multi-team) — tracked as the next phase, not here.
