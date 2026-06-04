# Command View Phase 2 — Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the real (`supabase`) build behind email+password login with no public signup, while the demo (`local`) build stays login-free.

**Architecture:** A tiny `AuthPort` seam (`getSession`/`signIn`/`signOut`/`onAuthChange`) wraps `supabase.auth` on the shared Phase 1 client. A `Root` component above the data gate holds session state driven authoritatively by `onAuthChange` and renders Loading → Login → App. A `createAuthPort()` factory returns `null` in the demo build (no auth, SDK stays out of the bundle). Sign-out lives in `Header` behind an optional prop so the demo Header is unchanged.

**Tech Stack:** React 19, TypeScript, Vite, Vitest (jsdom, globals), `@testing-library/react` + `user-event`, `@supabase/supabase-js` (dynamic import).

**Working directory for all commands:** `web/` (run `cd web` first).

**Spec:** `docs/superpowers/specs/2026-06-04-command-view-phase-2-login-design.md`

---

### Task 1: `AuthPort` seam interface

Types only — consumed by every later task. Verified via typecheck.

**Files:**
- Create: `web/src/auth/AuthPort.ts`

- [ ] **Step 1: Create the interface**

```ts
// web/src/auth/AuthPort.ts
export interface Session {
  userId: string;
  email: string | null;
}

export interface AuthPort {
  getSession(): Promise<Session | null>;
  signIn(email: string, password: string): Promise<void>; // throws on bad credentials
  signOut(): Promise<void>;
  onAuthChange(cb: (session: Session | null) => void): () => void; // returns unsubscribe
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS (exit 0).

- [ ] **Step 3: Commit**

```bash
git add web/src/auth/AuthPort.ts
git commit -m "feat(web): add AuthPort seam interface"
```

---

### Task 2: Supabase auth port (`supabaseAuthPort.ts`)

Testable core `makeSupabaseAuthPort(authClient)` + live `createSupabaseAuthPort()` over the shared Phase 1 client.

**Files:**
- Create: `web/src/auth/supabaseAuthPort.ts`
- Test: `web/src/auth/supabaseAuthPort.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// web/src/auth/supabaseAuthPort.test.ts
import { describe, it, expect, vi } from "vitest";
import { makeSupabaseAuthPort, type SupabaseAuthLike, type SupaSession } from "./supabaseAuthPort";

