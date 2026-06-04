# Command View — Phase 4: Package & deploy

**Date:** 2026-06-04
**Author:** Patricia Goh (with Claude)
**Status:** Approved for planning
**Part of:** Productionizing the Command View web app (Phases 0–5).
**Builds on:** Phase 3b (honest roster model) — merged in #6. Supabase project is live.

## Problem

The real app runs locally but isn't deployed, and the design system pulls fonts
from Google Fonts (leaking every visitor's IP). Phase 4 packages the app so it
deploys at a configurable base path, self-hosts its fonts, ships "run your own"
docs, and goes live on Vercel — while the public demo stays on GitHub Pages.
One repo → two deployments.

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Fonts | **Self-host** via `@fontsource/*`, only the families the app renders: **Newsreader**, **Hanken Grotesk**, **Space Mono**. **Drop Sacramento** (`--script`) — the app renders no script text. |
| Base path | Env-driven: `base: process.env.VITE_BASE \|\| "/team-status-dashboard/"`. Pages keeps the subpath default; Vercel sets `VITE_BASE=/`. |
| Vercel config | A committed **`web/vercel.json`** (reproducible + powers the Deploy button), root directory `web/`. |
| Deployments | **GitHub Pages = public demo** (local build, seeded, login-free); **Vercel = real app** (supabase build, login + data). |
| Docs | A "Run your own" section in `web/README.md` + a Deploy-to-Vercel button; `supabase/schema.sql` and `.env.example` already ship. |

## Self-hosted fonts

The leak: `node_modules/matcha-oat-design-system/fonts.css` `@import`s Google
Fonts. The app imports that file in `main.tsx`. The design tokens reference
families by name (`--serif: Newsreader`, `--sans: Hanken Grotesk`,
`--mono: Space Mono`, `--script: Sacramento`), so swapping the *delivery* changes
nothing else.

- **Remove** `import "matcha-oat-design-system/fonts.css"` from `main.tsx`.
- **Add** exact-pinned deps (`.npmrc` already sets `save-exact`): `@fontsource/newsreader`,
  `@fontsource/hanken-grotesk`, `@fontsource/space-mono`. Use the **non-variable**
  packages so family names match the tokens exactly.
- **Import** only the weights/styles the tokens use, in `main.tsx` (before
  `index.css`):
  - Newsreader: `400`, `500`, `600`, `400-italic`, `500-italic`
  - Hanken Grotesk: `400`, `500`, `600`, `700`
  - Space Mono: `400`, `700`
- **Sacramento is dropped** — `--script` is unused in the app. (If a future
  feature needs it, add `@fontsource/sacramento` then.)
- Both builds (demo + real) self-host, since the import is shared in `main.tsx` —
  the **public demo** stops leaking visitor IPs, which is the biggest win.

## Configurable base path

`web/vite.config.ts`:

```ts
base: process.env.VITE_BASE || "/team-status-dashboard/",
```

- The Pages CI build (`web.yml`) needs no change — the default keeps the project
  subpath, and assets resolve via `import.meta.env.BASE_URL` (already used for the
  demo's `roster.json` fetch).
- Vercel sets `VITE_BASE=/` so the real app serves from the domain root.

## Vercel config + deploy

`web/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm ci"
}
```

No SPA rewrite is needed — the app has no client-side router (full-page views via
state). RLS + the auth gate already protect data; nothing about deploy changes
that.

**Human step (the deployer):**
1. Import the GitHub repo into Vercel; set **Root Directory = `web`**.
2. Environment variables: `VITE_BACKEND=supabase`, `VITE_SUPABASE_URL=…`,
   `VITE_SUPABASE_ANON_KEY=…` (the publishable key), `VITE_BASE=/`.
3. Deploy. Vercel serves the real app at its `*.vercel.app` URL (custom domain
   optional, out of scope).

The Pages demo deploy (`web.yml`, on push to `main`) is unchanged and keeps
publishing the login-free seeded demo. Two deployments, one repo.

## "Run your own" docs

A new **"Run your own"** section in `web/README.md`:
- Prerequisites (a Supabase project, a Vercel account).
- Supabase setup: create project → run `web/supabase/schema.sql` (creates
  `app_data` with `data` + `work` columns + RLS) → **disable public signups** →
  **Authentication → Users → Add user** → copy Project URL + **anon/publishable**
  key (never the service key).
- Vercel: import repo, Root Directory `web`, set the env vars above, deploy.
- A **Deploy-to-Vercel button** linking the repo with the env vars pre-listed.
- Note: the public demo build is `VITE_BACKEND=local` (no backend, no login).

## Testing & verification

- The full gate stays green (`npm test`, `typecheck`, `lint`, `guardrail`).
- **Both base paths build:** default (`npm run build`) and root
  (`VITE_BASE=/ npm run build`) both succeed and asset URLs reflect the base.
- **Fonts self-hosted:** the built CSS/assets contain self-hosted `@font-face`
  (woff2) for the three families and **no `googleapis`/`gstatic`** reference
  anywhere in `dist/`.
- **Demo bundle** (`VITE_BACKEND=local`) still ships no Supabase SDK.
- (No new unit tests — this phase is build/config/docs. A lightweight check that
  `main.tsx` no longer imports the design-system `fonts.css` and that `dist` has
  no Google Fonts reference is the meaningful verification.)

## Out of scope

- Sentry / observability / uptime → **Phase 5**.
- The pipeline → Supabase `work` sync (live pulled data) → its own later phase;
  until then the deployed real app shows "not yet synced".
- Custom domain, SSR, client-side routing.

## Risks

- **Stale env / inlined `VITE_*`:** Vite inlines `VITE_*` at build time, so the
  Vercel env must be set *before* the build; changing it later needs a redeploy.
  Documented in the README.
- **Font weight gaps:** if a token weight isn't imported, the browser
  synthesizes it (faux bold/italic). Mitigation: import exactly the weights the
  Google import declared (listed above); verify the rendered headings/italics.
- **Base-path asset 404s:** mismatched `VITE_BASE` 404s assets. Mitigation: the
  env-driven base + building both variants in verification.
