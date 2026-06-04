# Command View Phase 4 — Package & Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Self-host fonts (kill the Google Fonts IP leak), make the base path configurable, and package the app to deploy on Vercel (real app) alongside the GitHub Pages demo.

**Architecture:** Replace the design system's Google-Fonts `@import` with `@fontsource` imports in `main.tsx`; make `vite.config` base env-driven (`VITE_BASE`); add `web/vercel.json` + a "Run your own" README with a Deploy button. No app-logic changes — config, fonts, and docs.

**Tech Stack:** Vite, `@fontsource/*`, Vercel, GitHub Pages.

**Working directory:** `web/` (run `cd web` first). This phase has no unit tests — each task ends in a build/verify command with expected output.

**Spec:** `docs/superpowers/specs/2026-06-04-command-view-phase-4-deploy-design.md`

---

### Task 1: Self-host fonts via `@fontsource`

**Files:** Modify `web/package.json` (add deps), `web/src/main.tsx`

- [ ] **Step 1: Add the font packages (exact-pinned)**

Run: `npm install --save-exact @fontsource/newsreader @fontsource/hanken-grotesk @fontsource/space-mono`
Expected: installs three packages at exact versions (no `^`), no lifecycle scripts run (`.npmrc` has `ignore-scripts=true`; `@fontsource` packages have none anyway).

- [ ] **Step 2: Replace the Google-Fonts import in `main.tsx`**

In `web/src/main.tsx`, **remove** this line:

```ts
import "matcha-oat-design-system/fonts.css";
```

and in its place add (keep `tokens.css`, `tokens.categories.css`, and `index.css` imports as they are; these font imports go immediately after the `tokens.css` import and before `index.css`):

```ts
// Self-hosted fonts (no Google Fonts @import → no visitor-IP leak). Only the
// weights/styles the Matcha Oat tokens use; Sacramento (--script) is unused.
import "@fontsource/newsreader/400.css";
import "@fontsource/newsreader/500.css";
import "@fontsource/newsreader/600.css";
import "@fontsource/newsreader/400-italic.css";
import "@fontsource/newsreader/500-italic.css";
import "@fontsource/hanken-grotesk/400.css";
import "@fontsource/hanken-grotesk/500.css";
import "@fontsource/hanken-grotesk/600.css";
import "@fontsource/hanken-grotesk/700.css";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
```

For reference, the resulting `main.tsx` import block should read:

```ts
import React from "react";
import ReactDOM from "react-dom/client";
import "matcha-oat-design-system/tokens.css";
import "@fontsource/newsreader/400.css";
import "@fontsource/newsreader/500.css";
import "@fontsource/newsreader/600.css";
import "@fontsource/newsreader/400-italic.css";
import "@fontsource/newsreader/500-italic.css";
import "@fontsource/hanken-grotesk/400.css";
import "@fontsource/hanken-grotesk/500.css";
import "@fontsource/hanken-grotesk/600.css";
import "@fontsource/hanken-grotesk/700.css";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import "./tokens.categories.css";
import "./index.css";
import { Root } from "./Root";
import { createAuthPort } from "./auth/createAuthPort";
```

- [ ] **Step 3: Build and verify the fonts are self-hosted with no Google reference**

Run: `npm run build && grep -rliq "googleapis\|gstatic" dist && echo "LEAK ❌" || echo "no google fonts ✓"`
Expected: `no google fonts ✓`.
Run: `ls dist/assets/*.woff2 | head` 
Expected: self-hosted `.woff2` files are present (newsreader/hanken-grotesk/space-mono).

- [ ] **Step 4: Confirm the suite is still green**

Run: `npm test && npm run typecheck && npm run lint && npm run guardrail`
Expected: all PASS (the `guardrail` ignores font CSS; tests unaffected).

- [ ] **Step 5: Commit**

```bash
git add web/package.json web/package-lock.json web/src/main.tsx
git commit -m "feat(web): self-host fonts via @fontsource; drop Google Fonts @import (IP leak)"
```

---

### Task 2: Configurable base path

**Files:** Modify `web/vite.config.ts`

- [ ] **Step 1: Make the base env-driven**

In `web/vite.config.ts`, change the `base` line to:

```ts
  // Pages demo serves under the repo subpath (default); Vercel sets VITE_BASE=/.
  base: process.env.VITE_BASE || "/team-status-dashboard/",
```

- [ ] **Step 2: Verify both base paths build**

Run: `npm run build && grep -q '/team-status-dashboard/assets/' dist/index.html && echo "subpath ✓"`
Expected: `subpath ✓` (default base prefixes assets with the repo subpath).
Run: `VITE_BASE=/ npm run build && grep -q '"/assets/' dist/index.html && echo "root ✓"`
Expected: `root ✓` (root base prefixes assets with `/assets/`).
Then restore the default build: `npm run build >/dev/null 2>&1`.

- [ ] **Step 3: Commit**

```bash
git add web/vite.config.ts
git commit -m "feat(web): env-driven base path (VITE_BASE) for Pages subpath vs Vercel root"
```

---

### Task 3: Add `web/vercel.json`

**Files:** Create `web/vercel.json`

