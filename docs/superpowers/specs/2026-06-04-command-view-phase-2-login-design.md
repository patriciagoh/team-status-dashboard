# Command View — Phase 2: Login (email + password, locked-down)

**Date:** 2026-06-04
**Author:** Patricia Goh (with Claude)
**Status:** Approved for planning
**Part of:** Productionizing the Command View web app (Phases 0–5).
**Builds on:** Phase 1 (Supabase backend) — merged in #3.

## Problem

Phase 1 gave the app a per-user Supabase store behind a seam, but nothing
authenticates the user. RLS needs `auth.uid()`, so the real (`supabase`) build
cannot actually read/write until a user signs in. Phase 2 gates the real app
behind login — without adding any public registration surface — while leaving
the public demo (`local` build) login-free.

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Auth method | Email + password via `@supabase/supabase-js` on the shared Phase 1 client. |
| Registration | **No in-app signup.** The deployer adds their user in the Supabase dashboard; public signups are disabled. Password reset is via the dashboard (documented). |
| Seam | A tiny `AuthPort` (`getSession`/`signIn`/`signOut`/`onAuthChange`), testable against a fake. |
| Gate | A `Root` component **above the data gate**: no session → Login; session → App. `onAuthChange` is authoritative (drives login/logout). |
| Build flag | Only the `supabase` build has auth. `local` (demo) stays login-free and SDK-free. |
| Login screen | Styled-simple Matcha Oat card, WCAG 2.2 AA, generic error, no forgot-password UI. |
| Security posture | The gate is **UX, not the security boundary** — RLS enforces per-user data server-side. |
| Session | Persisted across reloads (Supabase default localStorage). |

## Architecture

```
web/src/auth/
├── AuthPort.ts            # AuthPort interface + Session type
├── supabaseAuthPort.ts    # makeSupabaseAuthPort(authClient) testable core + createSupabaseAuthPort() live
└── createAuthPort.ts      # factory: supabase build → AuthPort; else → null (demo, no auth)
web/src/Root.tsx           # the gate: session state from onAuthChange; renders Loading/Login/App
web/src/components/Login.tsx   # styled email+password form
web/src/main.tsx           # async bootstrap: createAuthPort() → <Root authPort={…}/>
web/src/App.tsx            # + optional onSignOut prop → Header
web/src/components/Header.tsx  # + optional "Sign out" button (shown only when onSignOut provided)
```

One job per unit: `AuthPort.ts` is the contract; `supabaseAuthPort.ts` is the
only auth↔SDK binding; `createAuthPort.ts` is the build wiring; `Root.tsx` is
the gate; `Login.tsx` is presentation; the `App`/`Header` changes are additive
and keep the demo unchanged.

## The seam

```ts
export interface Session { userId: string; email: string | null; }

export interface AuthPort {
  getSession(): Promise<Session | null>;
  signIn(email: string, password: string): Promise<void>; // throws on bad credentials
  signOut(): Promise<void>;
  onAuthChange(cb: (session: Session | null) => void): () => void; // returns unsubscribe
}
```

### Supabase implementation

`makeSupabaseAuthPort(authClient)` maps a minimal auth-client interface to the
`AuthPort` (so the mapping is unit-testable against a fake):

- `getSession()` → `authClient.getSession()` → `{ userId, email }` or `null`.
- `signIn(email, password)` → `authClient.signInWithPassword({ email, password })`;
  throw on `error`.
- `signOut()` → `authClient.signOut()`.
- `onAuthChange(cb)` → `authClient.onAuthStateChange((_event, session) => cb(map(session)))`;
  return a function that calls `subscription.unsubscribe()`.

`createSupabaseAuthPort()` supplies the real auth client from the **shared**
`getSupabaseClient()` (Phase 1), so data and auth use one client and one
session. No `signUp` is ever called.

### Factory

```ts
export async function createAuthPort(): Promise<AuthPort | null> {
  if (import.meta.env.VITE_BACKEND === "supabase") {
    const { createSupabaseAuthPort } = await import("./supabaseAuthPort");
    return createSupabaseAuthPort();
  }
  return null; // demo: no auth, SDK stays out of the bundle
}
```

## The gate (`Root.tsx`)

`Root` takes an optional `authPort: AuthPort | null` (injectable for tests).

