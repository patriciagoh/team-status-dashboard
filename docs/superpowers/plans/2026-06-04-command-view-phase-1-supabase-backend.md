# Command View Phase 1 — Supabase Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Command View app cloud storage that is per-user and private, behind an injectable seam, without disturbing the public demo.

**Architecture:** Introduce an app-facing `RosterStore` seam (`load`/`save`) with two implementations — a local fixture store (the demo) and a Supabase store. The Supabase store wraps a thin `RowStore` network binding so its bootstrap/sanitize logic is unit-tested against a fake. A single `sanitizeRoster` load boundary turns untrusted JSON into typed `RosterData`. A `VITE_BACKEND` flag picks the store at runtime and the Supabase SDK is dynamic-imported so the demo bundle ships none of it.

**Tech Stack:** React 19, TypeScript, Vite, Vitest (jsdom, globals), `@supabase/supabase-js` (dynamic import), Supabase Postgres + RLS.

**Working directory for all commands:** `web/` (run `cd web` first).

**Spec:** `docs/superpowers/specs/2026-06-04-command-view-phase-1-supabase-backend-design.md`

---

### Task 1: Load-boundary sanitizer (`sanitize.ts`)

The one place untrusted/old JSON becomes typed `RosterData`. Pure, node-testable.

**Files:**
- Create: `web/src/storage/sanitize.ts`
- Test: `web/src/storage/sanitize.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// web/src/storage/sanitize.test.ts
import { describe, it, expect } from "vitest";
import { sanitizeRoster, emptyRoster } from "./sanitize";

describe("sanitizeRoster", () => {
  it("accepts a valid roster and preserves people", () => {
    const r = sanitizeRoster({
      teams: [{ name: "T", lead: "L", people: [
        { name: "A", initials: "A", role: "Eng", team: "T", cat: "planned", conf: "high",
          what: "x", ticket: "T-1", since: null, detail: { tickets: ["T-1"], note: "n" } },
      ] }],
      snapshot: { day: "d", time: "t", prev: "p", next: "n", slackConnected: true },
    });
    expect(r.teams[0].people[0].name).toBe("A");
    expect(r.teams[0].people[0].cat).toBe("planned");
    expect(r.snapshot.slackConnected).toBe(true);
  });

  it("backfills missing optional person fields", () => {
    const r = sanitizeRoster({
      teams: [{ name: "T", lead: "L", people: [{ name: "A", cat: "planned" }] }],
      snapshot: { day: "d", time: "t" },
    });
    const p = r.teams[0].people[0];
    expect(p.since).toBeNull();
    expect(p.conf).toBe("high");
    expect(p.detail).toEqual({ tickets: [], note: "" });
    expect(p.ticket).toBeNull();
  });

  it("clamps an out-of-union category to a safe default", () => {
    const r = sanitizeRoster({
      teams: [{ name: "T", lead: "L", people: [{ name: "A", cat: "bogus" }] }],
      snapshot: {},
    });
    expect(["planned","adhoc","lent","support","unplanned","incident"]).toContain(r.teams[0].people[0].cat);
  });

  it("accepts an empty roster", () => {
    const r = sanitizeRoster({ teams: [], snapshot: {} });
    expect(r.teams).toEqual([]);
  });

  it("throws on a non-null unrecognized blob", () => {
    expect(() => sanitizeRoster({ nope: 1 })).toThrow();
    expect(() => sanitizeRoster("garbage")).toThrow();
    expect(() => sanitizeRoster(42)).toThrow();
  });

  it("emptyRoster() is itself valid input", () => {
    expect(() => sanitizeRoster(emptyRoster())).not.toThrow();
    expect(emptyRoster().teams).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/storage/sanitize.test.ts`
Expected: FAIL — cannot find module `./sanitize`.

- [ ] **Step 3: Implement `sanitize.ts`**

