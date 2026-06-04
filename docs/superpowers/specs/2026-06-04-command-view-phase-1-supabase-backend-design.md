# Command View — Phase 1: Supabase Backend (single-operator, one JSON doc per user)

**Date:** 2026-06-04
**Author:** Patricia Goh (with Claude)
**Status:** Approved for planning
**Part of:** Productionizing the Command View web app (`/productionize-prototype`, Phases 0–5).
**Builds on:** Phase 0 (harden) — merged in #2. `2026-06-03-team-status-command-view-react-app-design.md` (the prototype).

## Problem

The Command View app (`web/`) is a read-only viewer that fetches a static
`public/roster.json` fixture in `App.tsx` and renders it. There is **no
persistence seam** — data loading is welded into `App` via inline `fetch`. To
become a real product, the app needs **cloud storage that is per-user and
private**, behind an injectable seam, without disturbing the public demo.

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Ownership model | **Single-operator command view** — one logged-in user (an EM/lead) owns their **whole team roster** as one private JSON document. "Correct my row" → "edit any row in my own dashboard". No cross-user sharing (deferred). |
| Data shape | **One JSON document per user**: a single `app_data` table, `owner uuid primary key`, `data jsonb`, `updated_at`. RLS: a user reads/writes only `auth.uid() = owner`. |
| First-run state | Bootstrap a valid **empty** roster (`{ teams: [], snapshot: today }`), not the demo fixture. Dashboard shows an honest empty state until Phase 3 adds CRUD. |
| Build flag | `VITE_BACKEND=local` (default, public demo, seeded fixture, no login) \| `supabase` (the real app). |
| SDK loading | `@supabase/supabase-js` is **dynamic-imported** so the demo bundle ships none of it. |
| Auth sequencing | Login is **Phase 2**. Phase 1 ships the seam + both stores + sanitizer + `schema.sql` + unit tests against a fake. The live Supabase round-trip is exercised after Phase 2. |

## Architecture

```
web/src/storage/
├── RosterStore.ts          # app-facing seam + RowStore sub-seam (interfaces + re-exports)
├── sanitize.ts             # sanitizeRoster() — the one load boundary; emptyRoster(); todaySnapshot()
├── localRosterStore.ts     # LocalRosterStore — fetch public/roster.json → sanitize (demo)
├── supabaseRosterStore.ts  # SupabaseRosterStore (bootstrap/sanitize over a RowStore)
├── supabaseRowStore.ts     # SupabaseRowStore + shared client; thin network binding; dynamic import
└── createRosterStore.ts    # async factory: reads VITE_BACKEND → returns a RosterStore
web/supabase/schema.sql     # app_data table + RLS (human runs in dashboard)
web/.env.example            # VITE_BACKEND, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

Each unit has one job: interfaces in `RosterStore.ts`; `sanitize.ts` is pure;
the two stores are the seam implementations; `supabaseRowStore.ts` is the only
file that talks to the network/SDK; `createRosterStore.ts` is the wiring.

## The seam

```ts
// app-facing — what App depends on
export interface RosterStore {
  load(): Promise<RosterData>;
  save(data: RosterData): Promise<void>;
}

