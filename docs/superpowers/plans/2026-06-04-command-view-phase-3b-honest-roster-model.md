# Command View Phase 3b — Honest Roster Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape the model so humans manage engineers + their Linear/Slack mapping and corrections, while work state is pulled (read-only) — replacing the hand-typed Phase-3 CRUD.

**Architecture:** A new stored `RosterDoc` (human `engineers`+`corrections`, pipeline `work`) is merged by a pure `mergeRoster()` into the existing `RosterData`/`derive()` display contract. Storage splits into two `app_data` columns (`data` human, `work` pipeline) so the web app never clobbers the pipeline. The full-page form becomes an engineer + correction editor; work fields are read-only with a synced stamp.

**Tech Stack:** React 19, TypeScript, Vite, Vitest (jsdom, globals, `renderHook`), Supabase.

**Working directory:** `web/` (run `cd web` first).

**IMPORTANT — intermediate typechecking:** This reshape changes shared types, so `npm run typecheck` (`tsc -b`) will NOT pass until the integration tasks (12–13) are done. During earlier tasks, verify with the **targeted** `npx vitest run <file>` commands shown (Vitest compiles per-file via esbuild and is unaffected by type errors elsewhere). The full gate (`npm run typecheck`/`lint`/`build`) runs in Task 14.

**Spec:** `docs/superpowers/specs/2026-06-04-command-view-phase-3b-honest-roster-model-design.md`

---

### Task 1: New types (`Engineer`/`Correction`/`WorkState`/`RosterDoc`) + `Person.hasActivity`

**Files:** Modify `web/src/types.ts`

- [ ] **Step 1: Add the new types and the optional `hasActivity` flag**

Append to `web/src/types.ts` (after the existing `RosterData` interface), and add one field to `Person`:

```ts
// --- Phase 3b: stored document (config / pulled work / corrections) ---

/** Human-owned roster config. */
export interface Engineer {
  id: string;
  name: string;
  role: string;
  team: string;
  linearUserId: string | null; // mapping → Linear Member.id
  email: string | null;        // mapping → Slack/Linear by email
}

/** Human-owned override of a pulled row ("Correct my row"). */
export interface Correction {
  cat?: Category;
  note?: string;
}

/** Pipeline-owned, pulled & classified work for one engineer (read-only in the app). */
export interface WorkState {
  cat: Category;
  conf: Confidence;
  what: string;
  ticket: string | null;
  since: string | null;
  detail: PersonDetail;
}

/** Pipeline-owned snapshot, keyed by engineer id. */
export interface WorkSnapshot {
  syncedAt: string | null;
  states: Record<string, WorkState>;
}

/** The stored document: human side (engineers + corrections) + pipeline side (work). */
export interface RosterDoc {
  engineers: Engineer[];
  corrections: Record<string, Correction>;
  work: WorkSnapshot;
}
```

And in the existing `Person` interface add (after `detail`):

```ts
  /** Display flag: false when an engineer has no pulled work state and no correction. Optional; undefined ≡ true. */
  hasActivity?: boolean;
```

- [ ] **Step 2: Commit** (no test — types only; downstream tasks consume them)

```bash
git add web/src/types.ts
git commit -m "feat(web): add RosterDoc model types + Person.hasActivity"
```

---

### Task 2: Engineer/correction mutations (reshape `mutations.ts`)

Replace the person mutations with engineer + correction mutations on `RosterDoc`. Teams are no longer managed here (grouping happens at merge).

**Files:** Modify `web/src/roster/mutations.ts`; Modify `web/src/roster/mutations.test.ts`

- [ ] **Step 1: Replace `mutations.test.ts` with the new failing tests**

```ts
// web/src/roster/mutations.test.ts
import { describe, it, expect } from "vitest";
import {
  addEngineer, updateEngineer, removeEngineer, setCorrection, clearCorrection,
  deriveInitials, type EngineerInput,
} from "./mutations";
import type { RosterDoc } from "../types";

const empty: RosterDoc = { engineers: [], corrections: {}, work: { syncedAt: null, states: {} } };

function input(over: Partial<EngineerInput> = {}): EngineerInput {
  return { name: "Maya R.", role: "EM", team: "Platform", linearUserId: null, email: null, ...over };
}

describe("deriveInitials", () => {
  it("first letter of up to two words, uppercased", () => {
    expect(deriveInitials("Maya R.")).toBe("MR");
    expect(deriveInitials("alex")).toBe("A");
  });
});

describe("engineer mutations", () => {
  it("addEngineer appends a flat engineer with a fresh id", () => {
    const d = addEngineer(empty, input());
    expect(d.engineers).toHaveLength(1);
    expect(d.engineers[0].name).toBe("Maya R.");
    expect(d.engineers[0].id).toMatch(/.+/);
    expect(empty.engineers).toHaveLength(0); // immutable
  });

  it("updateEngineer changes fields, preserving id", () => {
    const d1 = addEngineer(empty, input());
    const id = d1.engineers[0].id;
    const d2 = updateEngineer(d1, id, input({ team: "Payments", linearUserId: "lin_1" }));
    expect(d2.engineers[0].id).toBe(id);
    expect(d2.engineers[0].team).toBe("Payments");
    expect(d2.engineers[0].linearUserId).toBe("lin_1");
  });

  it("removeEngineer drops the engineer and its correction", () => {
    const d1 = addEngineer(empty, input());
    const id = d1.engineers[0].id;
    const d2 = setCorrection(d1, id, { cat: "incident" });
    const d3 = removeEngineer(d2, id);
    expect(d3.engineers).toHaveLength(0);
    expect(d3.corrections[id]).toBeUndefined();
  });

  it("setCorrection and clearCorrection manage the corrections map", () => {
    const d1 = addEngineer(empty, input());
    const id = d1.engineers[0].id;
    const d2 = setCorrection(d1, id, { cat: "unplanned", note: "pulled into triage" });
    expect(d2.corrections[id]).toEqual({ cat: "unplanned", note: "pulled into triage" });
    const d3 = clearCorrection(d2, id);
    expect(d3.corrections[id]).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/roster/mutations.test.ts`
Expected: FAIL — new exports don't exist.

- [ ] **Step 3: Replace `mutations.ts` contents**

```ts
// web/src/roster/mutations.ts
import type { Correction, Engineer, RosterDoc } from "../types";

export interface EngineerInput {
  name: string;
  role: string;
  team: string;
  linearUserId: string | null;
  email: string | null;
}

export function deriveInitials(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

export function buildEngineer(input: EngineerInput): Engineer {
  return { id: crypto.randomUUID(), ...input };
}

export function addEngineer(doc: RosterDoc, input: EngineerInput): RosterDoc {
  return { ...doc, engineers: [...doc.engineers, buildEngineer(input)] };
}

export function updateEngineer(doc: RosterDoc, id: string, input: EngineerInput): RosterDoc {
  return { ...doc, engineers: doc.engineers.map((e) => (e.id === id ? { ...e, ...input } : e)) };
}

export function removeEngineer(doc: RosterDoc, id: string): RosterDoc {
  const corrections = { ...doc.corrections };
  delete corrections[id];
  return { ...doc, engineers: doc.engineers.filter((e) => e.id !== id), corrections };
}

export function setCorrection(doc: RosterDoc, id: string, correction: Correction): RosterDoc {
  return { ...doc, corrections: { ...doc.corrections, [id]: correction } };
}

export function clearCorrection(doc: RosterDoc, id: string): RosterDoc {
  const corrections = { ...doc.corrections };
  delete corrections[id];
  return { ...doc, corrections };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/roster/mutations.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/roster/mutations.ts web/src/roster/mutations.test.ts
git commit -m "feat(web): reshape mutations to engineer + correction ops on RosterDoc"
```

