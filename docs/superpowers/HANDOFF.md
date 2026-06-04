# Command View — Productionization Handoff

> **Purpose of this doc:** hand off the in-progress productionization of the
> `web/` Command View app to a fresh Claude Code session (different account /
> machine). It explains the goal, the architecture, what's done, what's left,
> and exactly how to continue. Written 2026-06-04, paused mid–Phase 5.

---

## 0. TL;DR for the next session

- We're turning a vibe-coded React SPA (`web/`) into a real, deployed,
  self-hostable product, following the **`/productionize-prototype`** playbook in
  small reviewed phases. **Phases 0–4 are done and merged** (PRs #2–#7).
  **Phase 5 (observability) is designed and approved-in-principle but NOT built**
  — that's the resume point.
- The work method is the **superpowers** skills: per phase →
  `brainstorming` → `writing-plans` → `subagent-driven-development` (fresh
  subagent per task/chunk + spec review + code-quality review) →
  `finishing-a-development-branch`. One branch + one PR per phase; `main` stays
  green. Phases touching auth/persistence/telemetry get a **mandatory final
  adversarial review** before merge.
- Specs live in `docs/superpowers/specs/`, plans in `docs/superpowers/plans/`.
  Read those for any phase before touching it.
- The app builds in two modes via `VITE_BACKEND`: `local` (public demo, seeded
  fictional data, no login → GitHub Pages) and `supabase` (the real app, login +
  private per-user data → Vercel).

---

## 1. What we're building (the goal)

A "Command View" team-status dashboard. Its **nature is that work data is pulled
from Linear + Slack and auto-classified** by an existing **Python pipeline**
(`src/team_status/`), which classifies each engineer's current work into
`planned / adhoc / lent / support / unplanned / incident` with a confidence cue
and a "since last look" diff, and supports human **corrections**.

The `web/` app is the high-fidelity React front-end ("Command View", Matcha Oat
design system). We are productionizing **just the web app** into:
- a **public demo** (fictional data, no login) on GitHub Pages, and
- a **real, private, single-operator app** (email/password login, per-user data
  in Supabase) on Vercel,

with an **honest data model**: the human manages **engineers + their Linear/Slack
identity mapping** and **corrections**; the **work state is pulled** (read-only in
the app). The actual pull→Supabase sync is a **deferred future phase** (see §6).

**Ownership model:** single-operator — one logged-in user (an EM/lead) owns their
whole roster as one private document. No cross-user sharing.

---

## 2. Architecture (as built)

### Two-part system
- **Python pipeline** (`src/team_status/`, repo root) — pulls Linear/Slack,
  classifies, applies corrections, renders an HTML dashboard. **Untouched** by
  this productionization except as the future source of pulled work data. Key
  bits: `linear_client.py` (GraphQL `members { id name email }` + issues),
  `slack_client.py` (maps Slack→people by **email**), `classify.py`,
  `corrections.py` (member_id → override), `config.py` (`TeamConfig`).
- **Web app** (`web/`) — React 19 + TypeScript + Vite + Tailwind + Matcha Oat
  design system (a private GitHub dependency, SHA-pinned). This is what we're
  productionizing.

### The web app's data model (Phase 3b — the "honest" model)
Stored document (`web/src/types.ts`):
```ts
RosterDoc = {
  engineers: Engineer[];                      // HUMAN-owned: {id,name,role,team,linearUserId,email}
  corrections: Record<string, Correction>;    // HUMAN-owned: {cat?, note?} keyed by engineer id
  work: { syncedAt: string|null; states: Record<string, WorkState> }; // PIPELINE-owned (read-only in app)
}
```
- A pure **`mergeRoster(doc)`** (`web/src/roster/merge.ts`) composes the three
  layers into the legacy **`RosterData`** (`teams[]` of `Person`) display
  contract, which feeds the existing pure **`derive()`** (`web/src/roster.ts`)
  and all components. A `Person` with no work and no signal-bearing correction
  gets `hasActivity:false` → renders "no tracked activity" and is excluded from
  category tallies.

### Seams (testable boundaries — this is how the app stays clean)
- **Persistence:** `RosterStore` (`load(): RosterDoc` / `save(doc)`) +
  internal `RowStore` (`getRow(): {data,work}|null` / `putHuman(human)`).
  Implementations: `localRosterStore` (demo: fetch `public/roster.json`),
  `supabaseRosterStore` over `supabaseRowStore` (live). `sanitizeDoc()` is the
  one load boundary (backfills, **migrates** legacy shapes, **throws** on
  unrecognized — never overwrites). `useRoster()` hook owns load +
  **save-then-commit** (await save BEFORE updating UI; on failure keep input).
  `createRosterStore()` factory routes on `VITE_BACKEND`.
- **Auth (Phase 2):** `AuthPort` (`getSession/signIn/signOut/onAuthChange`) over
  the shared Supabase client; `createAuthPort()` returns `null` in the demo.
  `Root.tsx` is the gate: `onAuthChange` is authoritative; no session → `Login`,
  session → `App`. **No public signup.**
- **CRUD (Phase 3/3b):** pure engineer/correction mutations
  (`web/src/roster/mutations.ts`); `App.tsx` has a `view` state (list/add/edit)
  and an `editable` prop (true only in the authed build). The full-page
  `PersonForm` edits engineer config + correction; work is read-only.

### Storage (Supabase) — **no-clobber design**
One row per user in table `app_data`:
```
app_data(owner uuid PK → auth.users(id) on delete cascade,
         data jsonb,   -- HUMAN: engineers + corrections (web app writes this)
         work jsonb,   -- PIPELINE: pulled work snapshot (server-side only; app NEVER writes it)
         updated_at)
```
Row Level Security: `auth.uid() = owner` for select/insert/update. The web app
upserts **only the `data` column**, so it can never clobber pipeline `work`.
Schema is shipped at `web/supabase/schema.sql`.

### Builds & deployments
- `VITE_BACKEND=local` (default) → demo: seeded `public/roster.json`, no login,
  Supabase SDK **dynamically imported and excluded** from the bundle. Deploys to
  **GitHub Pages** via `.github/workflows/web.yml` on push to `main`.
- `VITE_BACKEND=supabase` → real app: login + per-user data. Deploys to **Vercel**
  (human step — see §5). Base path is env-driven (`VITE_BASE`): Pages serves
  under `/team-status-dashboard/`, Vercel at `/`.
- Fonts are **self-hosted** via `@fontsource` (Phase 4) — no Google Fonts (no
  visitor IP leak), on both deployments.

---

## 3. What's done (Phases 0–4, all merged to `main`)

Each was: brainstorm → spec → plan → subagent-driven TDD build with reviews →
adversarial review (where relevant) → PR → squash-merge. Live-verified where noted.

| Phase | PR | What it did |
|---|---|---|
| 0 — Harden | #2 | Security + code review baseline; fixed the "off plan" tally bug (TDD); MIT `LICENSE`; supply-chain hardening (`web/.npmrc` `ignore-scripts`+`save-exact`, pinned react). Prod `npm audit` = 0. |
| 1 — Supabase backend | #3 | `RosterStore`/`RowStore` seam; `sanitize` load boundary (throw on garbage); local + Supabase stores; `VITE_BACKEND` factory with **dynamic-imported SDK**; `app_data` + RLS schema. **Live-verified.** |
| 2 — Login | #4 | `AuthPort` + `Root` gate (onAuthChange authoritative); styled AA `Login` (no signup, generic error); sign-out in `Header`. **Live-verified.** Caught/fixed a real getSession-vs-onAuthChange race. |
| 3 — CRUD | #5 | Stable `Person.id`; pure mutations; `useRoster` save-then-commit; full-page form; `editable` gate. (Superseded in shape by 3b.) |
| 3b — Honest roster model | #6 | The big rethink: split into engineer-config / pulled-work / corrections; `mergeRoster`; no-activity "not tracked"; **two-column `data`/`work` no-clobber storage**; legacy migration; form → engineer+correction editor. **Live-verified.** |
| 4 — Package & deploy | #7 | Self-host fonts (drop Google Fonts `@import`); env-driven base path (`VITE_BASE`); `web/vercel.json`; "Run your own" README + Deploy button. |

**Supabase project** is created and live (URL + publishable key below). Phases
1, 2, 3b were tested end-to-end in the browser against it.

---

## 4. What's left

### Phase 5 — Observability (DESIGNED + APPROVED, NOT BUILT) ← resume here
Privacy-scrubbed, opt-in telemetry. **This is the immediate next task.** The
design was agreed (full stack) but the spec was not yet written. Build it via the
normal cycle, and **it requires a mandatory adversarial review** (telemetry has
leaked PII in this exact stack — see gotchas). Full agreed design in §7.

### Deferred future phase — Pipeline → Supabase `work` sync
The Python pipeline should write the pulled/classified work snapshot into
Supabase's `work` column (server-side **service key**, on its existing schedule),
keyed by engineer `linearUserId` (Linear work) / `email` (Slack). Until this
lands, the deployed real app shows engineers as **"not yet synced / no tracked
activity."** This is its own brainstorm → plan → build cycle and touches the
Python side. Not started.

### Outstanding human (dashboard) steps — cannot be automated
1. **Deploy the real app to Vercel** (see §5). Not done yet.
2. **Phase 5 end:** create a Sentry project → set `VITE_SENTRY_DSN`
   (+ `VITE_VERCEL_INSIGHTS=1`) in Vercel → redeploy; set a free uptime monitor
   on the Vercel + Pages URLs.

---

## 5. Environment, secrets, and the Vercel deploy

**`web/.env.local` is gitignored and will NOT transfer** with the repo. Recreate
it on the new machine to run the real app locally. The values are **browser-safe**
(publishable anon key; RLS is the real protection):
```
VITE_BACKEND=supabase
VITE_SUPABASE_URL=https://zobciipvpvfjzhfrenem.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_QJuPruCaHkxLx7xKaVvfjw_hW6988DG
```
(For the demo, no env is needed — `npm run dev` runs `local` by default.)

**Supabase project** `zobciipvpvfjzhfrenem`: schema run; public signups disabled;
one login user exists; the Phase 3b `work` column was added via
`alter table app_data add column if not exists work jsonb not null default '{}'::jsonb;`.

**Vercel deploy (human step, not done):**
1. vercel.com → Add New → Project → import `patriciagoh/team-status-dashboard`.
2. **Root Directory = `web`** (monorepo — important).
3. Env vars: `VITE_BACKEND=supabase`, `VITE_SUPABASE_URL=…`,
   `VITE_SUPABASE_ANON_KEY=…` (above), `VITE_BASE=/`.
4. Deploy. Then add the resulting `*.vercel.app` URL to **Supabase → Authentication
   → URL Configuration** (site/redirect URLs) so login works from that origin.

GitHub Pages demo auto-deploys from `main` via `.github/workflows/web.yml` — no
action needed.

---

## 6. How to work in this repo (conventions the next session MUST follow)

- **Run everything from `web/`** (the app is a subdir): `cd web` first. Commands:
  `npm test` (Vitest), `npm run typecheck` (`tsc -b`), `npm run lint`,
  `npm run guardrail` (design-token check — no raw hex/values outside
  `tokens.categories.css`), `npm run build`.
- **TDD always:** write the failing test, see it fail, implement, see it pass,
  commit. Frequent small commits. No Co-Authored-By needed unless asked (this
  session used an Opus trailer; match repo style or omit).
- **Per-phase workflow (superpowers skills):** `brainstorming` (settle intent +
  design, get approval, write spec to `docs/superpowers/specs/`) →
  `writing-plans` (TDD task plan to `docs/superpowers/plans/`) →
  `subagent-driven-development` (fresh subagent per task/chunk; **spec-compliance
  review then code-quality review** after each; fix before proceeding) →
  `finishing-a-development-branch`. **One branch + one PR per phase**; merge only
  when CI is green; squash-merge + delete branch.
- **Mandatory adversarial final review** for anything touching auth / persistence
  / telemetry (Phase 5 qualifies).
- **Deps:** exact-pinned (`.npmrc` has `save-exact`); keep prod `npm audit` at 0
  (dev-only advisories — vitest/vite/esbuild — are deferred).
- **CI:** `.github/workflows/web.yml` runs typecheck · test · guardrail · build on
  PRs and on `main`; deploy (Pages) only on `main`. The build step is pinned to
  `VITE_BACKEND=local` so the demo excludes the SDK.

---

## 7. Phase 5 — the full agreed design (build this next)

**Goal:** privacy-scrubbed, opt-in observability — off by default, sends nothing
in the demo, self-hosters get zero telemetry. Resume by: open `brainstorming`,
re-present this design, get the user's approval, then `writing-plans` →
`subagent-driven-development` → **adversarial review** → PR.

**Single module `web/src/observability.ts`:**
- `initObservability()` — **DSN-gated** (`import.meta.env.VITE_SENTRY_DSN`); if no
  DSN, return (off). Else dynamic-import `@sentry/react` (keeps it out of the
  entry bundle) and `Sentry.init({...})` with this EXACT privacy posture:
  - `sendDefaultPii: false`
  - **`defaultIntegrations: false`** ← critical; `integrations: []` does NOT
    disable Sentry's defaults (they merge). Re-add only content-free ones (none).
  - `beforeBreadcrumb: () => null` — **drop ALL breadcrumbs** (DOM breadcrumbs
    capture `aria-label` text, which in this app contains user names).
  - `beforeSend: scrub` — strip `request`, `user`, `extra`, `contexts`,
    `server_name`, breadcrumbs; keep only the exception + an `{ op }` tag.
  - **Never `setUser`**; no Session Replay.
- `captureError(op, err)` — no-op if not initialized; else
  `captureException(err, { tags: { op } })` (only the safe `op` tag).
- A React **`ErrorBoundary`** (class) wraps the app in `main.tsx`:
  `componentDidCatch` → `captureError("render", err)` + a plain "Something went
  wrong." fallback (NO data). Wire `useRoster` load failure →
  `captureError("load", e)` and save failure → `captureError("save", e)` (before
  rethrow). **Do NOT report Login/auth failures** (expected wrong-password noise).
- **Cookieless perf** gated by `VITE_VERCEL_INSIGHTS=1`: dynamic-import +
  `injectSpeedInsights()` (`@vercel/speed-insights`) + `inject()`
  (`@vercel/analytics`).
- **Gating/bundle:** all three SDKs dynamic-imported behind their env gates →
  code-split out of the entry bundle, never load/run without the env. The demo
  (no DSN, no flag) runs no telemetry. (A never-fetched lazy chunk may exist in
  `dist` — acceptable; it never executes. Be honest about this in verification:
  assert the *entry* bundle has no `@sentry`/`@vercel` and nothing inits without
  the env, rather than claiming the chunk is physically deleted.)
- **README** honest privacy wording: demo sends nothing; the real build opts in
  only when `VITE_SENTRY_DSN`/`VITE_VERCEL_INSIGHTS` are set; self-hosters inherit
  zero telemetry; document what's scrubbed.
- **Tests (TDD):** `scrub` strips request/user/extra/breadcrumbs and keeps the
  `op` tag; `initObservability`/`captureError` no-op when `VITE_SENTRY_DSN` is
  unset (pin it empty in `vitest.config.ts` `test.env`, like the other VITE_
  vars); `ErrorBoundary` renders the fallback and calls `captureError("render")`
  without leaking children's data; demo build excludes active telemetry and still
  excludes the Supabase SDK.
- **Human steps (end):** create Sentry project → DSN → set env in Vercel →
  redeploy; set uptime monitor. Then validate: trigger an error, confirm the
  Sentry event is **clean** (no names/notes/emails/user).

---

## 8. Hard-won gotchas (these bit us — don't relearn them)

- **Dynamic-import only excludes an SDK from a build if the guarding flag is a
  build-time constant.** An *unset* `VITE_*` var is not statically replaced, so
  the lazy chunk still emits. The demo Pages build is pinned to
  `VITE_BACKEND=local` precisely so the `=== "supabase"` branch is dead-code
  eliminated. (Phase 5 telemetry: see the honest caveat in §7.)
- **`.env.local` leaks into Vitest.** A developer's `web/.env.local`
  (`VITE_BACKEND=supabase`) flipped the factory/gate unit tests off their `local`
  default. Fixed by pinning `test.env` in `web/vitest.config.ts`
  (`VITE_BACKEND/VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY: ""`). Keep this; add
  `VITE_SENTRY_DSN: ""` for Phase 5.
- **`tsc -b` is the real "does it build" check**, not just `tsc --noEmit`. Always
  run `npm run build` / `npm run typecheck`.
- **Save-then-commit, never optimistic:** `useRoster.commit` awaits `save` before
  `setState`; a failed save leaves state unchanged and the form keeps the user's
  input. Preserve this.
- **No-clobber:** the web app must only ever write the `data` column. `work` is
  pipeline-owned. The `HumanDoc` seam type enforces this — don't widen it.
- **Honest empties:** never fabricate a category for an engineer with no pulled
  work; use `hasActivity:false` and exclude from tallies.
- **`sanitizeDoc` throws on unrecognized blobs** (never silently overwrites) and
  migrates legacy shapes — keep both behaviors.
- **Reshapes that change shared types** (e.g. Phase 3b) won't `tsc` until the
  integration tasks land; during the build verify with **targeted
  `npx vitest run <file>`** (esbuild per-file) and defer the full gate to the end.

---

## 9. Key files map

```
web/
  src/
    types.ts                     # RosterDoc model + Person (display) + hasActivity
    roster.ts                    # derive() (pure tallies; skips hasActivity:false)
    roster/merge.ts              # mergeRoster(doc) → RosterData (the 3-layer compose)
    roster/mutations.ts          # pure engineer + correction mutations
    useRoster.ts                 # load + save-then-commit hook (holds RosterDoc)
    App.tsx                      # view state, editable gate, CRUD wiring
    Root.tsx                     # auth gate (onAuthChange authoritative)
    rosterActions.ts             # context delivering onEditPerson to ExpandedPanel
    storage/
      RosterStore.ts             # RosterStore + RowStore + HumanDoc seam types
      sanitize.ts                # sanitizeDoc + emptyDoc + legacy migration (load boundary)
      localRosterStore.ts        # demo (fetch public/roster.json)
      supabaseRosterStore.ts     # live store over RowStore (bootstrap, merge columns)
      supabaseRowStore.ts        # thin Supabase binding (reads data+work, writes data only)
      supabaseClient.ts          # shared dynamic-imported client (data + auth)
      createRosterStore.ts       # factory on VITE_BACKEND
    auth/
      AuthPort.ts                # auth seam
      supabaseAuthPort.ts        # testable core + live binding
      createAuthPort.ts          # factory (null in demo)
    components/                  # Header, Login, PersonForm, RosterTable, PersonRow,
                                 #   ExpandedPanel, WorkingOn, CategoryChip, ... (+ tests)
    main.tsx                     # bootstrap: createAuthPort() → <Root> (wrap in ErrorBoundary in P5)
  public/roster.json             # demo fixture (now a RosterDoc with baked work snapshot)
  supabase/schema.sql            # app_data table + RLS (+ work column + ALTER note)
  vite.config.ts                 # env-driven base (VITE_BASE)
  vitest.config.ts               # test.env pins VITE_* (immune to .env.local)
  vercel.json                    # Vercel build config
  .env.example                   # documents the real-build env
.github/workflows/web.yml        # CI + Pages deploy (build pinned VITE_BACKEND=local)
docs/superpowers/specs/          # one design spec per phase (READ before each phase)
docs/superpowers/plans/          # one TDD plan per phase
src/team_status/                 # the Python pipeline (future work-data source)
```

---

## 10. Suggested first moves for the next session

1. `cd web && npm ci && npm test && npm run build` — confirm green baseline (100
   tests).
2. Recreate `web/.env.local` (§5) if you want to run the real app locally
   (`npm run dev` → http://localhost:5173/team-status-dashboard/).
3. (Optional, human) do the Vercel deploy (§5) so Phase 5's live validation has a
   target.
4. **Build Phase 5** using the agreed design in §7: open `brainstorming`,
   re-confirm the design with the user, write the spec to
   `docs/superpowers/specs/2026-…-phase-5-observability-design.md`, then
   `writing-plans` → `subagent-driven-development` → **adversarial review** → PR.
5. Later: the deferred pipeline → Supabase `work` sync (§4).
```