```ts
// web/src/storage/sanitize.ts
import type { Category, Person, RosterData, Snapshot, Team } from "../types";

const CATEGORIES: Category[] = ["planned", "adhoc", "lent", "support", "unplanned", "incident"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function category(v: unknown): Category {
  return CATEGORIES.includes(v as Category) ? (v as Category) : "adhoc";
}

export function todaySnapshot(): Snapshot {
  const now = new Date();
  return {
    day: now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
    time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    prev: "—",
    next: "—",
    slackConnected: false,
  };
}

export function emptyRoster(): RosterData {
  return { teams: [], snapshot: todaySnapshot() };
}

function sanitizePerson(raw: unknown, teamName: string): Person {
  const r = isRecord(raw) ? raw : {};
  const detail = isRecord(r.detail) ? r.detail : {};
  return {
    name: str(r.name),
    initials: str(r.initials),
    role: str(r.role),
    team: str(r.team, teamName),
    cat: category(r.cat),
    conf: r.conf === "low" ? "low" : "high",
    what: str(r.what),
    ticket: typeof r.ticket === "string" ? r.ticket : null,
    since: typeof r.since === "string" ? r.since : null,
    detail: {
      tickets: Array.isArray(detail.tickets) ? detail.tickets.filter((t): t is string => typeof t === "string") : [],
      note: str(detail.note),
    },
  };
}

export function sanitizeRoster(raw: unknown): RosterData {
  if (!isRecord(raw) || !Array.isArray(raw.teams) || !isRecord(raw.snapshot)) {
    throw new Error("Unrecognized roster data");
  }
  const s = raw.snapshot;
  const snapshot: Snapshot = {
    day: str(s.day),
    time: str(s.time),
    prev: str(s.prev, "—"),
    next: str(s.next, "—"),
    slackConnected: s.slackConnected === true,
  };
  const teams: Team[] = raw.teams.map((t) => {
    const tr = isRecord(t) ? t : {};
    const name = str(tr.name);
    const people = Array.isArray(tr.people) ? tr.people.map((p) => sanitizePerson(p, name)) : [];
    return { name, lead: str(tr.lead), people };
  });
  return { teams, snapshot };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/storage/sanitize.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/storage/sanitize.ts web/src/storage/sanitize.test.ts
git commit -m "feat(web): add sanitizeRoster load boundary + emptyRoster bootstrap"
```

---

### Task 2: Storage seam interfaces (`RosterStore.ts`)

Types only — consumed by every later task. Verified via typecheck.

**Files:**
- Create: `web/src/storage/RosterStore.ts`

- [ ] **Step 1: Create the interfaces**

```ts
// web/src/storage/RosterStore.ts
import type { RosterData } from "../types";

/** App-facing persistence seam: load/save the whole roster document. */
export interface RosterStore {
  load(): Promise<RosterData>;
  save(data: RosterData): Promise<void>;
}

/** Adapter-internal sub-seam: raw row I/O. `getRow` returns null when no row exists yet. */
export interface RowStore {
  getRow(): Promise<unknown | null>;
  putRow(data: RosterData): Promise<void>;
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npm run typecheck`
Expected: PASS (no output / exit 0).

- [ ] **Step 3: Commit**

```bash
git add web/src/storage/RosterStore.ts
git commit -m "feat(web): add RosterStore + RowStore seam interfaces"
```

---

### Task 3: Supabase roster store (`supabaseRosterStore.ts`)

Bootstrap-on-null + sanitize logic, unit-tested against a `FakeRowStore` (no network).

