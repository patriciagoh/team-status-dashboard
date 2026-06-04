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
