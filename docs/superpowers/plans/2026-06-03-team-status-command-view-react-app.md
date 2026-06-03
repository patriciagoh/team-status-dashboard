# Team Status Command View — React App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the high-fidelity "Command View" Team Status dashboard as a clean React + Tailwind app in `web/`, styled with the Matcha Oat design system (Paper theme), running on a checked-in fixture and deployed as the repo's GitHub Pages site.

**Architecture:** A Vite + React + TypeScript + Tailwind app in a `web/` subdirectory of the existing monorepo. It consumes `matcha-oat-design-system` as a git dependency (Tailwind preset + `tokens.css`/`fonts.css`). A typed `RosterData` contract is fed by `public/roster.json` (ported from the handoff `data.js`); a pure `derive()` computes all summary/grouping values; presentational components render the roster faithfully. The work-category color semantics live in one app-local token file. CI type-checks, tests, runs the no-raw-values guardrail, builds, and deploys to Pages.

**Tech Stack:** React 18, Vite 5, TypeScript 5, Tailwind CSS 3 (matcha-oat preset), Vitest + React Testing Library + jsdom, GitHub Actions + Pages.

---

## File Structure

```
team-status-dashboard/
├── .github/workflows/
│   ├── dashboard.yml          # MODIFIED — deploy steps stripped (no longer publishes)
│   └── web.yml                # NEW — typecheck + test + guardrail + build + deploy
└── web/                       # NEW React app
    ├── index.html
    ├── package.json
    ├── package-lock.json
    ├── vite.config.ts         # base path for the project Pages site
    ├── vitest.config.ts
    ├── tsconfig.json
    ├── tsconfig.node.json
    ├── postcss.config.js
    ├── tailwind.config.ts     # presets: [matchaOat]
    ├── design-reference/      # vendored handoff (read-only reference; not built)
    │   ├── CommandView.jsx  components.jsx  data.js  tokens.css  README.md
    ├── public/
    │   └── roster.json        # the fixture (ported from data.js) — the data seam
    └── src/
        ├── main.tsx           # CSS imports + mount
        ├── App.tsx            # fetch roster.json → derive → render
        ├── index.css          # tailwind layers + chip component classes
        ├── tokens.categories.css   # the ONE app-local raw-values file (guardrail-excluded)
        ├── types.ts           # RosterData contract
        ├── categories.ts      # static category metadata (label/order/signal)
        ├── roster.ts          # pure: derive() + tests target
        ├── test/setup.ts      # jest-dom matchers
        └── components/
            ├── Header.tsx
            ├── SummaryStrip.tsx
            ├── StatTile.tsx
            ├── EffortBreakdown.tsx
            ├── RosterTable.tsx
            ├── TeamOverviewRow.tsx
            ├── PersonRow.tsx
            ├── ExpandedPanel.tsx
            ├── CategoryChip.tsx
            ├── Avatar.tsx
            ├── WorkingOn.tsx
            └── SinceNote.tsx
```

**Responsibilities:** `types.ts` is the data contract; `categories.ts` is static presentation config; `roster.ts` is pure logic (the test surface); `tokens.categories.css` is the only place new raw design values live; components are presentation only, one job each; `App.tsx` is the only place I/O (fetch) meets logic.

---

## Task 1: Scaffold the web/ app

**Files:**
- Create: `web/` (Vite scaffold), `web/tailwind.config.ts`, `web/postcss.config.js`, `web/vite.config.ts`, `web/src/index.css`, `web/src/main.tsx`, `web/src/App.tsx`
- Create: `web/design-reference/*` (vendored handoff)

- [ ] **Step 1: Scaffold Vite React-TS into web/**

Run:
```bash
cd /Users/patricia/team-status-dashboard
npm create vite@latest web -- --template react-ts
cd web && npm install
```
Expected: `web/` created with React+TS template; install succeeds.

- [ ] **Step 2: Add Tailwind 3, PostCSS, and the design system dependency**

Run:
```bash
cd /Users/patricia/team-status-dashboard/web
npm install -D tailwindcss@^3.4 postcss@^8 autoprefixer@^10
npm install github:patriciagoh/matcha-oat-design-system
```
Expected: dependencies install; `matcha-oat-design-system` appears in `package.json` dependencies as a `github:` URL.

- [ ] **Step 3: Vendor the design handoff as read-only reference**

Run:
```bash
cd /Users/patricia/team-status-dashboard/web
mkdir -p design-reference
cp "/tmp/tsb_zip/design_handoff_team_status/CommandView.jsx" \
   "/tmp/tsb_zip/design_handoff_team_status/components.jsx" \
   "/tmp/tsb_zip/design_handoff_team_status/data.js" \
   "/tmp/tsb_zip/design_handoff_team_status/tokens.css" \
   "/tmp/tsb_zip/design_handoff_team_status/README.md" \
   design-reference/
```
Expected: five files copied. (If `/tmp/tsb_zip` is gone, re-unzip `~/Downloads/Team Status Bashboard.zip`.) These are the pixel-exact source of truth for later tasks — never imported by the build.

- [ ] **Step 4: Write `web/postcss.config.js`**

```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 5: Write `web/tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";
import matchaOat from "matcha-oat-design-system/tailwind-preset";

export default {
  presets: [matchaOat],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
} satisfies Config;
```

- [ ] **Step 6: Write `web/vite.config.ts`** (project Pages base path)

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from https://patriciagoh.github.io/team-status-dashboard/
export default defineConfig({
  plugins: [react()],
  base: "/team-status-dashboard/",
});
```

- [ ] **Step 7: Replace `web/src/index.css`** with Tailwind layers only (component classes added in Task 4)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  background: var(--oat);
  color: var(--ink);
  font-family: var(--sans);
}
```

- [ ] **Step 8: Replace `web/src/main.tsx`** with ordered CSS imports

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import "matcha-oat-design-system/tokens.css";
import "matcha-oat-design-system/fonts.css";
import "./tokens.categories.css";
import "./index.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 9: Create a minimal `web/src/tokens.categories.css`** (filled in Task 4; needed now so the import resolves)

```css
/* App-local work-category tokens — filled in Task 4. */
:root {}
```

- [ ] **Step 10: Replace `web/src/App.tsx`** with a token-styled placeholder

```tsx
export default function App() {
  return (
    <div className="p-[38px_48px_44px]">
      <h1 className="font-serif text-[26px] tracking-[-0.02em] text-ink m-0">
        Team status
      </h1>
      <p className="font-mono text-muted text-[12px]">scaffold ok</p>
    </div>
  );
}
```

- [ ] **Step 11: Run the dev server and confirm it renders**

Run: `cd /Users/patricia/team-status-dashboard/web && npm run dev`
Expected: Vite serves on localhost; the page shows "Team status" in Newsreader serif on an oat background (confirms the preset, tokens, and fonts are wired). Stop the server (Ctrl-C).

- [ ] **Step 12: Add `web/.gitignore` entries and commit**

Ensure `web/.gitignore` (created by Vite) includes `node_modules` and `dist`. Then:
```bash
cd /Users/patricia/team-status-dashboard
git add web .github 2>/dev/null; git add web
git commit -m "feat(web): scaffold Vite+React+TS+Tailwind app with matcha-oat preset"
```

---

## Task 2: Data contract, category metadata, and fixture

**Files:**
- Create: `web/src/types.ts`
- Create: `web/src/categories.ts`
- Create: `web/public/roster.json`
- Test: `web/src/types.test.ts`

- [ ] **Step 1: Write `web/src/types.ts`**

```ts
export type Category =
  | "planned" | "adhoc" | "lent" | "support" | "unplanned" | "incident";