**Files:**
- Create: `web/src/storage/supabaseRosterStore.ts`
- Test: `web/src/storage/supabaseRosterStore.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// web/src/storage/supabaseRosterStore.test.ts
import { describe, it, expect } from "vitest";
import { makeSupabaseRosterStore } from "./supabaseRosterStore";
import type { RowStore } from "./RosterStore";
import type { RosterData } from "../types";

class FakeRowStore implements RowStore {
  row: unknown | null;
  puts = 0;
  constructor(initial: unknown | null = null) { this.row = initial; }
  async getRow() { return this.row; }
  async putRow(d: RosterData) { this.row = d; this.puts++; }
}

const validRow = {
  teams: [{ name: "T", lead: "L", people: [
    { name: "A", initials: "A", role: "Eng", team: "T", cat: "planned", conf: "high",
      what: "x", ticket: null, since: null, detail: { tickets: [], note: "" } },
  ] }],
  snapshot: { day: "d", time: "t", prev: "p", next: "n", slackConnected: false },
};

describe("makeSupabaseRosterStore", () => {
  it("bootstraps an empty roster and writes it once when the row is null", async () => {
    const fake = new FakeRowStore(null);
    const store = makeSupabaseRosterStore(fake);
    const data = await store.load();
    expect(data.teams).toEqual([]);
    expect(fake.puts).toBe(1);
  });

  it("does not rewrite on a subsequent load (no reseed loop)", async () => {
    const fake = new FakeRowStore(null);
    const store = makeSupabaseRosterStore(fake);
    await store.load();
    await store.load();
    expect(fake.puts).toBe(1);
  });

  it("returns the sanitized existing row without writing", async () => {
    const fake = new FakeRowStore(validRow);
    const store = makeSupabaseRosterStore(fake);
    const data = await store.load();
    expect(data.teams[0].people[0].name).toBe("A");
    expect(fake.puts).toBe(0);
  });

  it("throws on an unrecognized stored blob (never overwrites)", async () => {
    const fake = new FakeRowStore({ nope: 1 });
    const store = makeSupabaseRosterStore(fake);
    await expect(store.load()).rejects.toThrow();
    expect(fake.puts).toBe(0);
  });

  it("save writes through to the row store", async () => {
    const fake = new FakeRowStore(validRow);
    const store = makeSupabaseRosterStore(fake);
    await store.save(validRow as RosterData);
    expect(fake.puts).toBe(1);
    expect(fake.row).toEqual(validRow);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/storage/supabaseRosterStore.test.ts`
Expected: FAIL — cannot find module `./supabaseRosterStore`.

- [ ] **Step 3: Implement `supabaseRosterStore.ts`**

```ts
// web/src/storage/supabaseRosterStore.ts
import type { RosterStore, RowStore } from "./RosterStore";
import { emptyRoster, sanitizeRoster } from "./sanitize";

export function makeSupabaseRosterStore(rowStore: RowStore): RosterStore {
  return {
    async load() {
      const raw = await rowStore.getRow();
      if (raw === null) {
        const empty = emptyRoster();
        await rowStore.putRow(empty);
        return empty;
      }
      return sanitizeRoster(raw);
    },
    async save(data) {
      await rowStore.putRow(data);
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/storage/supabaseRosterStore.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/storage/supabaseRosterStore.ts web/src/storage/supabaseRosterStore.test.ts
git commit -m "feat(web): add SupabaseRosterStore (bootstrap-on-null + sanitize, no reseed loop)"
```

---

### Task 4: Local fixture store (`localRosterStore.ts`)

Today's demo behavior behind the seam: fetch `roster.json`, sanitize; `save` throws.

**Files:**
- Create: `web/src/storage/localRosterStore.ts`
- Test: `web/src/storage/localRosterStore.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// web/src/storage/localRosterStore.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { makeLocalRosterStore } from "./localRosterStore";
import roster from "../../public/roster.json";

afterEach(() => vi.unstubAllGlobals());

describe("makeLocalRosterStore", () => {
  it("fetches and sanitizes the fixture", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(roster) } as Response)));
    const data = await makeLocalRosterStore().load();
    expect(data.teams.length).toBeGreaterThan(0);
  });

  it("throws when the fetch is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 503 } as Response)));
    await expect(makeLocalRosterStore().load()).rejects.toThrow(/503/);
  });

  it("save throws because the demo is read-only", async () => {
    await expect(makeLocalRosterStore().save(roster as never)).rejects.toThrow(/read-only/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/storage/localRosterStore.test.ts`
Expected: FAIL — cannot find module `./localRosterStore`.