- `authPort === null` → render `<App />` directly (demo: no gate).
- Otherwise hold `session: Session | null | undefined` (`undefined` = still
  loading). On mount: `getSession()` seeds it, and `onAuthChange` subscribes as
  the **authoritative** source. Cleanup unsubscribes.
  - `undefined` → a minimal loading state.
  - `null` → `<Login authPort={authPort} />`.
  - `Session` → `<App onSignOut={() => authPort.signOut()} />`.

Because `onAuthChange` drives `session`, a successful `signIn` and a `signOut`
both update the gate automatically — Login never flips state itself, and logout
returns to Login. Each login remounts `App`, which (via Phase 1's factory) loads
the now-authenticated user's data.

## Login screen (`Login.tsx`)

A styled Matcha-Oat card: `Sign in` heading, labelled email + password inputs, a
submit button, and an inline error region (`role="alert"`).

- Submit: `setBusy(true)`; `await authPort.signIn(email, password)`; on throw,
  show a **generic** message ("Sign-in failed. Check your email and password.")
  — never reveal whether the email exists; `finally` clears busy.
- On success, nothing local changes — `onAuthChange` flips the gate and unmounts
  Login.
- AA: `<label>` for each field, visible focus rings (`var(--focus)`), button has
  an accessible name and a busy/disabled state, error has `role="alert"`.
- **No** signup link, **no** forgot-password UI. Styling uses existing Matcha Oat
  tokens only (passes the design-token guardrail; no new raw values).

## Sign-out

`App` gains an optional `onSignOut?: () => void` passed to `Header`. `Header`
renders a "Sign out" button **only when `onSignOut` is provided** — so the demo
Header is byte-for-byte unchanged. Clicking it calls `onSignOut`, which triggers
`signOut()` → `onAuthChange(null)` → `Root` shows Login.

## Bootstrap (`main.tsx`)

```tsx
createAuthPort().then((authPort) => {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode><Root authPort={authPort} /></React.StrictMode>,
  );
});
```

## Testing (TDD, against fakes)

- `makeSupabaseAuthPort` (node, fake auth client): `getSession` maps/returns
  null; `signIn` throws on error; `signOut` called; `onAuthChange` maps sessions
  and the returned unsubscribe calls `subscription.unsubscribe()`.
- `Root` (jsdom, fake `AuthPort`): `null` authPort → renders App (demo, no
  login); no session → renders Login; firing `onAuthChange(session)` → renders
  App; firing `onAuthChange(null)` → renders Login.
- `Login` (jsdom, fake `AuthPort`): renders labelled fields + button; submitting
  calls `signIn` with entered values; a rejected `signIn` shows the generic alert
  and does not crash.
- `Header` (jsdom): shows "Sign out" and calls `onSignOut` when provided; renders
  no sign-out control when the prop is absent.
- **Bundle check:** the `VITE_BACKEND=local` build still contains no `supabase`
  string (auth modules are dynamic-imported only on the supabase path).

## Human setup (deployer; I provide exact steps at live-test time)

1. Create a Supabase project.
2. SQL editor → run `web/supabase/schema.sql` (from Phase 1).
3. Authentication → Providers/Settings: **disable public signups**; Email
   provider enabled. No SMTP needed.
4. Authentication → Users → **Add user** (email + password, auto-confirm).
5. Settings → API → copy Project URL + **anon/publishable key** into
   `web/.env.local` (`VITE_BACKEND=supabase`, `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`). Never the service key.
6. `npm run build`/`npm run dev` with that env → live login round-trip.

## Out of scope (later phases)

- CRUD / wired "Correct my row", stable per-person ids, real-date derivations →
  **Phase 3**.
- Vercel deploy, self-host fonts, configurable base, "run your own" → **Phase 4**.
- Sentry / telemetry → **Phase 5**.

## Risks & verification

- **Live round-trip needs the human setup** above; until then the auth flow is
  verified against a fake `AuthPort`. The `local` demo is unaffected and `main`
  stays green.
- **SDK must stay out of the demo bundle** after adding auth — guaranteed by
  dynamic import + the bundle check (auth modules must never be statically
  imported by `Root`/`main`).
- **No registration surface** — verified by the absence of any `signUp` call and
  the disabled-signups dashboard setting.