- [ ] **Step 1: Create the Vercel config**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm ci"
}
```

- [ ] **Step 2: Validate it is well-formed JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('valid json ✓')"`
Expected: `valid json ✓`.

- [ ] **Step 3: Commit**

```bash
git add web/vercel.json
git commit -m "feat(web): add vercel.json (framework vite, root web/)"
```

---

### Task 4: "Run your own" README + Deploy button

**Files:** Modify `web/README.md`

- [ ] **Step 1: Replace `web/README.md` with the deploy-aware version**

```md
# Command View

The React + Tailwind front-end for the Team Status dashboard, styled with the
Matcha Oat design system. It runs in two modes via the `VITE_BACKEND` build flag:

- **`local`** (default) — the public demo: bundled fictional data, no login, no
  backend. This is what deploys to GitHub Pages.
- **`supabase`** — the real app: email/password login and a private, per-user
  roster stored in Supabase.

## Develop

```sh
npm install
npm run dev          # demo (local) by default
```

For the real app locally, create `.env.local` (see `.env.example`) with
`VITE_BACKEND=supabase` + your Supabase URL and anon key, then `npm run dev`.

## Test & build

```sh
npm test
npm run build        # demo build; VITE_BASE defaults to the Pages subpath
```

## Run your own (real app on Vercel)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fpatriciagoh%2Fteam-status-dashboard&root-directory=web&env=VITE_BACKEND,VITE_SUPABASE_URL,VITE_SUPABASE_ANON_KEY,VITE_BASE&project-name=command-view&repository-name=command-view)

**1. Supabase** (free tier):
- Create a project. In the SQL editor, run [`supabase/schema.sql`](supabase/schema.sql)
  (creates `app_data` with `data` + `work` columns and Row Level Security).
- **Authentication → Sign In / Providers:** keep Email enabled and **turn off
  "Allow new users to sign up"** (no public registration).
- **Authentication → Users → Add user:** your email + a password (auto-confirm).
- **Project Settings → API:** copy the **Project URL** and the **anon /
  publishable** key (never the `service_role` key).

**2. Vercel:**
- Import this repo. Set **Root Directory = `web`** (the Deploy button pre-fills
  the rest).
- Environment variables:
  - `VITE_BACKEND=supabase`
  - `VITE_SUPABASE_URL=` your Project URL
  - `VITE_SUPABASE_ANON_KEY=` your anon/publishable key
  - `VITE_BASE=/`
- Deploy. (Vite inlines `VITE_*` at build time — if you change an env var later,
  redeploy.)

Result: one repo, two deployments — the **GitHub Pages demo** (login-free,
fictional) and your **private Vercel app** (login + your data).

> Pulled work data (category / "working on" / tickets) is produced by the Python
> pipeline and written to Supabase's `work` column in a later phase; until then a
> freshly-added engineer reads "not yet synced".
```

- [ ] **Step 2: Verify the markdown has the button and the schema link**

Run: `grep -q "vercel.com/new/clone" README.md && grep -q "supabase/schema.sql" README.md && echo "readme ✓"`
Expected: `readme ✓`.

- [ ] **Step 3: Commit**

```bash
git add web/README.md
git commit -m "docs(web): 'Run your own' README + Deploy-to-Vercel button"
```

---

### Task 5: Final verification gate

**Files:** none (verification only).

- [ ] **Step 1: Full gate**

Run: `npm test && npm run typecheck && npm run lint && npm run guardrail`
Expected: all PASS.

- [ ] **Step 2: Demo build — no Google Fonts, no Supabase SDK**

Run: `VITE_BACKEND=local npm run build`
Then: `grep -rliq "googleapis\|gstatic" dist && echo "FONT LEAK ❌" || echo "fonts ok ✓"`
Then: `grep -riq "supabase" dist/assets && echo "SDK LEAK ❌" || echo "sdk excluded ✓"`
Expected: `fonts ok ✓` and `sdk excluded ✓`.

- [ ] **Step 3: Real (root-base, supabase) build compiles**

Run: `VITE_BASE=/ VITE_BACKEND=supabase VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=test npm run build`
Expected: build succeeds; `grep -q '"/assets/' dist/index.html` → root-relative assets.
Then restore the demo build: `npm run build >/dev/null 2>&1`.

- [ ] **Step 4: Confirm a clean tree**

```bash
git status   # expect clean; dist/ is gitignored
```

---

## Self-Review

**Spec coverage:**
- Self-host fonts (Newsreader/Hanken Grotesk/Space Mono; drop Sacramento; exact weights) → Task 1. ✔
- Configurable base path (`VITE_BASE`) → Task 2. ✔
- `web/vercel.json` → Task 3. ✔
- "Run your own" README + Deploy button → Task 4. ✔
- Verification (both bases build; no googleapis; demo SDK-free) → Tasks 1/2/5. ✔
- Vercel deploy itself → human step, documented in the README + the phase wrap (not an automated task).

**Placeholder scan:** none; every step has exact content/commands with expected output.

**Consistency:** font weights match the spec (Newsreader 400/500/600 + 400/500 italic; Hanken 400/500/600/700; Space Mono 400/700). `VITE_BASE` default `/team-status-dashboard/` matches the current Pages base. The Deploy button lists exactly the four env vars the spec requires.