- [ ] **Step 3: Implement `localRosterStore.ts`**

```ts
// web/src/storage/localRosterStore.ts
import type { RosterStore } from "./RosterStore";
import { sanitizeRoster } from "./sanitize";

export function makeLocalRosterStore(): RosterStore {
  return {
    async load() {
      const res = await fetch(`${import.meta.env.BASE_URL}roster.json`);
      if (!res.ok) throw new Error(`roster.json ${res.status}`);
      return sanitizeRoster(await res.json());
    },
    async save() {
      throw new Error("demo is read-only");
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/storage/localRosterStore.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/storage/localRosterStore.ts web/src/storage/localRosterStore.test.ts
git commit -m "feat(web): add LocalRosterStore (fetch fixture + sanitize; demo read-only)"
```

---

### Task 5: Supabase row store + shared client (`supabaseRowStore.ts`, `supabaseClient.ts`)

The thin network binding. `makeSupabaseRowStore` is unit-tested against fakes; the live `createSupabaseRowStore` is exercised after Phase 2 wires auth. Adds the SDK dependency.

**Files:**
- Create: `web/src/storage/supabaseClient.ts`
- Create: `web/src/storage/supabaseRowStore.ts`
- Test: `web/src/storage/supabaseRowStore.test.ts`
- Modify: `web/package.json` (add `@supabase/supabase-js`)

- [ ] **Step 1: Add the SDK dependency (exact-pinned)**

Run: `npm install --save-exact @supabase/supabase-js`
Expected: installs and writes an exact version (e.g. `"@supabase/supabase-js": "2.x.y"`) into `dependencies`. (`.npmrc` already sets `save-exact=true` and `ignore-scripts=true`.)

- [ ] **Step 2: Write the failing tests for the testable binding logic**

```ts
// web/src/storage/supabaseRowStore.test.ts
import { describe, it, expect } from "vitest";
import { makeSupabaseRowStore, type AppDataClient } from "./supabaseRowStore";
import type { RosterData } from "../types";

function fakeClient(initial: unknown | null = null) {
  let stored: unknown | null = initial;
  const calls: { getUid: number; get: string[]; put: Array<[string, unknown]> } = { getUid: 0, get: [], put: [] };
  const client: AppDataClient = {
    async getData(uid) { calls.get.push(uid); return stored; },
    async putData(uid, data) { calls.put.push([uid, data]); stored = data; },
  };
  return { client, calls };
}

describe("makeSupabaseRowStore", () => {
  it("getRow resolves uid then reads via the client", async () => {
    const { client, calls } = fakeClient(null);
    const store = makeSupabaseRowStore(client, async () => "uid-1");
    const row = await store.getRow();
    expect(row).toBeNull();
    expect(calls.get).toEqual(["uid-1"]);
  });

  it("putRow resolves uid then writes via the client", async () => {
    const { client, calls } = fakeClient(null);
    const store = makeSupabaseRowStore(client, async () => "uid-1");
    const data = { teams: [], snapshot: {} } as unknown as RosterData;
    await store.putRow(data);
    expect(calls.put).toEqual([["uid-1", data]]);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/storage/supabaseRowStore.test.ts`
Expected: FAIL — cannot find module `./supabaseRowStore`.

- [ ] **Step 4: Implement `supabaseClient.ts`**

```ts
// web/src/storage/supabaseClient.ts
// Single shared Supabase client for data + auth (auth wired in Phase 2).
// Dynamic-imports the SDK so it is absent from the demo (VITE_BACKEND=local) bundle.
import type { SupabaseClient } from "@supabase/supabase-js";

let clientPromise: Promise<SupabaseClient> | null = null;

export function getSupabaseClient(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(
        import.meta.env.VITE_SUPABASE_URL as string,
        import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      ),
    );
  }
  return clientPromise;
}
```

- [ ] **Step 5: Implement `supabaseRowStore.ts`**