---

### Task 3: Pure merge (`merge.ts`)

`mergeRoster(doc)` → `RosterData` (display), grouping engineers by team, overlaying work + corrections, setting `hasActivity`.

**Files:** Create `web/src/roster/merge.ts`; Test `web/src/roster/merge.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// web/src/roster/merge.test.ts
import { describe, it, expect } from "vitest";
import { mergeRoster } from "./merge";
import type { RosterDoc } from "../types";

function doc(over: Partial<RosterDoc> = {}): RosterDoc {
  return { engineers: [], corrections: {}, work: { syncedAt: null, states: {} }, ...over };
}

describe("mergeRoster", () => {
  it("overlays pulled work onto an engineer", () => {
    const d = doc({
      engineers: [{ id: "e1", name: "Maya R.", role: "EM", team: "Platform", linearUserId: null, email: null }],
      work: { syncedAt: "Tue 9:02 AM", states: { e1: { cat: "incident", conf: "high", what: "DB pool", ticket: "INC-1", since: null, detail: { tickets: ["INC-1"], note: "sev2" } } } },
    });
    const r = mergeRoster(d);
    const p = r.teams[0].people[0];
    expect(p.name).toBe("Maya R.");
    expect(p.initials).toBe("MR");
    expect(p.cat).toBe("incident");
    expect(p.what).toBe("DB pool");
    expect(p.hasActivity).toBe(true);
    expect(r.snapshot.day).toBe("Tue 9:02 AM"); // syncedAt carried for the header
  });

  it("marks an engineer with no work and no correction as no-activity", () => {
    const d = doc({ engineers: [{ id: "e1", name: "Priya N.", role: "Eng", team: "Platform", linearUserId: null, email: null }] });
    const p = mergeRoster(d).teams[0].people[0];
    expect(p.hasActivity).toBe(false);
    expect(p.what).toBe("");
  });

  it("applies a correction (category + note) as real signal", () => {
    const d = doc({
      engineers: [{ id: "e1", name: "A B", role: "Eng", team: "T", linearUserId: null, email: null }],
      corrections: { e1: { cat: "unplanned", note: "pulled into triage" } },
    });
    const p = mergeRoster(d).teams[0].people[0];
    expect(p.cat).toBe("unplanned");
    expect(p.detail.note).toBe("pulled into triage");
    expect(p.hasActivity).toBe(true);
  });

  it("a correction category overrides the pulled work category", () => {
    const d = doc({
      engineers: [{ id: "e1", name: "A B", role: "Eng", team: "T", linearUserId: null, email: null }],
      work: { syncedAt: null, states: { e1: { cat: "planned", conf: "high", what: "x", ticket: null, since: null, detail: { tickets: [], note: "auto" } } } },
      corrections: { e1: { cat: "incident" } },
    });
    expect(mergeRoster(d).teams[0].people[0].cat).toBe("incident");
  });

  it("groups engineers into teams in first-seen order", () => {
    const d = doc({ engineers: [
      { id: "e1", name: "A", role: "", team: "Platform", linearUserId: null, email: null },
      { id: "e2", name: "B", role: "", team: "Payments", linearUserId: null, email: null },
      { id: "e3", name: "C", role: "", team: "Platform", linearUserId: null, email: null },
    ] });
    const r = mergeRoster(d);
    expect(r.teams.map((t) => t.name)).toEqual(["Platform", "Payments"]);
    expect(r.teams[0].people.map((p) => p.name)).toEqual(["A", "C"]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/roster/merge.test.ts`
Expected: FAIL — cannot find module `./merge`.

- [ ] **Step 3: Implement `merge.ts`**

```ts
// web/src/roster/merge.ts
import type { Person, RosterData, RosterDoc, Snapshot, Team } from "../types";
import { deriveInitials } from "./mutations";

export function mergeRoster(doc: RosterDoc): RosterData {
  const byTeam = new Map<string, Person[]>();
  const order: string[] = [];

  for (const e of doc.engineers) {
    const work = doc.work.states[e.id];
    const corr = doc.corrections[e.id];
    const correctionIsSignal = !!corr && (corr.cat !== undefined || (corr.note ?? "") !== "");
    const person: Person = {
      id: e.id,
      name: e.name,
      initials: deriveInitials(e.name),
      role: e.role,
      team: e.team,
      cat: corr?.cat ?? work?.cat ?? "planned",
      conf: work?.conf ?? "high",
      what: work?.what ?? "",
      ticket: work?.ticket ?? null,
      since: work?.since ?? null,
      detail: {
        tickets: work?.detail.tickets ?? [],
        note: corr?.note ?? work?.detail.note ?? "",
      },
      hasActivity: !!work || correctionIsSignal,
    };
    if (!byTeam.has(e.team)) { byTeam.set(e.team, []); order.push(e.team); }
    byTeam.get(e.team)!.push(person);
  }

  const teams: Team[] = order.map((name) => ({ name, lead: "", people: byTeam.get(name)! }));
  const snapshot: Snapshot = { day: doc.work.syncedAt ?? "", time: "", prev: "", next: "", slackConnected: false };
  return { teams, snapshot };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/roster/merge.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/roster/merge.ts web/src/roster/merge.test.ts
git commit -m "feat(web): pure mergeRoster (engineers + work + corrections → display roster)"
```

---

### Task 4: `derive` excludes no-activity people from category counts

**Files:** Modify `web/src/roster.ts`; Modify `web/src/roster.test.ts`

- [ ] **Step 1: Add a failing test to `roster.test.ts`**

Inside the existing top `describe`, add (the `person()` helper already builds a `Person`; it defaults `hasActivity` undefined ≡ active):

```ts
  it("excludes no-activity people from category counts but counts them in total", () => {
    const data = {
      snapshot: { day: "", time: "", prev: "", next: "", slackConnected: false },
      teams: [{ name: "T", lead: "", people: [
        { ...person("planned"), hasActivity: true },
        { ...person("incident"), hasActivity: false }, // no tracked activity
      ] }],
    };
    const d = derive(data as never);
    expect(d.total).toBe(2);             // counted in headcount
    expect(d.counts.incident).toBe(0);   // not counted in categories
    expect(d.counts.planned).toBe(1);
    expect(d.firefighting).toBe(0);
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/roster.test.ts`
Expected: FAIL — `incident` is counted as 1.

- [ ] **Step 3: Update `derive` in `roster.ts`**

Change the two counting loops to skip `hasActivity === false`:

```ts
  const all: Person[] = data.teams.flatMap((t) => t.people);
  const counts = emptyCounts();
  for (const p of all) if (p.hasActivity !== false) counts[p.cat] += 1;
```

and inside the per-team map:

```ts
    const tc = emptyCounts();
    for (const p of t.people) if (p.hasActivity !== false) tc[p.cat] += 1;
```

(Leave everything else unchanged — `total` stays `all.length`.)

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/roster.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/roster.ts web/src/roster.test.ts
git commit -m "feat(web): derive excludes no-activity people from category tallies"
```

---

### Task 5: Load boundary `sanitizeDoc` + `emptyDoc` + legacy migration

**Files:** Modify `web/src/storage/sanitize.ts`; Modify `web/src/storage/sanitize.test.ts`

- [ ] **Step 1: Write failing tests** (add to `sanitize.test.ts`; keep the existing `sanitizeRoster` tests)

```ts
import { sanitizeDoc, emptyDoc } from "./sanitize";