export type Confidence = "high" | "low";
export type Signal = "calm" | "neutral" | "attn" | "urgent";

export interface PersonDetail {
  tickets: string[];
  note: string;
}

export interface Person {
  name: string;       // already abbreviated, e.g. "Maya R."
  initials: string;   // "MR"
  role: string;       // "EM" | "Sr. Eng" | "Staff" | "Eng" | ...
  team: string;
  cat: Category;
  conf: Confidence;
  what: string;
  ticket: string | null;
  since: string | null;
  detail: PersonDetail;
}

export interface Team {
  name: string;
  lead: string;
  people: Person[];
}

export interface Snapshot {
  day: string;
  time: string;
  prev: string;
  next: string;
  slackConnected: boolean;
}

export interface RosterData {
  teams: Team[];
  snapshot: Snapshot;
}
```

- [ ] **Step 2: Write `web/src/categories.ts`** (static metadata; values from `design-reference/data.js`)

```ts
import type { Category, Signal } from "./types";

export interface CategoryMeta {
  key: Category;
  label: string;
  order: number;   // calm -> urgent
  signal: Signal;
  blurb: string;
}

export const CATEGORIES: Record<Category, CategoryMeta> = {
  planned:   { key: "planned",   label: "Planned",   order: 0, signal: "calm",    blurb: "On the roadmap / current cycle" },
  adhoc:     { key: "adhoc",     label: "Ad-hoc",    order: 1, signal: "calm",    blurb: "No-ticket request, picked up directly" },
  lent:      { key: "lent",      label: "Lent-out",  order: 2, signal: "neutral", blurb: "Helping another team this cycle" },
  support:   { key: "support",   label: "Support",   order: 3, signal: "neutral", blurb: "Customer escalation / on rotation" },
  unplanned: { key: "unplanned", label: "Unplanned", order: 4, signal: "attn",    blurb: "Off-plan work that appeared this cycle" },
  incident:  { key: "incident",  label: "Incident",  order: 5, signal: "urgent",  blurb: "Active incident / outage response" },
};

// calm -> urgent key order, drives breakdown + tally ordering
export const CAT_ORDER: Category[] = (Object.values(CATEGORIES) as CategoryMeta[])
  .sort((a, b) => a.order - b.order)
  .map((c) => c.key);
```

- [ ] **Step 3: Create `web/public/roster.json`** by porting `design-reference/data.js`

Port the four teams (Platform, Payments, Growth, Mobile) and the snapshot from `data.js` into JSON matching `RosterData`. Each person becomes `{ name, initials, role, team, cat, conf, what, ticket, since, detail: { tickets, note } }`. Set `team` on each person to its team name. Snapshot:

```json
{
  "snapshot": {
    "day": "Tuesday, June 3, 2026",
    "time": "9:02 AM ET",
    "prev": "yesterday, 2:00 PM",
    "next": "2:00 PM ET",
    "slackConnected": true
  },
  "teams": [
    {
      "name": "Platform",
      "lead": "Maya R.",
      "people": [
        { "name": "Maya R.", "initials": "MR", "role": "EM", "team": "Platform", "cat": "planned", "conf": "high", "what": "Multi-region failover runbook + drills", "ticket": "PLAT-412", "since": null, "detail": { "tickets": ["PLAT-412 Failover runbook", "PLAT-409 Drill scheduling"], "note": "Cycle 24 commitment." } }
      ]
    }
  ]
}
```

Fill in **all** people from `data.js` following that exact shape (the example shows one; port every record verbatim — `what`, `ticket`, `since`, `detail.tickets`, `detail.note` come straight from `data.js`). `ticket: null` where `data.js` passes `null`; `since: null` where it passes `null`.

- [ ] **Step 4: Write the failing fixture test `web/src/types.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import roster from "../public/roster.json";
import type { RosterData } from "./types";
import { CATEGORIES } from "./categories";

const data = roster as RosterData;

describe("roster.json fixture", () => {
  it("has four teams totalling 26 people", () => {
    expect(data.teams).toHaveLength(4);
    const total = data.teams.reduce((n, t) => n + t.people.length, 0);
    expect(total).toBe(26);
  });

  it("every person has a known category and a high/low confidence", () => {
    for (const team of data.teams) {
      for (const p of team.people) {
        expect(Object.keys(CATEGORIES)).toContain(p.cat);
        expect(["high", "low"]).toContain(p.conf);
        expect(p.team).toBe(team.name);
      }
    }
  });
});
```

- [ ] **Step 5: Enable JSON import + run the test (expect fail until config in Task 3 wiring)**

Add `"resolveJsonModule": true` to `web/tsconfig.json`'s `compilerOptions` if not present. Vitest config is added in Task 3 Step 1; if running now, run after that step. Run: `cd web && npx vitest run src/types.test.ts`
Expected: PASS once `roster.json` is fully ported (26 people). If it fails on count, you missed records from `data.js`.

- [ ] **Step 6: Commit**

```bash
cd /Users/patricia/team-status-dashboard
git add web/src/types.ts web/src/categories.ts web/public/roster.json web/src/types.test.ts web/tsconfig.json
git commit -m "feat(web): add RosterData contract, category metadata, and fixture"
```

---

## Task 3: Pure deriver (`roster.ts`) — TDD

**Files:**
- Create: `web/vitest.config.ts`, `web/src/test/setup.ts`
- Create: `web/src/roster.ts`
- Test: `web/src/roster.test.ts`

- [ ] **Step 1: Install test deps and write `web/vitest.config.ts`**

Run:
```bash
cd /Users/patricia/team-status-dashboard/web
npm install -D vitest@^2 @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/user-event@^14 jsdom@^25
```
Then create `web/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
```
And `web/src/test/setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```
Add to `web/package.json` `"scripts"`: `"test": "vitest run"`, `"typecheck": "tsc --noEmit"`.

- [ ] **Step 2: Write the failing test `web/src/roster.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { derive } from "./roster";
import type { RosterData } from "./types";