```ts
// web/src/storage/supabaseRowStore.ts
import type { RosterData } from "../types";
import type { RowStore } from "./RosterStore";
import { getSupabaseClient } from "./supabaseClient";

/** Minimal data access used by the row store — testable against a fake. */
export interface AppDataClient {
  getData(uid: string): Promise<unknown | null>;
  putData(uid: string, data: RosterData): Promise<void>;
}

export function makeSupabaseRowStore(client: AppDataClient, getUid: () => Promise<string>): RowStore {
  return {
    async getRow() {
      return client.getData(await getUid());
    },
    async putRow(data) {
      await client.putData(await getUid(), data);
    },
  };
}

/** Live binding: real Supabase client + session uid. Exercised after Phase 2 auth. */
export async function createSupabaseRowStore(): Promise<RowStore> {
  const supabase = await getSupabaseClient();
  const client: AppDataClient = {
    async getData(uid) {
      const { data, error } = await supabase.from("app_data").select("data").eq("owner", uid).maybeSingle();
      if (error) throw error;
      return data ? (data as { data: unknown }).data : null;
    },
    async putData(uid, value) {
      const { error } = await supabase
        .from("app_data")
        .upsert({ owner: uid, data: value, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
  };
  const getUid = async () => {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid) throw new Error("Not authenticated");
    return uid;
  };
  return makeSupabaseRowStore(client, getUid);
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/storage/supabaseRowStore.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Verify the whole project still typechecks**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add web/src/storage/supabaseClient.ts web/src/storage/supabaseRowStore.ts web/src/storage/supabaseRowStore.test.ts web/package.json web/package-lock.json
git commit -m "feat(web): add SupabaseRowStore + shared dynamic-imported client"
```

---

### Task 6: Store factory (`createRosterStore.ts`)

Reads `VITE_BACKEND` and returns the right store; dynamic-imports the Supabase modules only on the `supabase` path.

**Files:**
- Create: `web/src/storage/createRosterStore.ts`
- Test: `web/src/storage/createRosterStore.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// web/src/storage/createRosterStore.test.ts
import { describe, it, expect, afterEach, vi } from "vitest";
import { createRosterStore } from "./createRosterStore";

afterEach(() => vi.unstubAllEnvs());

describe("createRosterStore", () => {
  it("returns the read-only local store by default", async () => {
    // VITE_BACKEND is unset in tests → local path
    const store = await createRosterStore();
    await expect(store.save({} as never)).rejects.toThrow(/read-only/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/storage/createRosterStore.test.ts`
Expected: FAIL — cannot find module `./createRosterStore`.

- [ ] **Step 3: Implement `createRosterStore.ts`**

```ts
// web/src/storage/createRosterStore.ts
import type { RosterStore } from "./RosterStore";
import { makeLocalRosterStore } from "./localRosterStore";

export async function createRosterStore(): Promise<RosterStore> {
  if (import.meta.env.VITE_BACKEND === "supabase") {
    const [{ createSupabaseRowStore }, { makeSupabaseRosterStore }] = await Promise.all([
      import("./supabaseRowStore"),
      import("./supabaseRosterStore"),
    ]);
    return makeSupabaseRosterStore(await createSupabaseRowStore());
  }
  return makeLocalRosterStore();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/storage/createRosterStore.test.ts`
Expected: PASS (1 test). (The `supabase` branch is verified live in Phase 2.)

- [ ] **Step 5: Commit**

```bash
git add web/src/storage/createRosterStore.ts web/src/storage/createRosterStore.test.ts
git commit -m "feat(web): add createRosterStore factory (VITE_BACKEND routing)"
```

---

### Task 7: Wire `App` to the seam + honest empty state

`App` consumes an injectable `RosterStore` (default: the factory) and renders an honest empty state when the roster has no people. Removes the global-`fetch` stub from `App.test`.

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/App.test.tsx` (replace fetch-stub tests with injected-store tests)

- [ ] **Step 1: Rewrite `App.test.tsx` with injected stores (failing)**

```tsx
// web/src/App.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import App from "./App";
import roster from "../public/roster.json";
import type { RosterData } from "./types";
import type { RosterStore } from "./storage/RosterStore";