describe("sanitizeDoc", () => {
  it("accepts the new shape and backfills engineer ids", () => {
    const d = sanitizeDoc(
      { engineers: [{ name: "Maya R.", role: "EM", team: "Platform" }], corrections: {} },
      { syncedAt: "t", states: {} },
    );
    expect(d.engineers[0].name).toBe("Maya R.");
    expect(d.engineers[0].id).toMatch(/.+/);
    expect(d.engineers[0].linearUserId).toBeNull();
    expect(d.work.syncedAt).toBe("t");
  });

  it("migrates a legacy Phase-3 teams[] blob to engineers (no throw, no work)", () => {
    const legacy = {
      teams: [{ name: "Platform", lead: "", people: [
        { id: "p1", name: "Maya R.", role: "EM", team: "Platform", cat: "planned", conf: "high", what: "x", ticket: null, since: null, detail: { tickets: [], note: "" } },
      ] }],
      snapshot: { day: "", time: "", prev: "", next: "", slackConnected: false },
    };
    const d = sanitizeDoc(legacy, {});
    expect(d.engineers).toEqual([{ id: "p1", name: "Maya R.", role: "EM", team: "Platform", linearUserId: null, email: null }]);
    expect(d.work.states).toEqual({});
    expect(d.corrections).toEqual({});
  });

  it("throws on a non-null unrecognized blob", () => {
    expect(() => sanitizeDoc({ nope: 1 }, {})).toThrow();
  });

  it("emptyDoc is valid input to sanitizeDoc", () => {
    expect(() => sanitizeDoc(emptyDoc(), emptyDoc().work)).not.toThrow();
    expect(emptyDoc().engineers).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/storage/sanitize.test.ts`
Expected: FAIL — `sanitizeDoc`/`emptyDoc` not exported.

- [ ] **Step 3: Implement in `sanitize.ts`**

Add these exports (keep `sanitizeRoster` — it's reused for migration; remove `emptyRoster` and `todaySnapshot`, now unused). Add near the bottom:

```ts
import type { Correction, Engineer, RosterDoc, WorkSnapshot, WorkState } from "../types";

function sanitizeEngineer(raw: unknown): Engineer {
  const r = isRecord(raw) ? raw : {};
  return {
    id: typeof r.id === "string" && r.id ? r.id : crypto.randomUUID(),
    name: str(r.name),
    role: str(r.role),
    team: str(r.team),
    linearUserId: typeof r.linearUserId === "string" ? r.linearUserId : null,
    email: typeof r.email === "string" ? r.email : null,
  };
}

function sanitizeWorkState(raw: unknown): WorkState {
  const r = isRecord(raw) ? raw : {};
  const detail = isRecord(r.detail) ? r.detail : {};
  return {
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

function sanitizeWork(raw: unknown): WorkSnapshot {
  if (!isRecord(raw)) return { syncedAt: null, states: {} };
  const states: Record<string, WorkState> = {};
  if (isRecord(raw.states)) {
    for (const [id, v] of Object.entries(raw.states)) states[id] = sanitizeWorkState(v);
  }
  return { syncedAt: typeof raw.syncedAt === "string" ? raw.syncedAt : null, states };
}

function sanitizeCorrections(raw: unknown): Record<string, Correction> {
  const out: Record<string, Correction> = {};
  if (!isRecord(raw)) return out;
  for (const [id, v] of Object.entries(raw)) {
    if (!isRecord(v)) continue;
    const c: Correction = {};
    if (CATEGORIES.includes(v.cat as never)) c.cat = v.cat as Correction["cat"];
    if (typeof v.note === "string") c.note = v.note;
    out[id] = c;
  }
  return out;
}

export function emptyDoc(): RosterDoc {
  return { engineers: [], corrections: {}, work: { syncedAt: null, states: {} } };
}

export function sanitizeDoc(rawData: unknown, rawWork: unknown): RosterDoc {
  // Legacy migration: a Phase-3 RosterData { teams: [...] } → engineers (no work, no corrections).
  if (isRecord(rawData) && Array.isArray(rawData.teams) && !Array.isArray(rawData.engineers)) {
    const legacy = sanitizeRoster(rawData); // reuse the old parser
    const engineers: Engineer[] = legacy.teams.flatMap((t) =>
      t.people.map((p) => ({ id: p.id, name: p.name, role: p.role, team: t.name, linearUserId: null, email: null })));
    return { engineers, corrections: {}, work: { syncedAt: null, states: {} } };
  }
  if (!isRecord(rawData) || !Array.isArray(rawData.engineers)) {
    throw new Error("Unrecognized roster data");
  }
  return {
    engineers: rawData.engineers.map(sanitizeEngineer),
    corrections: sanitizeCorrections(rawData.corrections),
    work: sanitizeWork(rawWork),
  };
}
```

Then **remove** the now-unused `emptyRoster` and `todaySnapshot` exports from this file.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/storage/sanitize.test.ts`
Expected: PASS (existing `sanitizeRoster` tests + the new `sanitizeDoc` tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/storage/sanitize.ts web/src/storage/sanitize.test.ts
git commit -m "feat(web): sanitizeDoc load boundary + emptyDoc + legacy migration"
```

---

### Task 6: Reshape the storage seam (`RosterStore.ts`)

**Files:** Modify `web/src/storage/RosterStore.ts`

- [ ] **Step 1: Replace the interfaces**

```ts
// web/src/storage/RosterStore.ts
import type { Correction, Engineer, RosterDoc } from "../types";

/** App-facing seam: load the full doc (human + pipeline work); save persists ONLY the human side. */
export interface RosterStore {
  load(): Promise<RosterDoc>;
  save(doc: RosterDoc): Promise<void>;
}

/** The human-owned slice the app may persist. */
export interface HumanDoc {
  engineers: Engineer[];
  corrections: Record<string, Correction>;
}

/** Adapter sub-seam: read both columns; write only the human column. */
export interface RowStore {
  getRow(): Promise<{ data: unknown; work: unknown } | null>; // null = no row yet
  putHuman(human: HumanDoc): Promise<void>;
}
```

- [ ] **Step 2: Commit** (typecheck deferred to Task 14)

```bash
git add web/src/storage/RosterStore.ts
git commit -m "feat(web): reshape storage seam for RosterDoc + two-column rows"
```

---

### Task 7: Supabase roster store (`supabaseRosterStore.ts`)

**Files:** Modify `web/src/storage/supabaseRosterStore.ts`; Modify `web/src/storage/supabaseRosterStore.test.ts`

- [ ] **Step 1: Replace the test**

```ts
// web/src/storage/supabaseRosterStore.test.ts
import { describe, it, expect } from "vitest";
import { makeSupabaseRosterStore } from "./supabaseRosterStore";
import type { HumanDoc, RowStore } from "./RosterStore";
import type { RosterDoc } from "../types";

class FakeRowStore implements RowStore {
  row: { data: unknown; work: unknown } | null;
  puts: HumanDoc[] = [];
  constructor(initial: { data: unknown; work: unknown } | null = null) { this.row = initial; }
  async getRow() { return this.row; }
  async putHuman(h: HumanDoc) { this.puts.push(h); this.row = { data: h, work: this.row?.work ?? {} }; }
}

const newRow = {
  data: { engineers: [{ id: "e1", name: "Maya R.", role: "EM", team: "Platform" }], corrections: {} },
  work: { syncedAt: "t", states: { e1: { cat: "incident", conf: "high", what: "x", ticket: null, since: null, detail: { tickets: [], note: "" } } } },
};

describe("makeSupabaseRosterStore", () => {
  it("bootstraps an empty doc (writing only the human side) when the row is null", async () => {
    const fake = new FakeRowStore(null);
    const doc = await makeSupabaseRosterStore(fake).load();
    expect(doc.engineers).toEqual([]);
    expect(fake.puts).toHaveLength(1);
  });

  it("does not rewrite on a subsequent load", async () => {
    const fake = new FakeRowStore(null);
    const store = makeSupabaseRosterStore(fake);
    await store.load();
    await store.load();
    expect(fake.puts).toHaveLength(1);
  });

  it("merges data + work columns into a RosterDoc", async () => {
    const doc = await makeSupabaseRosterStore(new FakeRowStore(newRow)).load();
    expect(doc.engineers[0].name).toBe("Maya R.");
    expect(doc.work.states.e1.cat).toBe("incident");
  });

  it("throws on an unrecognized data column (never overwrites)", async () => {
    const fake = new FakeRowStore({ data: { nope: 1 }, work: {} });
    await expect(makeSupabaseRosterStore(fake).load()).rejects.toThrow();
    expect(fake.puts).toHaveLength(0);
  });

  it("save persists only the human side", async () => {
    const fake = new FakeRowStore(newRow);
    const store = makeSupabaseRosterStore(fake);
    const doc: RosterDoc = { engineers: [{ id: "e9", name: "X", role: "", team: "T", linearUserId: null, email: null }], corrections: {}, work: { syncedAt: "later", states: {} } };
    await store.save(doc);
    expect(fake.puts[0]).toEqual({ engineers: doc.engineers, corrections: {} }); // work NOT written
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/storage/supabaseRosterStore.test.ts`
Expected: FAIL.

- [ ] **Step 3: Reimplement `supabaseRosterStore.ts`**

```ts
// web/src/storage/supabaseRosterStore.ts
import type { RosterStore, RowStore } from "./RosterStore";
import { emptyDoc, sanitizeDoc } from "./sanitize";

export function makeSupabaseRosterStore(rowStore: RowStore): RosterStore {
  return {
    async load() {
      const row = await rowStore.getRow();
      if (row === null) {
        const doc = emptyDoc();
        await rowStore.putHuman({ engineers: doc.engineers, corrections: doc.corrections });
        return doc;
      }
      return sanitizeDoc(row.data, row.work);
    },
    async save(doc) {
      await rowStore.putHuman({ engineers: doc.engineers, corrections: doc.corrections });
    },
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/storage/supabaseRosterStore.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/storage/supabaseRosterStore.ts web/src/storage/supabaseRosterStore.test.ts
git commit -m "feat(web): SupabaseRosterStore over RosterDoc (bootstrap human-only, merge columns)"
```

---

### Task 8: Supabase row store — two columns, write human only (`supabaseRowStore.ts`)

**Files:** Modify `web/src/storage/supabaseRowStore.ts`; Modify `web/src/storage/supabaseRowStore.test.ts`

- [ ] **Step 1: Replace the test**

```ts
// web/src/storage/supabaseRowStore.test.ts
import { describe, it, expect } from "vitest";
import { makeSupabaseRowStore, type AppDataClient } from "./supabaseRowStore";
import type { HumanDoc } from "./RosterStore";

function fakeClient(initial: { data: unknown; work: unknown } | null = null) {
  const calls: { get: string[]; put: Array<[string, HumanDoc]> } = { get: [], put: [] };
  const client: AppDataClient = {
    async getRow(uid) { calls.get.push(uid); return initial; },
    async putHuman(uid, human) { calls.put.push([uid, human]); },
  };
  return { client, calls };
}

describe("makeSupabaseRowStore", () => {
  it("getRow resolves uid then reads both columns via the client", async () => {
    const row = { data: { engineers: [] }, work: { syncedAt: null, states: {} } };
    const { client, calls } = fakeClient(row);
    const store = makeSupabaseRowStore(client, async () => "uid-1");
    expect(await store.getRow()).toEqual(row);
    expect(calls.get).toEqual(["uid-1"]);
  });

  it("putHuman resolves uid then writes the human side via the client", async () => {
    const { client, calls } = fakeClient();
    const store = makeSupabaseRowStore(client, async () => "uid-1");
    const human: HumanDoc = { engineers: [], corrections: {} };
    await store.putHuman(human);
    expect(calls.put).toEqual([["uid-1", human]]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/storage/supabaseRowStore.test.ts`
Expected: FAIL.

- [ ] **Step 3: Reimplement `supabaseRowStore.ts`**

```ts
// web/src/storage/supabaseRowStore.ts
import type { HumanDoc, RowStore } from "./RosterStore";
import { getSupabaseClient } from "./supabaseClient";

/** Minimal data access used by the row store — testable against a fake. */
export interface AppDataClient {
  getRow(uid: string): Promise<{ data: unknown; work: unknown } | null>;
  putHuman(uid: string, human: HumanDoc): Promise<void>;
}

export function makeSupabaseRowStore(client: AppDataClient, getUid: () => Promise<string>): RowStore {
  return {
    async getRow() {
      return client.getRow(await getUid());
    },
    async putHuman(human) {
      await client.putHuman(await getUid(), human);
    },
  };
}

/** Live binding: reads data+work columns; writes ONLY the data column (pipeline owns work). */
export async function createSupabaseRowStore(): Promise<RowStore> {
  const supabase = await getSupabaseClient();
  const client: AppDataClient = {
    async getRow(uid) {
      const { data, error } = await supabase.from("app_data").select("data, work").eq("owner", uid).maybeSingle();
      if (error) throw error;
      return data ? { data: (data as { data: unknown }).data, work: (data as { work: unknown }).work } : null;
    },
    async putHuman(uid, human) {
      // Upsert only the data column; on an existing row Postgres leaves `work` untouched.
      const { error } = await supabase
        .from("app_data")
        .upsert({ owner: uid, data: human, updated_at: new Date().toISOString() });
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

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/storage/supabaseRowStore.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/storage/supabaseRowStore.ts web/src/storage/supabaseRowStore.test.ts
git commit -m "feat(web): SupabaseRowStore reads data+work, writes only the human data column"
```

---

### Task 9: Local store loads a `RosterDoc` fixture (`localRosterStore.ts`)

**Files:** Modify `web/src/storage/localRosterStore.ts`; Modify `web/src/storage/localRosterStore.test.ts`

- [ ] **Step 1: Replace the test**

```ts
// web/src/storage/localRosterStore.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { makeLocalRosterStore } from "./localRosterStore";

afterEach(() => vi.unstubAllGlobals());

const fixture = {
  engineers: [{ id: "e1", name: "Maya R.", role: "EM", team: "Platform", linearUserId: null, email: null }],
  corrections: {},
  work: { syncedAt: "Tue 9:02 AM", states: { e1: { cat: "planned", conf: "high", what: "x", ticket: null, since: null, detail: { tickets: [], note: "" } } } },
};

describe("makeLocalRosterStore", () => {
  it("fetches and sanitizes the RosterDoc fixture (engineers + work)", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(fixture) } as Response)));
    const doc = await makeLocalRosterStore().load();
    expect(doc.engineers).toHaveLength(1);
    expect(doc.work.states.e1.what).toBe("x");
  });

  it("throws when the fetch is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 503 } as Response)));
    await expect(makeLocalRosterStore().load()).rejects.toThrow(/503/);
  });

  it("save throws because the demo is read-only", async () => {
    await expect(makeLocalRosterStore().save({ engineers: [], corrections: {}, work: { syncedAt: null, states: {} } })).rejects.toThrow(/read-only/);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/storage/localRosterStore.test.ts`
Expected: FAIL.

- [ ] **Step 3: Reimplement `localRosterStore.ts`**

```ts
// web/src/storage/localRosterStore.ts
import type { RosterStore } from "./RosterStore";
import { sanitizeDoc } from "./sanitize";

export function makeLocalRosterStore(): RosterStore {
  return {
    async load() {
      const res = await fetch(`${import.meta.env.BASE_URL}roster.json`);
      if (!res.ok) throw new Error(`roster.json ${res.status}`);
      const raw: unknown = await res.json();
      const work = typeof raw === "object" && raw !== null ? (raw as { work?: unknown }).work : null;
      return sanitizeDoc(raw, work);
    },
    async save() {
      throw new Error("demo is read-only");
    },
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/storage/localRosterStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/storage/localRosterStore.ts web/src/storage/localRosterStore.test.ts
git commit -m "feat(web): LocalRosterStore loads a RosterDoc fixture"
```

---

### Task 10: `useRoster` holds a `RosterDoc`

**Files:** Modify `web/src/useRoster.ts`; Modify `web/src/useRoster.test.ts`

- [ ] **Step 1: Replace the test**

```ts
// web/src/useRoster.test.ts
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useRoster } from "./useRoster";
import type { RosterStore } from "./storage/RosterStore";
import type { RosterDoc } from "./types";

const base: RosterDoc = { engineers: [], corrections: {}, work: { syncedAt: null, states: {} } };

function fakeStore(over: Partial<RosterStore> = {}): RosterStore {
  return { load: async () => base, save: vi.fn(async () => {}), ...over };
}

describe("useRoster", () => {
  it("loads the doc from the store", async () => {
    const { result } = renderHook(() => useRoster(fakeStore()));
    await waitFor(() => expect(result.current.doc).not.toBeNull());
    expect(result.current.doc!.engineers).toEqual([]);
  });

  it("commit saves first, then updates state", async () => {
    const save = vi.fn(async () => {});
    const { result } = renderHook(() => useRoster(fakeStore({ save })));
    await waitFor(() => expect(result.current.doc).not.toBeNull());
    await act(async () => {
      await result.current.commit((d) => ({ ...d, engineers: [{ id: "e1", name: "X", role: "", team: "T", linearUserId: null, email: null }] }));
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.doc!.engineers).toHaveLength(1);
  });

  it("leaves state unchanged and rejects when save fails", async () => {
    const save = vi.fn(async () => { throw new Error("offline"); });
    const { result } = renderHook(() => useRoster(fakeStore({ save })));
    await waitFor(() => expect(result.current.doc).not.toBeNull());
    await act(async () => {
      await expect(result.current.commit((d) => ({ ...d, engineers: [{ id: "e1", name: "X", role: "", team: "T", linearUserId: null, email: null }] }))).rejects.toThrow("offline");
    });
    expect(result.current.doc!.engineers).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/useRoster.test.ts`
Expected: FAIL.

- [ ] **Step 3: Reimplement `useRoster.ts`**

```ts
// web/src/useRoster.ts
import { useEffect, useRef, useState } from "react";
import type { RosterDoc } from "./types";
import type { RosterStore } from "./storage/RosterStore";
import { createRosterStore } from "./storage/createRosterStore";

export function useRoster(store?: RosterStore) {
  const [doc, setDoc] = useState<RosterDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const storeRef = useRef<RosterStore | null>(store ?? null);
  const initialStoreRef = useRef<RosterStore | undefined>(store);

  useEffect(() => {
    let cancelled = false;
    const ready = initialStoreRef.current ? Promise.resolve(initialStoreRef.current) : createRosterStore();
    ready
      .then((s) => { storeRef.current = s; return s.load(); })
      .then((d) => { if (!cancelled) { setDoc(d); setError(null); } })
      .catch((e) => { if (!cancelled) { setError(String(e)); setDoc(null); } });
    return () => { cancelled = true; };
  }, []);

  async function commit(updater: (d: RosterDoc) => RosterDoc) {
    if (!doc || !storeRef.current) return;
    const next = updater(doc);
    await storeRef.current.save(next); // throws on failure → caller keeps the user's input
    setDoc(next);
  }

  return { doc, error, commit };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/useRoster.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/useRoster.ts web/src/useRoster.test.ts
git commit -m "feat(web): useRoster holds a RosterDoc (save-then-commit, no snapshot refresh)"
```

---

### Task 11: Reshape the form → engineer + correction editor (`PersonForm.tsx`)

**Files:** Modify `web/src/components/PersonForm.tsx`; Modify `web/src/components/PersonForm.test.tsx`

- [ ] **Step 1: Replace the test**

```tsx
// web/src/components/PersonForm.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PersonForm } from "./PersonForm";
import type { Engineer, WorkState } from "../types";

const eng: Engineer = { id: "e1", name: "Maya R.", role: "EM", team: "Platform", linearUserId: "lin_1", email: "maya@x.com" };
const work: WorkState = { cat: "incident", conf: "high", what: "DB pool", ticket: "INC-1", since: null, detail: { tickets: ["INC-1"], note: "sev2" } };

describe("PersonForm (engineer + correction)", () => {
  it("submits engineer config from the Add form (no correction section)", async () => {
    const onSave = vi.fn(async () => {});
    render(<PersonForm teams={["Platform"]} onSave={onSave} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText("Name"), "Priya N.");
    await userEvent.type(screen.getByLabelText("Team"), "Platform");
    await userEvent.type(screen.getByLabelText("Linear user id"), "lin_2");
    expect(screen.queryByLabelText("Category override")).toBeNull(); // no correction on add
    await userEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    const [input, correction] = onSave.mock.calls[0];
    expect(input).toMatchObject({ name: "Priya N.", team: "Platform", linearUserId: "lin_2" });
    expect(correction).toEqual({});
  });

  it("requires a name and a team", async () => {
    const onSave = vi.fn(async () => {});
    render(<PersonForm teams={[]} onSave={onSave} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("edit mode prefills engineer fields, shows read-only current work, and submits a correction", async () => {
    const onSave = vi.fn(async () => {});
    render(<PersonForm initial={{ engineer: eng, work }} teams={["Platform"]} onSave={onSave} onCancel={() => {}} onDelete={async () => {}} />);
    expect(screen.getByLabelText("Name")).toHaveValue("Maya R.");
    expect(screen.getByLabelText("Linear user id")).toHaveValue("lin_1");
    expect(screen.getByText(/DB pool/)).toBeInTheDocument(); // read-only current work
    await userEvent.selectOptions(screen.getByLabelText("Category override"), "unplanned");
    await userEvent.type(screen.getByLabelText("Correction note"), "pulled into triage");
    await userEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    const [, correction] = onSave.mock.calls[0];
    expect(correction).toEqual({ cat: "unplanned", note: "pulled into triage" });
  });

  it("two-click delete then calls onDelete", async () => {
    const onDelete = vi.fn(async () => {});
    render(<PersonForm initial={{ engineer: eng }} teams={["Platform"]} onSave={async () => {}} onCancel={() => {}} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole("button", { name: /^Delete$/ }));
    expect(onDelete).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /Confirm delete/ }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components/PersonForm.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Reimplement `PersonForm.tsx`**

```tsx
// web/src/components/PersonForm.tsx
import { useId, useState, type FormEvent } from "react";
import type { Category, Correction, Engineer, WorkState } from "../types";
import type { EngineerInput } from "../roster/mutations";
import { CAT_ORDER, CATEGORIES } from "../categories";

const fieldClass = "font-mono text-[13px] text-ink px-[12px] py-[9px] rounded-[8px] border border-line-2 bg-transparent";
const labelClass = "flex flex-col gap-[6px] font-mono text-[12px] text-ink-2";

export interface PersonFormInitial { engineer: Engineer; correction?: Correction; work?: WorkState; }

export function PersonForm({
  initial, teams, onSave, onCancel, onDelete,
}: {
  initial?: PersonFormInitial;
  teams: string[];
  onSave: (input: EngineerInput, correction: Correction) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}) {
  const listId = useId();
  const e = initial?.engineer;
  const [name, setName] = useState(e?.name ?? "");
  const [role, setRole] = useState(e?.role ?? "");
  const [team, setTeam] = useState(e?.team ?? "");
  const [linearUserId, setLinearUserId] = useState(e?.linearUserId ?? "");
  const [email, setEmail] = useState(e?.email ?? "");
  const [catOverride, setCatOverride] = useState<string>(initial?.correction?.cat ?? "");
  const [note, setNote] = useState(initial?.correction?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!name.trim() || !team.trim()) { setError("Name and team are required."); return; }
    const input: EngineerInput = {
      name: name.trim(), role: role.trim(), team: team.trim(),
      linearUserId: linearUserId.trim() || null,
      email: email.trim() || null,
    };
    const correction: Correction = {};
    if (catOverride) correction.cat = catOverride as Category;
    if (note.trim()) correction.note = note.trim();
    setError(null);
    setBusy(true);
    try {
      await onSave(input, correction);
      // success: parent navigates away (this form unmounts)
    } catch {
      setError("Couldn't save. Check your connection and try again.");
      setBusy(false);
    }
  }

  async function onDeleteClick() {
    if (!onDelete) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setBusy(true);
    try { await onDelete(); }
    catch { setError("Couldn't delete. Check your connection and try again."); setBusy(false); setConfirmDelete(false); }
  }

  return (
    <main className="p-[38px_48px_44px] max-w-[640px]">
      <h1 className="font-serif font-normal text-[24px] leading-none tracking-[-0.02em] text-ink m-0">
        {initial ? "Edit engineer" : "Add engineer"}
      </h1>
      <form onSubmit={onSubmit} className="mt-[24px] flex flex-col gap-[16px]">
        <label className={labelClass}>
          Name
          <input className={fieldClass} style={{ outlineColor: "var(--focus)" }} value={name} onChange={(ev) => setName(ev.target.value)} aria-required="true" />
        </label>
        <label className={labelClass}>
          Role
          <input className={fieldClass} style={{ outlineColor: "var(--focus)" }} value={role} onChange={(ev) => setRole(ev.target.value)} />
        </label>
        <label className={labelClass}>
          Team
          <input className={fieldClass} style={{ outlineColor: "var(--focus)" }} value={team} onChange={(ev) => setTeam(ev.target.value)} list={listId} aria-required="true" />
          <datalist id={listId}>{teams.map((t) => <option key={t} value={t} />)}</datalist>
        </label>
        <label className={labelClass}>
          Linear user id
          <input className={fieldClass} style={{ outlineColor: "var(--focus)" }} value={linearUserId} onChange={(ev) => setLinearUserId(ev.target.value)} />
        </label>
        <label className={labelClass}>
          Email
          <input className={fieldClass} style={{ outlineColor: "var(--focus)" }} value={email} onChange={(ev) => setEmail(ev.target.value)} />
        </label>

        {initial && (
          <>
            <div className="mt-[6px] rounded-sm px-[14px] py-[11px] bg-oat">
              <div className="font-sans font-semibold text-[10px] leading-none tracking-[0.13em] uppercase text-muted mb-[6px]">Current work (pulled, read-only)</div>
              <div className="font-mono text-[12px] text-ink-2">
                {initial.work ? `${CATEGORIES[initial.work.cat].label} · ${initial.work.what || "—"}` : "no tracked activity yet"}
              </div>
            </div>
            <label className={labelClass}>
              Category override
              <select className={fieldClass} style={{ outlineColor: "var(--focus)" }} value={catOverride} onChange={(ev) => setCatOverride(ev.target.value)}>
                <option value="">— none —</option>
                {CAT_ORDER.map((k) => <option key={k} value={k}>{CATEGORIES[k].label}</option>)}
              </select>
            </label>
            <label className={labelClass}>
              Correction note
              <textarea className={fieldClass} style={{ outlineColor: "var(--focus)" }} rows={3} value={note} onChange={(ev) => setNote(ev.target.value)} />
            </label>
          </>
        )}

        {error && <p role="alert" className="font-mono text-[12px] m-0" style={{ color: "var(--rust-deep)" }}>{error}</p>}

        <div className="flex items-center gap-[12px] mt-[6px]">
          <button type="submit" disabled={busy}
            className="tsd-focus font-sans font-semibold text-[13px] px-[16px] py-[10px] rounded-[8px] border-0 cursor-pointer disabled:opacity-60"
            style={{ background: "var(--matcha)", color: "var(--paper)", outlineColor: "var(--focus)" }}>
            {busy ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={onCancel}
            className="tsd-focus font-mono text-[12px] text-muted hover:text-ink-2 bg-transparent border-0 cursor-pointer p-0"
            style={{ outlineColor: "var(--focus)" }}>
            Cancel
          </button>
          {onDelete && (
            <button type="button" onClick={onDeleteClick} disabled={busy}
              className="tsd-focus font-mono text-[12px] ml-auto bg-transparent border-0 cursor-pointer p-0 disabled:opacity-60"
              style={{ color: "var(--rust-deep)", outlineColor: "var(--focus)" }}>
              {confirmDelete ? "Confirm delete" : "Delete"}
            </button>
          )}
        </div>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Run to verify pass + guardrail**

Run: `npx vitest run src/components/PersonForm.test.tsx && npm run guardrail`
Expected: PASS; `OK — no raw design values`.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/PersonForm.tsx web/src/components/PersonForm.test.tsx
git commit -m "feat(web): reshape form to engineer config + correction editor (work read-only)"
```

---

### Task 12: Display components — no-activity + synced stamp

**Files:** Modify `web/src/components/WorkingOn.tsx`, `web/src/components/PersonRow.tsx`, `web/src/components/Header.tsx`; Modify `web/src/components/header.test.tsx`, `web/src/components/summary.test.tsx`, `web/src/components/leaves.test.tsx`

- [ ] **Step 1: `WorkingOn` — show "no tracked activity" when `hasActivity === false`**

Add at the top of the `WorkingOn` component body (before the `low` check) in `web/src/components/WorkingOn.tsx`:

```tsx
  if (person.hasActivity === false) {
    return <span className="font-mono text-[12px] text-muted italic">no tracked activity</span>;
  }
```

- [ ] **Step 2: `PersonRow` — replace the chip with a muted dash when no activity**

In `web/src/components/PersonRow.tsx`, change the CategoryChip cell:

```tsx
        <span>{person.hasActivity === false ? <span className="font-mono text-[12px] text-muted">—</span> : <CategoryChip cat={person.cat} />}</span>
```

- [ ] **Step 3: `Header` — synced stamp instead of snapshot/next-refresh**

Replace `web/src/components/Header.tsx` with:

```tsx
import type { Snapshot } from "../types";

export function Header({ snapshot, total, onSignOut }: { snapshot: Snapshot; total: number; onSignOut?: () => void }) {
  const synced = snapshot.day.trim();
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
          <span className="tsd-pulse w-[7px] h-[7px] rounded-full" style={{ background: "var(--matcha)" }} aria-hidden="true" />
          <span className="font-mono font-bold text-[12px] leading-none text-ink-2">
            {synced ? `Synced · ${synced}` : "Not yet synced"}
          </span>
        </span>
        {onSignOut && (
          <button type="button" onClick={onSignOut}
            className="font-mono text-[12px] leading-none text-muted hover:text-ink-2 underline underline-offset-2 border-0 bg-transparent cursor-pointer p-0"
            style={{ outlineColor: "var(--focus)" }}>
            Sign out
          </button>
        )}
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Update the affected tests**

`web/src/components/header.test.tsx` — its `snapshot` const has `day: "Tuesday, June 3, 2026"`, so the header now shows "Synced · Tuesday, June 3, 2026". The two sign-out tests are unaffected. No change needed unless a test asserts old "Snapshot ·" text (it does not).

`web/src/components/summary.test.tsx` — the "header shows the snapshot freshness" test asserts `/Snapshot ·/` and `/next refresh/`. Replace that test body with:

```tsx
  it("header shows the synced freshness", () => {
    render(<Header snapshot={(roster as RosterData).snapshot} total={d.total} />);
    expect(screen.getByText(/Synced ·/)).toBeInTheDocument();
  });
```

`web/src/components/leaves.test.tsx` — add a no-activity case after the existing WorkingOn tests:

```tsx
  it("WorkingOn shows 'no tracked activity' when hasActivity is false", () => {
    render(<WorkingOn person={{ ...base, hasActivity: false }} />);
    expect(screen.getByText(/no tracked activity/)).toBeInTheDocument();
  });
```

- [ ] **Step 5: Run the affected tests**

Run: `npx vitest run src/components/leaves.test.tsx src/components/header.test.tsx src/components/summary.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/WorkingOn.tsx web/src/components/PersonRow.tsx web/src/components/Header.tsx web/src/components/header.test.tsx web/src/components/summary.test.tsx web/src/components/leaves.test.tsx
git commit -m "feat(web): no-activity row treatment + synced freshness stamp"
```

---

### Task 13: Wire `App` to `RosterDoc` + merge + engineer/correction editing

**Files:** Modify `web/src/App.tsx`; Modify `web/src/App.test.tsx`

- [ ] **Step 1: Replace the editable describe block in `App.test.tsx`**

Replace the existing `describe("App editing (editable build)", …)` block (keep the earlier load/empty/error/sign-out tests, but their `storeOf` now returns a `RosterDoc`). Update the top helpers first:

```tsx
// at the top of App.test.tsx, replace the RosterData-based helpers:
import type { RosterDoc } from "./types";
import type { RosterStore } from "./storage/RosterStore";

const demoDoc: RosterDoc = {
  engineers: [{ id: "e1", name: "Maya R.", role: "EM", team: "Platform", linearUserId: null, email: null }],
  corrections: {},
  work: { syncedAt: "Tue 9:02 AM", states: { e1: { cat: "planned", conf: "high", what: "Failover", ticket: "PLAT-412", since: null, detail: { tickets: [], note: "n" } } } },
};
function storeOf(doc: RosterDoc): RosterStore { return { load: async () => doc, save: async () => {} }; }
function failingStore(message: string): RosterStore { return { load: async () => { throw new Error(message); }, save: async () => {} }; }
```

Update the three earlier tests to use `demoDoc`:
- "loads from the store and renders the dashboard": `render(<App store={storeOf(demoDoc)} />)`; still asserts "Team status" + "Maya R.".
- "renders an honest empty state…": `storeOf({ engineers: [], corrections: {}, work: { syncedAt: null, states: {} } })`; assert `/No one on the roster yet/i` + Header.
- "shows the error message when the store load fails": unchanged (uses `failingStore`).

Then replace the editable block:

```tsx
describe("App editing (editable build)", () => {
  function editableStore() {
    let current: RosterDoc = { engineers: [], corrections: {}, work: { syncedAt: null, states: {} } };
    return { store: { load: async () => current, save: async (d: RosterDoc) => { current = d; } } as RosterStore };
  }

  it("empty → add your first engineer → the engineer appears as no tracked activity", async () => {
    const { store } = editableStore();
    render(<App store={store} editable />);
    await screen.findByText(/No one on the roster yet/i);
    await userEvent.click(screen.getByRole("button", { name: /Add your first engineer/i }));
    await userEvent.type(screen.getByLabelText("Name"), "Maya R.");
    await userEvent.type(screen.getByLabelText("Team"), "Platform");
    await userEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    expect(await screen.findByText("Maya R.")).toBeInTheDocument();
    expect(screen.getByText("Platform")).toBeInTheDocument();
    expect(screen.getAllByText(/no tracked activity/).length).toBeGreaterThan(0);
  });

  it("'Correct my row' opens the editor prefilled", async () => {
    render(<App store={storeOf(demoDoc)} editable />);
    await userEvent.click(await screen.findByRole("button", { name: /Maya R\./ }));
    await userEvent.click(screen.getByRole("button", { name: /Correct Maya's row/ }));
    expect(screen.getByLabelText("Name")).toHaveValue("Maya R.");
    expect(screen.getByLabelText("Category override")).toBeInTheDocument();
  });

  it("the demo (not editable) shows no Add button", async () => {
    render(<App store={storeOf(demoDoc)} />);
    await screen.findByText("Maya R.");
    expect(screen.queryByRole("button", { name: /Add/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Rewrite `App.tsx`**

```tsx
// web/src/App.tsx
import { useState } from "react";
import { derive } from "./roster";
import { mergeRoster } from "./roster/merge";
import type { RosterStore } from "./storage/RosterStore";
import { useRoster } from "./useRoster";
import { addEngineer, updateEngineer, removeEngineer, setCorrection, clearCorrection } from "./roster/mutations";
import type { EngineerInput } from "./roster/mutations";
import type { Correction } from "./types";
import { RosterActionsContext } from "./rosterActions";
import { Header } from "./components/Header";
import { SummaryStrip } from "./components/SummaryStrip";
import { RosterTable } from "./components/RosterTable";
import { PersonForm } from "./components/PersonForm";

type View = { mode: "list" } | { mode: "add" } | { mode: "edit"; id: string };

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="tsd-focus font-sans font-semibold text-[12px] px-[14px] py-[8px] rounded-[8px] border-0 cursor-pointer"
      style={{ background: "var(--matcha)", color: "var(--paper)", outlineColor: "var(--focus)" }}>
      {label}
    </button>
  );
}

function hasSignal(c: Correction): boolean {
  return c.cat !== undefined || (c.note ?? "") !== "";
}

export default function App({ store, onSignOut, editable = false }: { store?: RosterStore; onSignOut?: () => void; editable?: boolean }) {
  const { doc, error, commit } = useRoster(store);
  const [view, setView] = useState<View>({ mode: "list" });
  const toList = () => setView({ mode: "list" });

  if (error) {
    return (
      <div className="p-[38px_48px_44px] font-mono text-[13px]" style={{ color: "var(--rust-deep)" }}>
        Could not load the roster: {error}
      </div>
    );
  }
  if (!doc) {
    return <div className="p-[38px_48px_44px] font-mono text-[12px] text-muted">Loading…</div>;
  }

  const display = mergeRoster(doc);
  const d = derive(display);
  const teamNames = [...new Set(doc.engineers.map((e) => e.team))];

  if (editable && view.mode === "add") {
    return (
      <PersonForm teams={teamNames} onCancel={toList}
        onSave={(input: EngineerInput) => commit((dd) => addEngineer(dd, input)).then(toList)} />
    );
  }

  const editingEng = editable && view.mode === "edit" ? doc.engineers.find((e) => e.id === view.id) : undefined;
  if (editingEng) {
    const id = editingEng.id;
    return (
      <PersonForm
        initial={{ engineer: editingEng, correction: doc.corrections[id], work: doc.work.states[id] }}
        teams={teamNames} onCancel={toList}
        onSave={(input, correction) => commit((dd) => {
          const updated = updateEngineer(dd, id, input);
          return hasSignal(correction) ? setCorrection(updated, id, correction) : clearCorrection(updated, id);
        }).then(toList)}
        onDelete={() => commit((dd) => removeEngineer(dd, id)).then(toList)}
      />
    );
  }

  const actions = editable ? { onEditPerson: (id: string) => setView({ mode: "edit", id }) } : {};
  return (
    <RosterActionsContext.Provider value={actions}>
      <main className="p-[38px_48px_44px]">
        <Header snapshot={display.snapshot} total={d.total} onSignOut={onSignOut} />
        {d.total === 0 ? (
          <div className="mt-[26px] flex flex-col items-start gap-[14px]">
            <p className="font-mono text-[12px] text-muted">No one on the roster yet.</p>
            {editable && <AddButton label="Add your first engineer" onClick={() => setView({ mode: "add" })} />}
          </div>
        ) : (
          <>
            {editable && (
              <div className="mt-[18px]">
                <AddButton label="Add engineer" onClick={() => setView({ mode: "add" })} />
              </div>
            )}
            <SummaryStrip d={d} />
            <RosterTable d={d} />
          </>
        )}
      </main>
    </RosterActionsContext.Provider>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/App.tsx web/src/App.test.tsx
git commit -m "feat(web): App merges RosterDoc + engineer/correction editing wiring"
```

---

### Task 14: Convert the demo fixture + schema; full green gate

**Files:** Modify `web/public/roster.json`; Modify `web/supabase/schema.sql`

- [ ] **Step 1: Convert `roster.json` (legacy teams[] → RosterDoc) via a script**

Run from `web/`:

```bash
node -e "
const fs=require('fs');
const r=require('./public/roster.json');
const engineers=[]; const states={};
for(const t of r.teams){for(const p of t.people){
  engineers.push({id:p.id,name:p.name,role:p.role,team:t.name,linearUserId:null,email:null});
  states[p.id]={cat:p.cat,conf:p.conf,what:p.what,ticket:p.ticket,since:p.since,detail:p.detail};
}}
const syncedAt=(r.snapshot.day||'')+(r.snapshot.time?' · '+r.snapshot.time:'');
const doc={engineers,corrections:{},work:{syncedAt,states}};
fs.writeFileSync('./public/roster.json',JSON.stringify(doc,null,2)+'\n');
console.log('engineers:',engineers.length);
"
```

Verify: `node -e "const r=require('./public/roster.json'); console.log(Array.isArray(r.engineers), Object.keys(r.work.states).length, r.work.syncedAt)"` prints `true <count> <a date string>`.

- [ ] **Step 2: Add the `work` column to the schema**

In `web/supabase/schema.sql`, add `work` to the table and a note for existing projects:

```sql
create table if not exists app_data (
  owner uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  work jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
```

And append at the end of the file:

```sql
-- Existing projects created before Phase 3b: add the pipeline-owned column.
-- alter table app_data add column if not exists work jsonb not null default '{}'::jsonb;
```

- [ ] **Step 3: Full green gate**

Run: `npm test && npm run typecheck && npm run lint && npm run guardrail`
Expected: all PASS. (This is the first point `tsc -b` should pass — fix any straggling type errors from the reshape here, e.g. a file still importing the removed `emptyRoster`/`todaySnapshot` or the old `PersonInput`/`addPerson`.)

- [ ] **Step 4: Demo build excludes the SDK; supabase variant compiles**

Run: `VITE_BACKEND=local npm run build && ! grep -riq "supabase" dist/assets`
Expected: build succeeds, `grep` finds nothing.
Run: `VITE_BACKEND=supabase VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=test npm run build`
Expected: build succeeds. Then `VITE_BACKEND=local npm run build >/dev/null 2>&1` to restore.

- [ ] **Step 5: Commit**

```bash
git add web/public/roster.json web/supabase/schema.sql
git commit -m "chore(web): convert demo fixture to RosterDoc; add pipeline-owned work column"
```

---

## Self-Review

**Spec coverage:**
- Three-layer types (`Engineer`/`Correction`/`WorkState`/`RosterDoc`) + `hasActivity` → Task 1. ✔
- Engineer + correction mutations (flat engineers, teams at merge) → Task 2. ✔
- `mergeRoster` (overlay work + corrections, `hasActivity`, team grouping, syncedAt) → Task 3. ✔
- `derive` excludes no-activity from tallies → Task 4. ✔
- `sanitizeDoc` + `emptyDoc` + legacy migration (no throw, no data loss) → Task 5. ✔
- Seam reshape (RosterDoc; read both columns, write human only) → Tasks 6–8. ✔
- Local store loads RosterDoc fixture → Task 9. ✔
- `useRoster` over RosterDoc → Task 10. ✔
- Engineer + correction form; work read-only; two-click delete; required name → Task 11. ✔
- No-activity row treatment + synced stamp → Task 12. ✔
- App merge + editable engineer/correction wiring; demo read-only → Task 13. ✔
- Demo fixture → RosterDoc; `work` column + ALTER note → Task 14. ✔
- No-clobber (app writes only `data`) → Tasks 7/8. ✔
- Demo bundle still SDK-free + full gate → Task 14. ✔
- Live end-to-end check → after merge (human runs the `ALTER`, then add engineer → correction → reload).

**Placeholder scan:** none; every code step shows full code. The intermediate-typecheck caveat is stated up top and enforced via targeted `vitest` per task + full `tsc` in Task 14.

**Type consistency:** `RosterDoc`/`Engineer`/`Correction`/`WorkState`/`WorkSnapshot`, `EngineerInput`, `addEngineer`/`updateEngineer`/`removeEngineer`/`setCorrection`/`clearCorrection`/`buildEngineer`/`deriveInitials`, `mergeRoster`, `sanitizeDoc`/`emptyDoc`, `RosterStore.load(): RosterDoc`/`save(doc)`, `RowStore.getRow(): {data,work}|null`/`putHuman`, `HumanDoc`, `AppDataClient.getRow`/`putHuman`, `useRoster → {doc,error,commit}`, `PersonFormInitial`/`PersonForm` props, `Header({snapshot,total,onSignOut})`, `App({store?,onSignOut?,editable?})` are used identically across tasks. The removed `emptyRoster`/`todaySnapshot`/`PersonInput`/`addPerson`/`updatePerson`/`removePerson`/`buildPerson` are surfaced for cleanup in Task 14 Step 3.
```