// adapter-internal sub-seam — raw row I/O, so bootstrap/sanitize is testable against a fake
export interface RowStore {
  getRow(): Promise<unknown | null>; // null = no row yet (first run)
  putRow(data: RosterData): Promise<void>;
}
```

## Load boundary — `sanitizeRoster(raw: unknown): RosterData`

The single place untrusted/old JSON becomes typed `RosterData`. **Both** stores
route through it (the trusted fixture too, for a uniform boundary).

- Recognized shape (`raw.teams` is an array, `raw.snapshot` is an object) →
  backfill missing optional fields (`detail` → `{ tickets: [], note: "" }`,
  `since` → `null`, `conf` → `"high"`), clamp an out-of-union `cat` to a safe
  default and keep a text label (never index a fixed record with an unknown key).
- `raw` is **non-null but unrecognized** → **throw** (surfaces as a load error).
  Never silently overwrite a user's row.
- `null` is *not* handled here — the store decides (bootstrap). `sanitizeRoster`
  returns a **new** object; we never use a `parsed !== sanitized` check to
  decide whether to write (avoids the reseed-on-every-load gotcha).

`emptyRoster()` returns `{ teams: [], snapshot: todaySnapshot() }` and is itself
valid input to `sanitizeRoster`. `todaySnapshot()` uses the real current date;
`prev`/`next`/`slackConnected` are provisional placeholders (snapshot semantics
are revisited in Phase 3 "real dates"). `App` may use `Date`; the `Date.now`
restriction applies only to workflow scripts, not app code.

## Stores

- **`LocalRosterStore`** — `load()`: `fetch(\`${BASE_URL}roster.json\`)` →
  `sanitizeRoster`. `save()`: throws `Error("demo is read-only")` (loud, since
  the demo has no persistence; nothing calls it in Phase 1). Used when
  `VITE_BACKEND=local`.
- **`SupabaseRosterStore(rowStore: RowStore)`** —
  - `load()`: `const raw = await rowStore.getRow();`
    `raw === null` → `const empty = emptyRoster(); await rowStore.putRow(empty); return empty;`
    else → `return sanitizeRoster(raw);`
  - `save(data)`: `await rowStore.putRow(data);`
  - Bootstrap writes **only** on `null` — subsequent loads of a valid row never
    rewrite.
- **`SupabaseRowStore`** — the thin network binding. A shared
  `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)` (anon/publishable
  key only). `getRow()`: `select('data').eq('owner', uid).maybeSingle()` →
  `row?.data ?? null`. `putRow(d)`: `upsert({ owner: uid, data: d, updated_at: now })`.
  `@supabase/supabase-js` is imported via dynamic `import()` so it is absent
  from the demo bundle. `uid` comes from the current session (wired in Phase 2);
  with no session, RLS blocks — expected until Phase 2.

## Factory + App wiring

- `createRosterStore(): Promise<RosterStore>` reads `import.meta.env.VITE_BACKEND`.
  `supabase` → dynamic-import the Supabase modules, build `SupabaseRosterStore`
  over a real `SupabaseRowStore`. Anything else → `LocalRosterStore`.
- `App` takes an **optional `store?: RosterStore` prop**. Tests inject a fake
  (removing the existing global-`fetch` stub in `App.test`). With no prop, `App`
  lazily calls `createRosterStore().then(s => s.load())` in an effect, with
  `loading` / `error` / `data` states. A schema failure now surfaces honestly
  because `sanitizeRoster` runs at the load boundary (not in render).
- **Empty state:** when `data.teams` is empty, render an honest message
  ("No one on the roster yet") rather than a blank/contradictory dashboard. The
  add-your-first-person CTA is Phase 3.
- `main.tsx` stays `<App />`.

## Schema + env (shipped; human runs the SQL)

`web/supabase/schema.sql`:

```sql
create table if not exists app_data (
  owner uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table app_data enable row level security;
create policy app_data_select on app_data for select using (auth.uid() = owner);
create policy app_data_insert on app_data for insert with check (auth.uid() = owner);
create policy app_data_update on app_data for update using (auth.uid() = owner) with check (auth.uid() = owner);
```

`web/.env.example`:

```
# Real build only. The demo build (VITE_BACKEND=local) needs none of these.
VITE_BACKEND=supabase
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-PUBLISHABLE-ANON-KEY   # publishable/anon key ONLY — never the service key
```

## Testing (TDD)

- `sanitize.test.ts` (node): valid blob passes + backfills; missing optional
  fields filled; out-of-union `cat` clamped without crashing counts;
  non-null unrecognized blob throws; `emptyRoster()` is valid.
- `supabaseRosterStore.test.ts` (node, `FakeRowStore`): `null` row → bootstraps
  empty + writes exactly once; valid row → sanitized, no write; garbage row →
  throws; `save()` writes through; a second `load()` of a valid row does **not**
  rewrite (no reseed loop).
- `localRosterStore.test.ts` (node): `load()` fetches + sanitizes; `save()` throws.
- `App` tests (happy-dom): injected fake store renders the dashboard; empty
  roster renders the honest empty state; a store `load()` rejection renders the
  error state.
- **Bundle check:** `VITE_BACKEND=local` build output contains no `supabase`
  string (SDK fully tree-shaken/lazy).

## Dependencies

- Add `@supabase/supabase-js`, **exact-pinned** (Phase 0 set `save-exact`), as a
  runtime dependency. Loaded only via dynamic import in the supabase path.

## Out of scope (later phases)

- Login / auth gate / shared Supabase auth client → **Phase 2**.
- CRUD (add/edit/delete, the wired "Correct my row"), stable per-person `id`,
  real-date derivations → **Phase 3**.
- Vercel deploy, self-host fonts, configurable base, "run your own" → **Phase 4**.
- Sentry / telemetry → **Phase 5**.

## Risks & verification

- **Live round-trip can't be fully verified until Phase 2** (RLS needs
  `auth.uid()`). Mitigation: the adapter is unit-tested against a `FakeRowStore`;
  the network binding stays thin; the `local` demo (and `main`/Pages) is
  unaffected.
- **Demo bundle bloat** if the SDK leaks in. Mitigation: dynamic import + the
  bundle check test.
- **Reseed-on-every-load** data-loss gotcha. Mitigation: bootstrap writes only
  on a `null` row; no `parsed !== sanitized` write trigger.