function storeOf(data: RosterData): RosterStore {
  return { load: async () => data, save: async () => {} };
}
function failingStore(message: string): RosterStore {
  return { load: async () => { throw new Error(message); }, save: async () => {} };
}

describe("App", () => {
  it("loads from the store and renders the dashboard", async () => {
    render(<App store={storeOf(roster as RosterData)} />);
    await waitFor(() => expect(screen.getByText("Team status")).toBeInTheDocument());
    expect(screen.getByText("on plan")).toBeInTheDocument();
    expect(screen.getByText("Maya R.")).toBeInTheDocument();
  });

  it("renders an honest empty state when the roster has no people", async () => {
    const empty: RosterData = { teams: [], snapshot: (roster as RosterData).snapshot };
    render(<App store={storeOf(empty)} />);
    await waitFor(() => expect(screen.getByText(/No one on the roster yet/i)).toBeInTheDocument());
    expect(screen.queryByText("on plan")).toBeNull();
  });

  it("shows the error message when the store load fails", async () => {
    render(<App store={failingStore("roster.json 503")} />);
    await waitFor(() => expect(screen.getByText(/Could not load the roster/)).toBeInTheDocument());
    expect(screen.getByText(/503/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — `App` does not accept a `store` prop / no empty-state text.

- [ ] **Step 3: Rewrite `App.tsx`**

```tsx
// web/src/App.tsx
import { useEffect, useState } from "react";
import type { RosterData } from "./types";
import { derive } from "./roster";
import type { RosterStore } from "./storage/RosterStore";
import { createRosterStore } from "./storage/createRosterStore";
import { Header } from "./components/Header";
import { SummaryStrip } from "./components/SummaryStrip";
import { RosterTable } from "./components/RosterTable";

export default function App({ store }: { store?: RosterStore }) {
  const [data, setData] = useState<RosterData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ready = store ? Promise.resolve(store) : createRosterStore();
    ready
      .then((s) => s.load())
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(String(e)); });
    return () => { cancelled = true; };
  }, [store]);

  if (error) {
    return (
      <div className="p-[38px_48px_44px] font-mono text-[13px]" style={{ color: "var(--rust-deep)" }}>
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
      {d.total === 0 ? (
        <p className="mt-[26px] font-mono text-[12px] text-muted">No one on the roster yet.</p>
      ) : (
        <>
          <SummaryStrip d={d} />
          <RosterTable d={d} />
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/App.tsx web/src/App.test.tsx
git commit -m "feat(web): App consumes injectable RosterStore + honest empty state"
```

---

### Task 8: Schema + env example (`schema.sql`, `.env.example`)

Shipped for the human to run in the Supabase dashboard. No automated test.

**Files:**
- Create: `web/supabase/schema.sql`
- Create: `web/.env.example`

- [ ] **Step 1: Create `web/supabase/schema.sql`**

```sql
-- Command View — Phase 1 schema. Run this in the Supabase SQL editor.
-- One JSON document per user; Row Level Security limits each user to their own row.
create table if not exists app_data (
  owner uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table app_data enable row level security;

create policy app_data_select on app_data
  for select using (auth.uid() = owner);
create policy app_data_insert on app_data
  for insert with check (auth.uid() = owner);
create policy app_data_update on app_data
  for update using (auth.uid() = owner) with check (auth.uid() = owner);
```

- [ ] **Step 2: Create `web/.env.example`**

```
# Real (supabase) build only. The public demo build (VITE_BACKEND=local) needs none of these.
VITE_BACKEND=supabase
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
# Publishable / anon key ONLY — never the service (secret) key, it must not reach the browser.
VITE_SUPABASE_ANON_KEY=YOUR-PUBLISHABLE-ANON-KEY
```

- [ ] **Step 3: Commit**

```bash
git add web/supabase/schema.sql web/.env.example
git commit -m "chore(web): ship Supabase schema.sql (app_data + RLS) and .env.example"
```

---

### Task 9: Pin the demo CI build to `VITE_BACKEND=local`

A dynamic `import()` only drops the SDK from the demo bundle when the guarding
condition is a **build-time constant**. An *unset* `VITE_BACKEND` is not
statically replaced, so the lazy Supabase chunk would still ship. Setting
`VITE_BACKEND=local` on the build makes `import.meta.env.VITE_BACKEND` the
literal `"local"`, so `"local" === "supabase"` folds to `false` and the dynamic
import (and its chunk) is eliminated. This must hold for the deployed Pages demo.

**Files:**
- Modify: `.github/workflows/web.yml:36` (the `npm run build` step)

- [ ] **Step 1: Add the env to the build step**

Replace:

```yaml
      - run: npm run build
```

with:

```yaml
      - run: npm run build
        env:
          VITE_BACKEND: local
```

(This is the build step inside the `checks` job, ~line 36 — the one whose
`web/dist` output is uploaded as the Pages artifact.)

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/web.yml
git commit -m "ci(web): pin demo build to VITE_BACKEND=local so the Supabase SDK is excluded"
```

---

### Task 10: Verify the demo bundle ships no Supabase SDK + full green gate

The `local` build must not include the Supabase SDK, and every check must pass.

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — all suites green (the prior 32 tests plus the new storage/App tests).

- [ ] **Step 2: Typecheck, lint, guardrail**

Run: `npm run typecheck && npm run lint && npm run guardrail`
Expected: all PASS (`OK — no raw design values`).

- [ ] **Step 3: Build the demo bundle (flag pinned) and confirm no Supabase SDK leaked**

Run: `VITE_BACKEND=local npm run build && ! grep -riq "supabase" dist/assets`
Expected: build succeeds AND the `grep` finds nothing, so the negated command
exits 0. (If `grep` finds `supabase`, the command exits 1 — the SDK leaked into
the demo bundle; the dead-branch dynamic import was not eliminated.)

- [ ] **Step 4: Build the supabase variant to confirm it compiles**

Run: `VITE_BACKEND=supabase VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=test npm run build`
Expected: build succeeds (the Supabase SDK is emitted in a lazy chunk). This is a compile check only — no live connection.

- [ ] **Step 5: Confirm a clean tree**

```bash
git status   # expect clean working tree; dist/ is gitignored
```

---

## Self-Review

**Spec coverage:**
- Seam (`RosterStore` + `RowStore`) → Task 2. ✔
- `sanitizeRoster` load boundary (backfill, clamp cat, throw on garbage) → Task 1. ✔
- `LocalRosterStore` (fetch+sanitize, save throws) → Task 4. ✔
- `SupabaseRosterStore` (bootstrap-on-null, no reseed, save-through) → Task 3. ✔
- `SupabaseRowStore` + shared dynamic-imported client (anon key, getUid placeholder) → Task 5. ✔
- `createRosterStore` factory (VITE_BACKEND, dynamic import) → Task 6. ✔
- App wiring (injectable store, empty state, error state) → Task 7. ✔
- `schema.sql` (app_data + RLS) + `.env.example` (anon key only) → Task 8. ✔
- Dynamic-import excludes SDK from demo: build-time-constant flag pin → Task 9 (CI) + Task 10 step 3 (verify). ✔
- Auth sequencing (adapter unit-tested vs fake; live deferred to Phase 2) → Tasks 3/5 use fakes; Task 10 step 4 is compile-only. ✔

**Placeholder scan:** No TBD/TODO; every code step shows full code; commands have expected output.

**Type consistency:** `RosterStore.load/save`, `RowStore.getRow/putRow`, `makeSupabaseRosterStore(rowStore)`, `makeSupabaseRowStore(client, getUid)`, `AppDataClient.getData/putData`, `createRosterStore()`, `sanitizeRoster`/`emptyRoster`/`todaySnapshot` are used identically across tasks. `App` prop `{ store?: RosterStore }` matches the test usage.