function person(cat: RosterData["teams"][0]["people"][0]["cat"], since: string | null = null) {
  return {
    name: "X Y", initials: "XY", role: "Eng", team: "T", cat, conf: "high" as const,
    what: "w", ticket: null, since, detail: { tickets: [], note: "" },
  };
}

const data: RosterData = {
  snapshot: { day: "d", time: "t", prev: "p", next: "n", slackConnected: false },
  teams: [
    { name: "A", lead: "X Y", people: [person("planned"), person("incident", "new this snapshot"), person("unplanned")] },
    { name: "B", lead: "X Y", people: [person("planned"), person("support"), person("lent")] },
  ],
};

describe("derive", () => {
  const d = derive(data);

  it("counts total people", () => expect(d.total).toBe(6));
  it("counts per category", () => {
    expect(d.counts.planned).toBe(2);
    expect(d.counts.incident).toBe(1);
    expect(d.counts.unplanned).toBe(1);
  });
  it("onPlan = planned count", () => expect(d.onPlan).toBe(2));
  it("offPlan = incident + unplanned", () => expect(d.offPlan).toBe(2));
  it("firefighting = incident only", () => expect(d.firefighting).toBe(1));
  it("changed = anyone with a since note", () => expect(d.changed).toBe(1));
  it("per-team tally is non-zero categories in calm->urgent order", () => {
    const teamA = d.teams.find((t) => t.name === "A")!;
    expect(teamA.tally.map((x) => x.key)).toEqual(["planned", "unplanned", "incident"]);
    expect(teamA.offPlan).toBe(2);
  });
  it("team B has no off-plan", () => {
    expect(d.teams.find((t) => t.name === "B")!.offPlan).toBe(0);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd web && npx vitest run src/roster.test.ts`
Expected: FAIL — cannot find module `./roster` / `derive` is not a function.

- [ ] **Step 4: Write `web/src/roster.ts`**

```ts
import type { Category, RosterData, Person } from "./types";
import { CATEGORIES, CAT_ORDER } from "./categories";

const OFF_PLAN: Category[] = ["incident", "unplanned"];

export interface TallyItem { key: Category; label: string; count: number; }
export interface TeamDerived {
  name: string;
  headcount: number;
  people: Person[];
  tally: TallyItem[];
  offPlan: number;
}
export interface Derived {
  all: Person[];
  counts: Record<Category, number>;
  total: number;
  onPlan: number;
  offPlan: number;
  firefighting: number;
  changed: number;
  catOrder: Category[];
  teams: TeamDerived[];
}

function emptyCounts(): Record<Category, number> {
  return { planned: 0, adhoc: 0, lent: 0, support: 0, unplanned: 0, incident: 0 };
}

export function derive(data: RosterData): Derived {
  const all: Person[] = data.teams.flatMap((t) => t.people);
  const counts = emptyCounts();
  for (const p of all) counts[p.cat] += 1;

  const teams: TeamDerived[] = data.teams.map((t) => {
    const tc = emptyCounts();
    for (const p of t.people) tc[p.cat] += 1;
    const tally: TallyItem[] = CAT_ORDER
      .filter((k) => tc[k] > 0)
      .map((k) => ({ key: k, label: CATEGORIES[k].label, count: tc[k] }));
    const offPlan = t.people.filter((p) => OFF_PLAN.includes(p.cat)).length;
    return { name: t.name, headcount: t.people.length, people: t.people, tally, offPlan };
  });

  return {
    all,
    counts,
    total: all.length,
    onPlan: counts.planned,
    offPlan: counts.incident + counts.unplanned,
    firefighting: counts.incident,
    changed: all.filter((p) => p.since).length,
    catOrder: CAT_ORDER,
    teams,
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd web && npx vitest run src/roster.test.ts`
Expected: PASS (all assertions green).

- [ ] **Step 6: Commit**

```bash
cd /Users/patricia/team-status-dashboard
git add web/vitest.config.ts web/src/test/setup.ts web/src/roster.ts web/src/roster.test.ts web/package.json
git commit -m "feat(web): add pure derive() with counts, off-plan, and per-team tallies"
```

---

## Task 4: App-local category token layer + chip classes

**Files:**
- Modify: `web/src/tokens.categories.css`
- Modify: `web/src/index.css`

- [ ] **Step 1: Fill `web/src/tokens.categories.css`** (the ONE file allowed raw values; guardrail-excluded)

```css
/* ============================================================
   App-local WORK-CATEGORY tokens for the Team Status app.
   These are this app's domain semantics — not portfolio-wide —
   so they layer on top of matcha-oat primitives instead of
   living upstream. This is the ONLY file permitted to introduce
   raw values; it is excluded from the no-raw-values guardrail.
   ============================================================ */
:root {
  /* Rust — the urgent / incident signal (matcha-oat core has --bad*; we name it rust here) */
  --rust: #C0533A;
  --rust-deep: #9A3D29;          /* incident text — AA on --rust-tint */
  --rust-tint: #F6E2DA;
  --rust-tint-border: #EBC9BD;

  /* Work-category dots (calm -> urgent). Mapped to primitives where they exist. */
  --dot-planned: var(--matcha);
  --dot-adhoc: #A8B58F;          /* light sage */
  --dot-lent: #C7BDA6;           /* light taupe */
  --dot-support: #8E8569;        /* olive */
  --dot-unplanned: var(--yolk);
  --dot-incident: var(--rust);

  /* Category chip fields: bg / text / border. Text verified >=4.5:1 on bg (see a11y task). */
  --cat-planned-bg: var(--matcha-tint);     --cat-planned-text: var(--matcha-deep);     --cat-planned-border: var(--matcha-tint-border);
  --cat-adhoc-bg: var(--paper);             --cat-adhoc-text: var(--ink-2);             --cat-adhoc-border: var(--line-2);
  --cat-lent-bg: #F1EFE9;                   --cat-lent-text: var(--ink-2);              --cat-lent-border: var(--line-2);
  --cat-support-bg: #EDEADD;                --cat-support-text: #6C6647;                --cat-support-border: #DCD6C3;
  --cat-unplanned-bg: var(--yolk-tint);     --cat-unplanned-text: var(--yolk-tint-text);--cat-unplanned-border: #EAD9AE;
  --cat-incident-bg: var(--rust-tint);      --cat-incident-text: var(--rust-deep);      --cat-incident-border: var(--rust-tint-border);
}

/* Ambient snapshot pulse (rgba, not hex). Gated for reduced motion. */
@keyframes tsd-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(110, 139, 87, 0.30); }
  70%  { box-shadow: 0 0 0 9px rgba(110, 139, 87, 0); }
  100% { box-shadow: 0 0 0 0 rgba(110, 139, 87, 0); }
}
.tsd-pulse { animation: tsd-pulse 2s ease-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .tsd-pulse { animation: none; }
}
```

- [ ] **Step 2: Add chip component classes to `web/src/index.css`** (token-referencing → guardrail-safe)

Append below the `@tailwind` lines:
```css
@layer components {
  .tsd-chip {
    display: inline-flex; align-items: center; gap: 7px;
    border-radius: var(--r-pill);
    padding: 5px 13px 5px 11px;
    font: 700 12px/1.4 var(--mono);
    border: 1px solid transparent;
    white-space: nowrap;
  }
  .tsd-chip[data-cat="planned"]   { background: var(--cat-planned-bg);   color: var(--cat-planned-text);   border-color: var(--cat-planned-border); }
  .tsd-chip[data-cat="adhoc"]     { background: var(--cat-adhoc-bg);     color: var(--cat-adhoc-text);     border-color: var(--cat-adhoc-border); }
  .tsd-chip[data-cat="lent"]      { background: var(--cat-lent-bg);      color: var(--cat-lent-text);      border-color: var(--cat-lent-border); }
  .tsd-chip[data-cat="support"]   { background: var(--cat-support-bg);   color: var(--cat-support-text);   border-color: var(--cat-support-border); }
  .tsd-chip[data-cat="unplanned"] { background: var(--cat-unplanned-bg); color: var(--cat-unplanned-text); border-color: var(--cat-unplanned-border); }
  .tsd-chip[data-cat="incident"]  { background: var(--cat-incident-bg);  color: var(--cat-incident-text);  border-color: var(--cat-incident-border); }

  /* focus ring honoring matcha-oat focus token */
  .tsd-focus:focus-visible { outline: var(--focus); outline-offset: var(--focus-offset); }
}
```

- [ ] **Step 3: Verify build still compiles**

Run: `cd web && npm run build`
Expected: build succeeds (no CSS errors). (Renders are exercised in later tasks.)

- [ ] **Step 4: Commit**

```bash
cd /Users/patricia/team-status-dashboard
git add web/src/tokens.categories.css web/src/index.css
git commit -m "feat(web): add app-local work-category token layer + chip classes"
```

---

## Task 5: Leaf components (CategoryChip, Avatar, SinceNote, WorkingOn)

**Files:**
- Create: `web/src/components/CategoryChip.tsx`, `Avatar.tsx`, `SinceNote.tsx`, `WorkingOn.tsx`
- Test: `web/src/components/leaves.test.tsx`

Each ports the equivalent from `design-reference/components.jsx`, converting inline `var(--…)` styles to TSX. Dynamic category colors use `` `var(--dot-${cat})` `` (a token reference — no raw hex).

- [ ] **Step 1: Write `web/src/components/CategoryChip.tsx`**

```tsx
import type { Category } from "../types";
import { CATEGORIES } from "../categories";

export function CategoryChip({ cat }: { cat: Category }) {
  return (
    <span className="tsd-chip" data-cat={cat}>
      <span
        className="inline-block w-[7px] h-[7px] rounded-full shrink-0"
        style={{ background: `var(--dot-${cat})` }}
      />
      {CATEGORIES[cat].label}
    </span>
  );
}
```

- [ ] **Step 2: Write `web/src/components/Avatar.tsx`**

```tsx
import type { Person } from "../types";

export function Avatar({ person, size = 26 }: { person: Person; size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0 bg-paper text-ink-2 font-mono font-bold tracking-[0.02em]"
      style={{
        width: size,
        height: size,
        border: `1.5px solid var(--dot-${person.cat})`,
        fontSize: Math.round(size * 0.33),
        lineHeight: 1,
      }}
    >
      {person.initials}
    </span>
  );
}
```

- [ ] **Step 3: Write `web/src/components/SinceNote.tsx`**

```tsx
import type { Person } from "../types";

export function SinceNote({ person }: { person: Person }) {
  if (!person.since) {
    return <span className="font-mono text-[11px] leading-none text-muted">no change</span>;
  }
  const isNew = /new this snapshot/i.test(person.since);
  return (
    <span className="inline-flex items-center gap-[6px] font-mono font-bold text-[11px] leading-[1.4] text-ink-2">
      <span
        className="w-[5px] h-[5px] rounded-full shrink-0"
        style={{ background: isNew ? "var(--matcha)" : "var(--yolk)" }}
      />
      {person.since}
    </span>
  );
}
```

- [ ] **Step 4: Write `web/src/components/WorkingOn.tsx`** (low-confidence = italic serif + "~")

```tsx
import type { Person } from "../types";

export function WorkingOn({ person }: { person: Person }) {
  const low = person.conf === "low";
  if (low) {
    return (
      <span className="font-serif italic text-[13.5px] leading-[1.35] text-matcha-deep">
        <span className="text-muted italic">~ </span>
        {person.what}
      </span>
    );
  }
  return (
    <span className="font-sans text-[13.5px] leading-[1.35] text-ink">{person.what}</span>
  );
}
```

- [ ] **Step 5: Write the render test `web/src/components/leaves.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CategoryChip } from "./CategoryChip";
import { SinceNote } from "./SinceNote";
import { WorkingOn } from "./WorkingOn";
import type { Person } from "../types";

const base: Person = {
  name: "Tomas B.", initials: "TB", role: "Sr. Eng", team: "Platform",
  cat: "unplanned", conf: "low", what: "Likely the OOM crashes",
  ticket: "PLAT-431", since: "new this snapshot",
  detail: { tickets: ["PLAT-431"], note: "Inferred." },
};

describe("leaf components", () => {
  it("chip shows the category as a text label, not color alone", () => {
    render(<CategoryChip cat="incident" />);
    expect(screen.getByText("Incident")).toBeInTheDocument();
  });

  it("low-confidence WorkingOn renders the tentative '~' marker", () => {
    render(<WorkingOn person={base} />);
    expect(screen.getByText(/Likely the OOM crashes/)).toBeInTheDocument();
    expect(screen.getByText("~", { exact: false })).toBeInTheDocument();
  });

  it("SinceNote shows the change note when present, 'no change' when absent", () => {
    const { rerender } = render(<SinceNote person={base} />);
    expect(screen.getByText(/new this snapshot/)).toBeInTheDocument();
    rerender(<SinceNote person={{ ...base, since: null }} />);
    expect(screen.getByText("no change")).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the test**

Run: `cd web && npx vitest run src/components/leaves.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
cd /Users/patricia/team-status-dashboard
git add web/src/components/CategoryChip.tsx web/src/components/Avatar.tsx web/src/components/SinceNote.tsx web/src/components/WorkingOn.tsx web/src/components/leaves.test.tsx
git commit -m "feat(web): add leaf components (chip, avatar, since-note, working-on)"
```

---

## Task 6: Header + SummaryStrip (StatTile + EffortBreakdown)

**Files:**
- Create: `web/src/components/Header.tsx`, `StatTile.tsx`, `EffortBreakdown.tsx`, `SummaryStrip.tsx`
- Test: `web/src/components/summary.test.tsx`

Port from `design-reference/CommandView.jsx` (the `header`, `StatTile`, and "summary strip" sections — Paper theme values only).

- [ ] **Step 1: Write `web/src/components/Header.tsx`**

```tsx
import type { Snapshot } from "../types";

export function Header({ snapshot, total }: { snapshot: Snapshot; total: number }) {
  const day = snapshot.day.split(",")[0];
  return (
    <header className="flex justify-between items-center">
      <div className="flex items-baseline gap-[12px]">
        <h1 className="font-serif font-normal text-[26px] leading-none tracking-[-0.02em] text-ink m-0 whitespace-nowrap">
          Team status
        </h1>
        <span className="font-mono text-[12px] leading-none text-muted">
          / engineering · {total} people
        </span>
      </div>
      <div className="flex items-center gap-[14px] flex-wrap">
        <span className="inline-flex items-center gap-[7px]">
          <span className="tsd-pulse w-[7px] h-[7px] rounded-full" style={{ background: "var(--matcha)" }} />
          <span className="font-mono font-bold text-[12px] leading-none text-ink-2">
            Snapshot · {day} {snapshot.time}
          </span>
        </span>
        <span className="font-mono text-[12px] leading-none text-muted">
          next refresh {snapshot.next}
        </span>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Write `web/src/components/StatTile.tsx`**

```tsx
type Tone = "ink" | "yolk" | "rust";

export function StatTile({ big, label, tone = "ink" }: { big: number; label: string; tone?: Tone }) {
  const color =
    tone === "rust" ? "var(--rust-deep)" : tone === "yolk" ? "var(--yolk-deep)" : "var(--ink)";
  return (
    <div className="flex flex-col gap-[5px]">
      <span className="font-sans font-bold text-[38px] leading-none tracking-[-0.03em]" style={{ color }}>
        {big}
      </span>
      <span className="font-sans font-semibold text-[10.5px] leading-[1.2] tracking-[0.1em] uppercase text-muted">
        {label}
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Write `web/src/components/EffortBreakdown.tsx`** (typographic — no chart)

```tsx
import type { Category } from "../types";
import { CATEGORIES } from "../categories";
import type { Derived } from "../roster";

const SIGNAL_COLOR: Partial<Record<Category, string>> = {
  incident: "var(--rust-deep)",
  unplanned: "var(--yolk-deep)",
  planned: "var(--matcha-deep)",
};

export function EffortBreakdown({ d }: { d: Derived }) {
  return (
    <div>
      <div className="font-sans font-semibold text-[10px] leading-none tracking-[0.13em] uppercase text-muted mb-[12px]">
        Where the effort is going
      </div>
      <div className="flex flex-wrap border-t border-b border-line">
        {d.catOrder.map((k) => {
          const n = d.counts[k];
          if (!n) return null;
          const color = SIGNAL_COLOR[k] ?? "var(--ink)";
          const pct = Math.round((n / d.total) * 100);
          return (
            <div key={k} className="flex flex-col gap-[7px] pr-[22px] py-[13px] mr-[22px] border-r border-line">
              <span className="flex items-baseline gap-[6px]">
                <span className="font-sans font-bold text-[24px] leading-none tracking-[-0.03em]" style={{ color }}>{n}</span>
                <span className="font-mono text-[11px] leading-none text-muted">{pct}%</span>
              </span>
              <span className="font-sans font-semibold text-[10.5px] leading-none tracking-[0.1em] uppercase text-muted">
                {CATEGORIES[k].label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `web/src/components/SummaryStrip.tsx`**

```tsx
import type { Derived } from "../roster";
import { StatTile } from "./StatTile";
import { EffortBreakdown } from "./EffortBreakdown";

export function SummaryStrip({ d }: { d: Derived }) {
  return (
    <section className="mt-[26px] grid grid-cols-[auto_1fr] gap-[32px] items-center">
      <div className="flex gap-[34px] pr-[34px] border-r border-line-2">
        <StatTile big={d.onPlan} label="on plan" />
        <StatTile big={d.offPlan - d.firefighting} label="off plan" tone="yolk" />
        <StatTile big={d.firefighting} label="firefighting" tone="rust" />
        <StatTile big={d.changed} label="changed" />
      </div>
      <EffortBreakdown d={d} />
    </section>
  );
}
```

- [ ] **Step 5: Write the test `web/src/components/summary.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SummaryStrip } from "./SummaryStrip";
import { Header } from "./Header";
import { derive } from "../roster";
import roster from "../../public/roster.json";
import type { RosterData } from "../types";

const d = derive(roster as RosterData);

describe("summary strip", () => {
  it("renders the four stat labels", () => {
    render(<SummaryStrip d={d} />);
    expect(screen.getByText("on plan")).toBeInTheDocument();
    expect(screen.getByText("off plan")).toBeInTheDocument();
    expect(screen.getByText("firefighting")).toBeInTheDocument();
    expect(screen.getByText("changed")).toBeInTheDocument();
  });

  it("breakdown lists categories as text labels (no chart element)", () => {
    const { container } = render(<SummaryStrip d={d} />);
    expect(screen.getByText("Where the effort is going")).toBeInTheDocument();
    expect(screen.getByText("Planned")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("header shows the snapshot freshness", () => {
    render(<Header snapshot={(roster as RosterData).snapshot} total={d.total} />);
    expect(screen.getByText(/Snapshot ·/)).toBeInTheDocument();
    expect(screen.getByText(/next refresh/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the test**

Run: `cd web && npx vitest run src/components/summary.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
cd /Users/patricia/team-status-dashboard
git add web/src/components/Header.tsx web/src/components/StatTile.tsx web/src/components/EffortBreakdown.tsx web/src/components/SummaryStrip.tsx web/src/components/summary.test.tsx
git commit -m "feat(web): add header and summary strip (stat tiles + typographic breakdown)"
```

---

## Task 7: Roster table (RosterTable, TeamOverviewRow, PersonRow, ExpandedPanel)

**Files:**
- Create: `web/src/components/ExpandedPanel.tsx`, `PersonRow.tsx`, `TeamOverviewRow.tsx`, `RosterTable.tsx`
- Test: `web/src/components/table.test.tsx`

Port from `design-reference/CommandView.jsx` (`Row`, the team-band markup, and the column header). Grid template (used by the column header and every person row): `34px 196px 1fr 132px 150px 86px`, gap `16px`.

- [ ] **Step 1: Write `web/src/components/ExpandedPanel.tsx`**

```tsx
import type { Person } from "../types";

export function ExpandedPanel({ person }: { person: Person }) {
  const first = person.name.split(" ")[0];
  return (
    <div className="px-[14px] pt-[4px] pb-[18px] pl-[52px] bg-oat">
      <div className="grid grid-cols-2 gap-[24px] bg-paper border border-line rounded-sm px-[18px] py-[15px]">
        <div>
          <div className="font-sans font-semibold text-[10px] leading-none tracking-[0.13em] uppercase text-muted mb-[10px]">
            Open items
          </div>
          <div className="flex flex-col gap-[7px]">
            {person.detail.tickets.map((t, i) => (
              <div key={i} className="flex items-center gap-[9px]">
                <span className="w-[4px] h-[4px] rounded-full shrink-0" style={{ background: "var(--matcha)" }} />
                <span className="font-mono text-[13px] leading-[1.4] text-ink-2">{t}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div
            className="rounded-sm px-[16px] py-[13px]"
            style={{ background: "var(--yolk-tint)", border: "1px solid var(--cat-unplanned-border)" }}
          >
            <div className="font-sans font-bold text-[10.5px] leading-none tracking-[0.16em] uppercase text-yolk-deep mb-[8px]">
              Why
            </div>
            <div className="font-sans text-[14.5px] leading-[1.55] text-yolk-tint-text">{person.detail.note}</div>
          </div>
          {person.conf === "low" && (
            <div className="mt-[12px]">
              <span className="inline-block font-sans font-semibold text-[10px] leading-none tracking-[0.08em] uppercase text-muted border border-dashed border-line-2 rounded-pill px-[8px] py-[3px] whitespace-nowrap">
                inferred · low confidence
              </span>
            </div>
          )}
          <button
            type="button"
            className="tsd-focus mt-[14px] font-sans font-semibold text-[12px] leading-none text-matcha-deep bg-transparent border-none p-0 cursor-pointer inline-flex items-center gap-[5px]"
          >
            Correct {first}'s row
            <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `web/src/components/PersonRow.tsx`** (real button, `aria-expanded`, reduced-motion-safe hover via CSS)

```tsx
import { useState } from "react";
import type { Person } from "../types";
import { Avatar } from "./Avatar";
import { CategoryChip } from "./CategoryChip";
import { SinceNote } from "./SinceNote";
import { WorkingOn } from "./WorkingOn";
import { ExpandedPanel } from "./ExpandedPanel";

const GRID = "grid-cols-[34px_196px_1fr_132px_150px_86px] gap-[16px]";

export function PersonRow({ person, idx, last }: { person: Person; idx: number; last: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden" style={{ borderBottom: last && !open ? "none" : "1px solid var(--line)" }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`tsd-row tsd-focus w-full text-left grid ${GRID} items-center px-[16px] py-[11px] cursor-pointer bg-transparent border-0`}
        style={open ? { background: "#FBF9F3" } : undefined}
      >
        <span className="font-mono text-[12.5px] leading-none text-muted tabular-nums">
          {String(idx).padStart(2, "0")}
        </span>
        <span className="flex items-center gap-[10px] min-w-0">
          <Avatar person={person} size={26} />
          <span className="font-serif font-medium text-[15px] leading-[1.1] text-ink whitespace-nowrap">{person.name}</span>
          <span className="font-mono text-[10px] leading-none text-muted">{person.role}</span>
        </span>
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"><WorkingOn person={person} /></span>
        <span><CategoryChip cat={person.cat} /></span>
        <span className="min-w-0"><SinceNote person={person} /></span>
        <span className="flex items-center justify-end gap-[8px]">
          <span className="font-mono font-bold text-[11px] leading-none text-matcha-deep text-right">{person.ticket || "—"}</span>
          <span className="tsd-arr font-mono text-[13px] leading-none text-matcha-deep shrink-0" aria-hidden>{open ? "⌄" : "→"}</span>
        </span>
      </button>
      {open && <ExpandedPanel person={person} />}
    </div>
  );
}
```

- [ ] **Step 3: Add row hover/motion CSS to `web/src/index.css`** (inside the existing `@layer components`)

```css
  .tsd-row { transition: transform var(--dur-row), background var(--dur-row); }
  .tsd-arr { opacity: 0; transition: opacity var(--dur-base); }
  .tsd-row:hover:not([aria-expanded="true"]) {
    background: linear-gradient(90deg, rgba(232, 178, 60, 0.16), rgba(232, 178, 60, 0) 60%);
    transform: translateX(5px);
  }
  .tsd-row:hover .tsd-arr { opacity: 1; }
  @media (prefers-reduced-motion: reduce) {
    .tsd-row, .tsd-arr { transition: none; }
    .tsd-row:hover:not([aria-expanded="true"]) { transform: none; }
  }
```

- [ ] **Step 4: Write `web/src/components/TeamOverviewRow.tsx`**

```tsx
import type { Category } from "../types";
import type { TeamDerived } from "../roster";

const TALLY_COLOR: Partial<Record<Category, string>> = {
  incident: "var(--rust-deep)",
  unplanned: "var(--yolk-deep)",
  planned: "var(--matcha-deep)",
};

export function TeamOverviewRow({ team, first }: { team: TeamDerived; first: boolean }) {
  return (
    <div
      className="flex items-center gap-[18px] px-[16px] pt-[15px] pb-[14px] bg-oat"
      style={{ borderTop: first ? "none" : "1px solid var(--line-2)", borderBottom: "1px solid var(--line)" }}
    >
      <span className="inline-flex items-baseline gap-[9px] whitespace-nowrap">
        <span className="font-sans font-bold text-[12px] leading-none tracking-[0.14em] uppercase text-matcha-deep">{team.name}</span>
        <span className="font-mono text-[11px] leading-none text-muted">{team.headcount}</span>
      </span>
      <div className="flex flex-wrap items-baseline gap-x-[14px] gap-y-[2px]">
        {team.tally.map((t) => (
          <span key={t.key} className="inline-flex items-baseline gap-[5px]">
            <span className="font-mono font-bold text-[13px] leading-none" style={{ color: TALLY_COLOR[t.key] ?? "var(--ink-2)" }}>{t.count}</span>
            <span className="font-sans text-[11.5px] leading-none text-muted">{t.label.toLowerCase()}</span>
          </span>
        ))}
      </div>
      <span className="flex-1 min-w-[12px] h-px" style={{ background: "var(--line)" }} />
      <span className="font-mono font-bold text-[11px] leading-none whitespace-nowrap" style={{ color: team.offPlan ? "var(--rust-deep)" : "var(--matcha-deep)" }}>
        {team.offPlan ? `${team.offPlan} off-plan` : "all on plan"}
      </span>
    </div>
  );
}
```

- [ ] **Step 5: Write `web/src/components/RosterTable.tsx`**

```tsx
import type { Derived } from "../roster";
import { TeamOverviewRow } from "./TeamOverviewRow";
import { PersonRow } from "./PersonRow";

const GRID = "grid-cols-[34px_196px_1fr_132px_150px_86px] gap-[16px]";
const HEADERS = ["Person", "Working on", "Why", "Since last look", "Ticket"];

export function RosterTable({ d }: { d: Derived }) {
  const lastTeam = d.teams.length - 1;
  return (
    <section className="mt-[24px] bg-paper border border-line-2 rounded-xl overflow-hidden">
      <div className={`grid ${GRID} px-[16px] py-[11px] bg-oat border-b border-line-2`}>
        <span className="font-sans font-semibold text-[10px] leading-none tracking-[0.12em] uppercase text-muted">#</span>
        {HEADERS.map((h, i) => (
          <span
            key={h}
            className="font-sans font-semibold text-[10px] leading-none tracking-[0.12em] uppercase text-muted"
            style={{ textAlign: i === 4 ? "right" : "left" }}
          >
            {h}
          </span>
        ))}
      </div>
      {d.teams.map((team, ti) => (
        <div key={team.name}>
          <TeamOverviewRow team={team} first={ti === 0} />
          {team.people.map((p, i) => (
            <PersonRow
              key={`${team.name}-${i}`}
              person={p}
              idx={i + 1}
              last={ti === lastTeam && i === team.people.length - 1}
            />
          ))}
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 6: Write the interaction test `web/src/components/table.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RosterTable } from "./RosterTable";
import { derive } from "../roster";
import roster from "../../public/roster.json";
import type { RosterData } from "../types";

const d = derive(roster as RosterData);

describe("roster table", () => {
  it("renders every person and team name", () => {
    render(<RosterTable d={d} />);
    expect(screen.getByText("Maya R.")).toBeInTheDocument();
    expect(screen.getByText("Platform")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { expanded: false }).length).toBe(d.total);
  });

  it("clicking a person row expands it and reveals the why note", async () => {
    render(<RosterTable d={d} />);
    const devin = screen.getByRole("button", { name: /Devin O\./ });
    expect(devin).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(devin);
    expect(devin).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Paged 08:14/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Correct Devin's row/ })).toBeInTheDocument();
  });

  it("a low-confidence person shows the inferred tag when expanded", async () => {
    render(<RosterTable d={d} />);
    const tomas = screen.getByRole("button", { name: /Tomas B\./ });
    await userEvent.click(tomas);
    expect(screen.getByText(/inferred · low confidence/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run the test**

Run: `cd web && npx vitest run src/components/table.test.tsx`
Expected: PASS (3 tests). If "Devin O." button name match fails, confirm the row `<button>` contains the name text (accessible name is its text content).

- [ ] **Step 8: Commit**

```bash
cd /Users/patricia/team-status-dashboard
git add web/src/components/ExpandedPanel.tsx web/src/components/PersonRow.tsx web/src/components/TeamOverviewRow.tsx web/src/components/RosterTable.tsx web/src/components/table.test.tsx web/src/index.css
git commit -m "feat(web): add roster table with expandable person rows + team overview"
```

---

## Task 8: App wiring (fetch → derive → render)

**Files:**
- Modify: `web/src/App.tsx`
- Test: `web/src/App.test.tsx`

- [ ] **Step 1: Write the failing test `web/src/App.test.tsx`** (mock fetch with the fixture)

```tsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import App from "./App";
import roster from "../public/roster.json";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(roster) } as Response),
  ));
});

describe("App", () => {
  it("loads the roster and renders the dashboard", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("Team status")).toBeInTheDocument());
    expect(screen.getByText("on plan")).toBeInTheDocument();
    expect(screen.getByText("Maya R.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd web && npx vitest run src/App.test.tsx`
Expected: FAIL — App renders only the scaffold placeholder, "on plan" not found.

- [ ] **Step 3: Rewrite `web/src/App.tsx`**

```tsx
import { useEffect, useState } from "react";
import type { RosterData } from "./types";
import { derive } from "./roster";
import { Header } from "./components/Header";
import { SummaryStrip } from "./components/SummaryStrip";
import { RosterTable } from "./components/RosterTable";

export default function App() {
  const [data, setData] = useState<RosterData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}roster.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`roster.json ${r.status}`);
        return r.json();
      })
      .then((d: RosterData) => setData(d))
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <div className="p-[38px_48px_44px] font-mono text-[13px] text-rust-deep">
        Could not load the roster: {error}
      </div>
    );
  }
  if (!data) {
    return <div className="p-[38px_48px_44px] font-mono text-[12px] text-muted">Loading…</div>;
  }

  const d = derive(data);
  return (
    <main className="p-[38px_48px_44px]">
      <Header snapshot={data.snapshot} total={d.total} />
      <SummaryStrip d={d} />
      <RosterTable d={d} />
    </main>
  );
}
```

Note: `text-rust-deep` requires a Tailwind color for rust. Since rust is app-local, use inline style instead — replace the error block's class with `className="p-[38px_48px_44px] font-mono text-[13px]" style={{ color: "var(--rust-deep)" }}`.

- [ ] **Step 4: Run to verify it passes**

Run: `cd web && npx vitest run src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the full suite + typecheck**

Run: `cd web && npm run typecheck && npm test`
Expected: typecheck clean; all tests pass.

- [ ] **Step 6: Visually confirm in the browser**

Run: `cd web && npm run dev`
Expected: the full Command View renders — header with pulsing snapshot dot, four stat tiles, typographic effort breakdown, and the team-grouped roster with expandable rows. Compare against `design-reference/README.md` screenshots section and the `screenshots/` in the original handoff. Stop the server.

- [ ] **Step 7: Commit**

```bash
cd /Users/patricia/team-status-dashboard
git add web/src/App.tsx web/src/App.test.tsx
git commit -m "feat(web): wire App to fetch roster.json and render the dashboard"
```

---

## Task 9: Accessibility pass + contrast verification

**Files:**
- Modify: `web/src/index.css` (focus ring application — already added; verify coverage)
- Create: `web/src/a11y.test.tsx`
- Create: `web/ACCESSIBILITY.md`

- [ ] **Step 1: Verify focus rings are applied to interactive elements**

Confirm the `tsd-focus` class is on the person-row `<button>` (PersonRow) and the "Correct row" `<button>` (ExpandedPanel). Both were added in Task 7. No code change if present.

- [ ] **Step 2: Write `web/src/a11y.test.tsx`** (color-plus-label + keyboard)

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RosterTable } from "./components/RosterTable";
import { derive } from "./roster";
import roster from "../public/roster.json";
import type { RosterData } from "./types";

const d = derive(roster as RosterData);

describe("accessibility", () => {
  it("each category is conveyed by a text label, not color alone", () => {
    render(<RosterTable d={d} />);
    // every distinct category present in the fixture appears as chip text somewhere
    expect(screen.getAllByText("Planned").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Incident").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Support").length).toBeGreaterThan(0);
  });

  it("person rows are keyboard-operable buttons", async () => {
    render(<RosterTable d={d} />);
    const first = screen.getByRole("button", { name: /Maya R\./ });
    first.focus();
    expect(first).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(first).toHaveAttribute("aria-expanded", "true");
  });
});
```

- [ ] **Step 3: Run the test**

Run: `cd web && npx vitest run src/a11y.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 4: Verify the new chip-field contrasts and record them**

The reused matcha-oat values are already AA. Verify the **new** app-local pairs are ≥4.5:1 using any WCAG contrast checker (e.g. webaim.org/resources/contrastchecker):
- support text `#6C6647` on `#EDEADD`
- lent text `--ink-2 #4C483E` on `#F1EFE9`
- incident text `--rust-deep #9A3D29` on `--rust-tint #F6E2DA`
- unplanned text `--yolk-tint-text #6A5320` on `--yolk-tint #FBEDC6`

Create `web/ACCESSIBILITY.md` recording: the WCAG 2.2 AA target, the inherited matcha-oat guarantees (matcha-deep for green text, focus ring, reduced motion), the color-plus-label rule, and the four measured contrast ratios above with pass/fail. If any pair is <4.5:1, darken its `--cat-*-text` value in `tokens.categories.css` the minimum needed and re-measure.

- [ ] **Step 5: Commit**

```bash
cd /Users/patricia/team-status-dashboard
git add web/src/a11y.test.tsx web/ACCESSIBILITY.md web/src/tokens.categories.css
git commit -m "test(web): a11y coverage + record chip-field contrast (WCAG 2.2 AA)"
```

---

## Task 10: CI + deploy (web.yml, retire old deploy, Pages)

**Files:**
- Create: `web/package.json` script `guardrail`; ensure `web/package-lock.json` committed
- Create: `.github/workflows/web.yml`
- Modify: `.github/workflows/dashboard.yml`

- [ ] **Step 1: Add the guardrail script to `web/package.json`**

Add to `"scripts"`:
```json
"guardrail": "node node_modules/matcha-oat-design-system/scripts/check-no-raw-values.mjs $(find src -type f \\( -name '*.ts' -o -name '*.tsx' -o -name '*.css' \\) ! -name 'tokens.categories.css')"
```

- [ ] **Step 2: Run the guardrail locally**

Run: `cd web && npm run guardrail`
Expected: `OK — no raw design values in N file(s).` If it flags a hex in a component, replace it with a token reference (`var(--…)`) or move the value into `tokens.categories.css`.

- [ ] **Step 3: Ensure the lockfile exists and is committed**

Run: `cd web && npm install` (writes `package-lock.json`). Confirm `web/package-lock.json` is not gitignored.

- [ ] **Step 4: Create `.github/workflows/web.yml`**

```yaml
name: web — build & deploy

on:
  push:
    branches: [main]
    paths: ["web/**", ".github/workflows/web.yml"]
  workflow_dispatch: {}

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deploy.outputs.page_url }}
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run guardrail
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: web/dist
      - id: deploy
        uses: actions/deploy-pages@v4
```

- [ ] **Step 5: Strip the deploy/publish steps from `.github/workflows/dashboard.yml`**

Edit `dashboard.yml` so the old Python demo no longer publishes (it must not compete for the Pages artifact). Remove: the `schedule:` triggers, the `permissions: pages/id-token`, the `concurrency: pages`, the `environment:` block, the `setup-node`, `Encrypt with staticrypt`, `upload-pages-artifact`, and `deploy-pages` steps. Keep `on: workflow_dispatch`, the checkout, `setup-python`, install, and the `Generate dashboard (--demo)` step as a build smoke-check. The resulting file:

```yaml
name: legacy demo — build check (no deploy)

# The Command View app (web/, see web.yml) is now the published Pages site.
# This keeps verifying the Python --demo generator builds, but no longer publishes.
on:
  workflow_dispatch: {}

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - name: Install package
        run: pip install -e .
      - name: Generate dashboard (POC — bundled fictional data, no Linear key)
        run: |
          python -m team_status.cli --demo --config config.json --snapshots snapshots --out dashboard.html
```

- [ ] **Step 6: Commit**

```bash
cd /Users/patricia/team-status-dashboard
git add web/package.json web/package-lock.json .github/workflows/web.yml .github/workflows/dashboard.yml
git commit -m "ci(web): build+test+guardrail+deploy to Pages; retire legacy demo deploy"
```

- [ ] **Step 7: Push the branch and open a PR (when ready)**

```bash
cd /Users/patricia/team-status-dashboard
git push -u origin feat/command-view-web-app
gh pr create --fill --base main
```
Expected: PR opened. The `web.yml` workflow runs on push to `main` (after merge) and deploys to `https://patriciagoh.github.io/team-status-dashboard/`. (GitHub Pages "Source" must be set to "GitHub Actions" in repo Settings → Pages — already configured for this repo.) After deploy, open the URL and confirm the Command View renders with the fixture roster.

---

## Self-Review notes (coverage)

- **Stack / repo layout / Paper-only / matcha-oat consumer** → Task 1.
- **Typed `RosterData` contract + fixture + category metadata** → Task 2.
- **Pure deriver (counts, off-plan, firefighting, changed, per-team)** → Task 3.
- **App-local category tokens + guardrail-excluded file** → Task 4 (+ guardrail Task 10).
- **Faithful components (chip/avatar/since/working-on; header; summary; table; expand)** → Tasks 5–7.
- **Fixture-first data flow (fetch → derive → render; honest loading/error)** → Task 8.
- **WCAG 2.2 AA (focus, color-plus-label, reduced motion, contrast verify)** → Tasks 7 + 9.
- **Vitest + RTL tests at each layer** → Tasks 2,3,5,6,7,8,9.
- **Deploy: new app takes over Pages, public, old deploy retired** → Task 10.
- **"Correct my row" display-only** → Task 7 (ExpandedPanel button, no handler).
- **Out of scope (Python→roster.json wiring, Terminal/Editorial themes)** → not implemented; contract leaves the seam.