function fakeAuth(over: Partial<SupabaseAuthLike> = {}): SupabaseAuthLike {
  return {
    getSession: async () => ({ data: { session: null } }),
    signInWithPassword: async () => ({ error: null }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    ...over,
  };
}

describe("makeSupabaseAuthPort", () => {
  it("maps a supabase session to {userId,email}", async () => {
    const auth = fakeAuth({ getSession: async () => ({ data: { session: { user: { id: "u1", email: "a@b.c" } } } }) });
    expect(await makeSupabaseAuthPort(auth).getSession()).toEqual({ userId: "u1", email: "a@b.c" });
  });

  it("returns null when there is no session", async () => {
    expect(await makeSupabaseAuthPort(fakeAuth()).getSession()).toBeNull();
  });

  it("signIn passes credentials through", async () => {
    const signInWithPassword = vi.fn(async () => ({ error: null }));
    await makeSupabaseAuthPort(fakeAuth({ signInWithPassword })).signIn("e@x.com", "pw");
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "e@x.com", password: "pw" });
  });

  it("signIn throws on error", async () => {
    const auth = fakeAuth({ signInWithPassword: async () => ({ error: { message: "bad" } }) });
    await expect(makeSupabaseAuthPort(auth).signIn("e", "p")).rejects.toThrow("bad");
  });

  it("onAuthChange maps sessions and unsubscribe calls the subscription", () => {
    const unsubscribe = vi.fn();
    let handler: ((e: string, s: SupaSession | null) => void) | null = null;
    const auth = fakeAuth({
      onAuthStateChange: (cb) => { handler = cb; return { data: { subscription: { unsubscribe } } }; },
    });
    const seen: Array<unknown> = [];
    const off = makeSupabaseAuthPort(auth).onAuthChange((s) => seen.push(s));
    handler!("SIGNED_IN", { user: { id: "u2", email: null } });
    expect(seen).toEqual([{ userId: "u2", email: null }]);
    off();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/auth/supabaseAuthPort.test.ts`
Expected: FAIL — cannot find module `./supabaseAuthPort`.

- [ ] **Step 3: Implement `supabaseAuthPort.ts`**

```ts
// web/src/auth/supabaseAuthPort.ts
import type { AuthPort, Session } from "./AuthPort";
import { getSupabaseClient } from "../storage/supabaseClient";

export type SupaSession = { user: { id: string; email?: string | null } };

/** Minimal slice of supabase.auth used here — so the mapping is testable against a fake. */
export interface SupabaseAuthLike {
  getSession(): Promise<{ data: { session: SupaSession | null } }>;
  signInWithPassword(c: { email: string; password: string }): Promise<{ error: { message: string } | null }>;
  signOut(): Promise<{ error: { message: string } | null }>;
  onAuthStateChange(
    cb: (event: string, session: SupaSession | null) => void,
  ): { data: { subscription: { unsubscribe(): void } } };
}

function mapSession(s: SupaSession | null): Session | null {
  return s ? { userId: s.user.id, email: s.user.email ?? null } : null;
}

export function makeSupabaseAuthPort(auth: SupabaseAuthLike): AuthPort {
  return {
    async getSession() {
      const { data } = await auth.getSession();
      return mapSession(data.session);
    },
    async signIn(email, password) {
      const { error } = await auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    },
    async signOut() {
      const { error } = await auth.signOut();
      if (error) throw new Error(error.message);
    },
    onAuthChange(cb) {
      const { data } = auth.onAuthStateChange((_event, session) => cb(mapSession(session)));
      return () => data.subscription.unsubscribe();
    },
  };
}

/** Live binding over the shared Phase 1 client (one client for data + auth). */
export async function createSupabaseAuthPort(): Promise<AuthPort> {
  const supabase = await getSupabaseClient();
  const auth = supabase.auth;
  const adapter: SupabaseAuthLike = {
    getSession: () => auth.getSession().then((r) => ({ data: { session: r.data.session as SupaSession | null } })),
    signInWithPassword: (c) => auth.signInWithPassword(c).then((r) => ({ error: r.error })),
    signOut: () => auth.signOut().then((r) => ({ error: r.error })),
    onAuthStateChange: (cb) => auth.onAuthStateChange((event, session) => cb(event, session as SupaSession | null)),
  };
  return makeSupabaseAuthPort(adapter);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/auth/supabaseAuthPort.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Verify the project typechecks** (the `createSupabaseAuthPort` adapter must match the SDK types)

Run: `npm run typecheck`
Expected: PASS. If the SDK's `error`/`session` types don't structurally satisfy the adapter, report it (DONE_WITH_CONCERNS) rather than widening with `any`.

- [ ] **Step 6: Commit**

```bash
git add web/src/auth/supabaseAuthPort.ts web/src/auth/supabaseAuthPort.test.ts
git commit -m "feat(web): add Supabase AuthPort (testable core + shared-client binding)"
```

---

### Task 3: Auth port factory (`createAuthPort.ts`)

Returns the real port in the `supabase` build (dynamic import) and `null` otherwise.

**Files:**
- Create: `web/src/auth/createAuthPort.ts`
- Test: `web/src/auth/createAuthPort.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/src/auth/createAuthPort.test.ts
import { describe, it, expect } from "vitest";
import { createAuthPort } from "./createAuthPort";

describe("createAuthPort", () => {
  it("returns null in the demo (non-supabase) build", async () => {
    // VITE_BACKEND is unset in tests → demo path
    expect(await createAuthPort()).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/auth/createAuthPort.test.ts`
Expected: FAIL — cannot find module `./createAuthPort`.

- [ ] **Step 3: Implement `createAuthPort.ts`**

```ts
// web/src/auth/createAuthPort.ts
import type { AuthPort } from "./AuthPort";

export async function createAuthPort(): Promise<AuthPort | null> {
  if (import.meta.env.VITE_BACKEND === "supabase") {
    const { createSupabaseAuthPort } = await import("./supabaseAuthPort");
    return createSupabaseAuthPort();
  }
  return null; // demo: no auth, SDK stays out of the bundle
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/auth/createAuthPort.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add web/src/auth/createAuthPort.ts web/src/auth/createAuthPort.test.ts
git commit -m "feat(web): add createAuthPort factory (null in demo build)"
```

---

### Task 4: Login screen (`Login.tsx`)

Styled Matcha-Oat card, AA, generic error, no signup.

**Files:**
- Create: `web/src/components/Login.tsx`
- Test: `web/src/components/Login.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// web/src/components/Login.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Login } from "./Login";
import type { AuthPort } from "../auth/AuthPort";

function authPort(over: Partial<AuthPort> = {}): AuthPort {
  return {
    getSession: async () => null,
    signIn: vi.fn(async () => {}),
    signOut: async () => {},
    onAuthChange: () => () => {},
    ...over,
  };
}

describe("Login", () => {
  it("renders labelled email and password fields and a sign-in button", () => {
    render(<Login authPort={authPort()} />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("calls signIn with the entered credentials on submit", async () => {
    const signIn = vi.fn(async () => {});
    render(<Login authPort={authPort({ signIn })} />);
    await userEvent.type(screen.getByLabelText("Email"), "me@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "pw");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(signIn).toHaveBeenCalledWith("me@example.com", "pw");
  });

  it("shows a generic error alert on failure without leaking server detail", async () => {
    const signIn = vi.fn(async () => { throw new Error("Invalid login credentials"); });
    render(<Login authPort={authPort({ signIn })} />);
    await userEvent.type(screen.getByLabelText("Email"), "me@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Sign-in failed/i);
    expect(alert).not.toHaveTextContent(/Invalid login credentials/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/Login.test.tsx`
Expected: FAIL — cannot find module `./Login`.

- [ ] **Step 3: Implement `Login.tsx`**

```tsx
// web/src/components/Login.tsx
import { useState, type FormEvent } from "react";
import type { AuthPort } from "../auth/AuthPort";

const fieldClass =
  "font-mono text-[13px] text-ink px-[12px] py-[9px] rounded-[8px] border border-line-2 bg-transparent";

export function Login({ authPort }: { authPort: AuthPort }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authPort.signIn(email, password);
    } catch {
      setError("Sign-in failed. Check your email and password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-[24px]">
      <form
        onSubmit={onSubmit}
        aria-labelledby="login-title"
        className="w-full max-w-[360px] flex flex-col gap-[18px] p-[32px] rounded-[14px] border border-line-2"
      >
        <h1 id="login-title" className="font-serif font-normal text-[24px] leading-none tracking-[-0.02em] text-ink m-0">
          Sign in
        </h1>
        <label className="flex flex-col gap-[6px] font-mono text-[12px] text-ink-2">
          Email
          <input
            type="email" name="email" autoComplete="username" required
            value={email} onChange={(e) => setEmail(e.target.value)}
            className={fieldClass} style={{ outlineColor: "var(--focus)" }}
          />
        </label>
        <label className="flex flex-col gap-[6px] font-mono text-[12px] text-ink-2">
          Password
          <input
            type="password" name="password" autoComplete="current-password" required
            value={password} onChange={(e) => setPassword(e.target.value)}
            className={fieldClass} style={{ outlineColor: "var(--focus)" }}
          />
        </label>
        {error && (
          <p role="alert" className="font-mono text-[12px] m-0" style={{ color: "var(--rust-deep)" }}>
            {error}
          </p>
        )}
        <button
          type="submit" disabled={busy}
          className="font-sans font-semibold text-[13px] px-[16px] py-[10px] rounded-[8px] border-0 cursor-pointer disabled:opacity-60"
          style={{ background: "var(--matcha)", color: "var(--paper)" }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/Login.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the design-token guardrail** (Login must use tokens, no raw values)

Run: `npm run guardrail`
Expected: `OK — no raw design values`. If it flags `Login.tsx`, replace any raw color with the appropriate `var(--token)` (the file already uses `var(--focus)`/`var(--matcha)`/`var(--paper)`/`var(--rust-deep)` and semantic utilities `text-ink`/`text-ink-2`/`border-line-2`).

- [ ] **Step 6: Commit**

```bash
git add web/src/components/Login.tsx web/src/components/Login.test.tsx
git commit -m "feat(web): add styled Login screen (email+password, AA, generic error)"
```

---

### Task 5: Sign-out control in `Header`

`Header` gains an optional `onSignOut` and renders a "Sign out" button only when it's provided — demo Header unchanged.

**Files:**
- Modify: `web/src/components/Header.tsx`
- Test: `web/src/components/header.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// web/src/components/header.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Header } from "./Header";
import type { Snapshot } from "../types";

const snapshot: Snapshot = {
  day: "Tuesday, June 3, 2026", time: "9:02 AM ET", prev: "x", next: "2:00 PM ET", slackConnected: true,
};

describe("Header sign-out", () => {
  it("shows a Sign out button and calls onSignOut when provided", async () => {
    const onSignOut = vi.fn();
    render(<Header snapshot={snapshot} total={3} onSignOut={onSignOut} />);
    await userEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it("renders no sign-out control when onSignOut is absent", () => {
    render(<Header snapshot={snapshot} total={3} />);
    expect(screen.queryByRole("button", { name: /sign out/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/header.test.tsx`
Expected: FAIL — `Header` has no sign-out button.

- [ ] **Step 3: Modify `Header.tsx`**

Change the signature line:

```tsx
export function Header({ snapshot, total, onSignOut }: { snapshot: Snapshot; total: number; onSignOut?: () => void }) {
```

Then, inside the right-side `<div className="flex items-center gap-[14px] flex-wrap">`, add the button as the last child (immediately before that `</div>` closes):

```tsx
        {onSignOut && (
          <button
            type="button" onClick={onSignOut}
            className="font-mono text-[12px] leading-none text-muted hover:text-ink-2 underline underline-offset-2 border-0 bg-transparent cursor-pointer p-0"
            style={{ outlineColor: "var(--focus)" }}
          >
            Sign out
          </button>
        )}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/header.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the guardrail**

Run: `npm run guardrail`
Expected: `OK — no raw design values`.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/Header.tsx web/src/components/header.test.tsx
git commit -m "feat(web): optional Sign out button in Header (demo unchanged)"
```

---

### Task 6: Thread `onSignOut` through `App`

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/App.test.tsx` (add one test)

- [ ] **Step 1: Add the failing test to `App.test.tsx`**

Add this test inside the existing `describe("App", ...)` block:

```tsx
  it("renders a Sign out button when onSignOut is provided", async () => {
    render(<App store={storeOf(roster as RosterData)} onSignOut={() => {}} />);
    await waitFor(() => expect(screen.getByText("Team status")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — `App` doesn't accept `onSignOut` / no sign-out button.

- [ ] **Step 3: Modify `App.tsx`**

Change the signature:

```tsx
export default function App({ store, onSignOut }: { store?: RosterStore; onSignOut?: () => void }) {
```

And pass it to the existing single `Header` render:

```tsx
      <Header snapshot={data.snapshot} total={d.total} onSignOut={onSignOut} />
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/App.tsx web/src/App.test.tsx
git commit -m "feat(web): thread onSignOut through App to Header"
```

---

### Task 7: The gate (`Root.tsx`)

`Root` decides demo-passthrough vs gated; the inner `AuthGate` holds session state from `onAuthChange`.

**Files:**
- Create: `web/src/Root.tsx`
- Test: `web/src/Root.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// web/src/Root.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Root } from "./Root";
import type { AuthPort, Session } from "./auth/AuthPort";
import roster from "../public/roster.json";

// App (rendered when authed or in demo) loads via the default store → fetch the fixture.
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(roster) } as Response)));
});
afterEach(() => vi.unstubAllGlobals());

function fakeAuthPort(initial: Session | null) {
  let listeners: Array<(s: Session | null) => void> = [];
  const port: AuthPort = {
    getSession: async () => initial,
    signIn: async () => {},
    signOut: async () => {},
    onAuthChange: (cb) => { listeners.push(cb); return () => { listeners = listeners.filter((l) => l !== cb); }; },
  };
  return { port, emit: (s: Session | null) => listeners.forEach((l) => l(s)) };
}

describe("Root", () => {
  it("renders the app directly (no login) when authPort is null (demo)", async () => {
    render(<Root authPort={null} />);
    await waitFor(() => expect(screen.getByText("Team status")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /sign in/i })).toBeNull();
  });

  it("shows Login when there is no session", async () => {
    const { port } = fakeAuthPort(null);
    render(<Root authPort={port} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument());
    expect(screen.queryByText("Team status")).toBeNull();
  });

  it("shows the app when a session exists", async () => {
    const { port } = fakeAuthPort({ userId: "u1", email: "a@b.c" });
    render(<Root authPort={port} />);
    await waitFor(() => expect(screen.getByText("Team status")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("reacts to onAuthChange: login then logout", async () => {
    const { port, emit } = fakeAuthPort(null);
    render(<Root authPort={port} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument());
    emit({ userId: "u1", email: "a@b.c" });
    await waitFor(() => expect(screen.getByText("Team status")).toBeInTheDocument());
    emit(null);
    await waitFor(() => expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/Root.test.tsx`
Expected: FAIL — cannot find module `./Root`.

- [ ] **Step 3: Implement `Root.tsx`**

```tsx
// web/src/Root.tsx
import { useEffect, useState } from "react";
import type { AuthPort, Session } from "./auth/AuthPort";
import App from "./App";
import { Login } from "./components/Login";

export function Root({ authPort }: { authPort: AuthPort | null }) {
  if (!authPort) return <App />; // demo: no gate
  return <AuthGate authPort={authPort} />;
}

function AuthGate({ authPort }: { authPort: AuthPort }) {
  // undefined = still resolving the initial session
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    authPort.getSession().then((s) => { if (active) setSession(s); });
    const unsub = authPort.onAuthChange((s) => setSession(s)); // authoritative
    return () => { active = false; unsub(); };
  }, [authPort]);

  if (session === undefined) {
    return <div className="p-[38px_48px_44px] font-mono text-[12px] text-muted">Loading…</div>;
  }
  if (session === null) {
    return <Login authPort={authPort} />;
  }
  return <App onSignOut={() => { void authPort.signOut(); }} />;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/Root.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/Root.tsx web/src/Root.test.tsx
git commit -m "feat(web): add Root auth gate (onAuthChange-driven; demo passthrough)"
```

---

### Task 8: Bootstrap `main.tsx` through the gate

**Files:**
- Modify: `web/src/main.tsx`

- [ ] **Step 1: Rewrite `main.tsx`**

```tsx
// web/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import "matcha-oat-design-system/tokens.css";
import "matcha-oat-design-system/fonts.css";
import "./tokens.categories.css";
import "./index.css";
import { Root } from "./Root";
import { createAuthPort } from "./auth/createAuthPort";

createAuthPort().then((authPort) => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <Root authPort={authPort} />
    </React.StrictMode>,
  );
});
```

- [ ] **Step 2: Verify typecheck + build**

Run: `npm run typecheck && VITE_BACKEND=local npm run build`
Expected: both PASS.

- [ ] **Step 3: Commit**

```bash
git add web/src/main.tsx
git commit -m "feat(web): bootstrap app through the Root auth gate"
```

---

### Task 9: Verify green gate + demo bundle still ships no Supabase SDK

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: PASS — all suites green (prior 50 + the new auth/Root/Login/Header/App tests).

- [ ] **Step 2: Typecheck, lint, guardrail**

Run: `npm run typecheck && npm run lint && npm run guardrail`
Expected: all PASS (`OK — no raw design values`).

- [ ] **Step 3: Demo build excludes the SDK (auth added — re-verify)**

Run: `VITE_BACKEND=local npm run build && ! grep -riq "supabase" dist/assets`
Expected: build succeeds and `grep` finds nothing (exit 0). If it finds `supabase`, something statically imports the auth/client modules — fix the static import so `supabaseAuthPort`/`supabaseClient` are only reached via dynamic import.

- [ ] **Step 4: Supabase variant compiles**

Run: `VITE_BACKEND=supabase VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=test npm run build`
Expected: build succeeds (auth + SDK emitted in lazy chunks).

- [ ] **Step 5: Restore demo build and confirm a clean tree**

```bash
VITE_BACKEND=local npm run build >/dev/null 2>&1
git status   # expect clean working tree; dist/ is gitignored
```

---

## Self-Review

**Spec coverage:**
- `AuthPort` seam → Task 1. ✔
- Supabase impl over shared client + no `signUp` → Task 2 (`createSupabaseAuthPort` uses `getSupabaseClient`; only `signInWithPassword`/`getSession`/`signOut`/`onAuthStateChange` referenced). ✔
- `createAuthPort` factory (null in demo, dynamic import) → Task 3. ✔
- Login screen (AA, generic error, no signup/forgot) → Task 4. ✔
- Sign-out in Header behind optional prop → Task 5. ✔
- `App` threads `onSignOut` → Task 6. ✔
- `Root` gate above data gate, `onAuthChange` authoritative, demo passthrough → Task 7. ✔
- `main.tsx` async bootstrap → Task 8. ✔
- Demo bundle still SDK-free + green gate → Task 9. ✔
- Security posture (gate is UX; RLS is the boundary) → no code beyond the gate; documented in spec. ✔

**Placeholder scan:** No TBD/TODO; every code step shows full code; commands have expected output.

**Type consistency:** `AuthPort` (`getSession`/`signIn`/`signOut`/`onAuthChange`), `Session` (`userId`/`email`), `SupabaseAuthLike`/`SupaSession`, `makeSupabaseAuthPort(auth)`, `createSupabaseAuthPort()`, `createAuthPort()`, `Login({authPort})`, `Header({...,onSignOut?})`, `App({store?,onSignOut?})`, `Root({authPort})` are used identically across tasks and match the spec. The Root test's `storeOf`/`waitFor`/`roster` imports rely on Task 6 leaving the existing `App.test.tsx` helpers in place (only adding a test); Root.test defines its own fixtures and stubs `fetch` for App-rendering branches.
