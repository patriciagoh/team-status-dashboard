# Command View Phase 3 — CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the empty real app usable — add/edit/delete people (teams managed implicitly), wiring the "Correct my row" affordance, with stable ids and live dates.

**Architecture:** Pure mutation reducers + a `useRoster` hook that owns load and save-then-commit persistence + one shared full-page `PersonForm` + a `view` state in `App`. Editing is gated to the authenticated real build via an `editable` prop; the demo stays read-only. A small context delivers the edit action to the deep `ExpandedPanel` button without prop-drilling.

**Tech Stack:** React 19, TypeScript, Vite, Vitest (jsdom, globals), `@testing-library/react` (+ `renderHook`) + `user-event`.

**Working directory for all commands:** `web/` (run `cd web` first).

**Spec:** `docs/superpowers/specs/2026-06-04-command-view-phase-3-crud-design.md`

---

### Task 1: Add stable `Person.id` + sanitizer backfill + fix fixtures/helpers

`Person` gains a required `id`. The load-boundary sanitizer backfills it; the demo fixture gets stable ids; existing `Person` literals in tests get an id.

**Files:**
- Modify: `web/src/types.ts`
- Modify: `web/src/storage/sanitize.ts`
- Modify: `web/public/roster.json` (add ids via a script)
- Modify: `web/src/storage/sanitize.test.ts`, `web/src/roster.test.ts`, `web/src/components/leaves.test.tsx`, `web/src/components/summary.test.tsx`

- [ ] **Step 1: Add `id` to the `Person` type**

In `web/src/types.ts`, add `id` as the first field of `Person`:

```ts
export interface Person {
  id: string;
  name: string;
  initials: string;
  role: string;
  team: string;
  cat: Category;
  conf: Confidence;
  what: string;
  ticket: string | null;
  since: string | null;
  detail: PersonDetail;
}
```

- [ ] **Step 2: Backfill `id` in the sanitizer (failing test first)**

Add to `web/src/storage/sanitize.test.ts` inside the `describe("sanitizeRoster", …)` block:

```ts
  it("preserves a person id when present and generates one when missing", () => {
    const withId = sanitizeRoster({
      teams: [{ name: "T", lead: "L", people: [{ id: "keep-me", name: "A", cat: "planned" }] }],
      snapshot: {},
    });
    expect(withId.teams[0].people[0].id).toBe("keep-me");

    const withoutId = sanitizeRoster({
      teams: [{ name: "T", lead: "L", people: [{ name: "A", cat: "planned" }] }],
      snapshot: {},
    });
    expect(withoutId.teams[0].people[0].id).toMatch(/.+/); // a generated id
  });
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/storage/sanitize.test.ts`
Expected: FAIL — `id` is `undefined`.

- [ ] **Step 4: Implement the backfill in `sanitize.ts`**

In `web/src/storage/sanitize.ts`, inside `sanitizePerson`, add `id` as the first returned field:

```ts
  return {
    id: typeof r.id === "string" && r.id ? r.id : crypto.randomUUID(),
    name: str(r.name),
```

(leave the rest of `sanitizePerson` unchanged).

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run src/storage/sanitize.test.ts`
Expected: PASS.

- [ ] **Step 6: Add stable ids to the demo fixture**

Run this from `web/` to give every demo person a stable id (`p01`, `p02`, … in file order):

```bash
node -e "const fs=require('fs');const p=require('./public/roster.json');let n=0;for(const t of p.teams)for(const person of t.people){if(!person.id)person.id='p'+String(++n).padStart(2,'0');}fs.writeFileSync('./public/roster.json',JSON.stringify(p,null,2)+'\n')"
```

Verify: `grep -c '"id"' public/roster.json` prints the number of people (should be > 0 and equal to the person count).

- [ ] **Step 7: Add an `id` to the `Person` literals in the existing tests**

These three files build `Person` objects and now need an `id` to typecheck:

`web/src/components/leaves.test.tsx` — change the `base` const's first field to include an id:

```ts
const base: Person = {
  id: "t1", name: "Tomas B.", initials: "TB", role: "Sr. Eng", team: "Platform",
```

`web/src/roster.test.ts` — the `person()` helper. Add an `id` (unique per call via a counter):

```ts
let _n = 0;
function person(cat: Person["cat"], since: string | null = null): Person {
  return {
    id: `t${++_n}`,
    name: "A", initials: "A", role: "Eng", team: "T", cat, conf: "high",
    what: "", ticket: null, since, detail: { tickets: [], note: "" },
  };
}
```

(Keep the rest of the helper body as it is — only add the `id` field; match the existing field set.)

`web/src/components/summary.test.tsx` — the `person()` helper. Add `id: "s1"` (these aren't keyed by id, a constant is fine):

```ts
function person(cat: Person["cat"]): Person {
  return {
    id: "s1", name: "X", initials: "X", role: "Eng", team: "T", cat, conf: "high",
    what: "", ticket: null, since: null, detail: { tickets: [], note: "" },
  };
}
```

- [ ] **Step 8: Run the full suite + typecheck**

Run: `npm test && npm run typecheck`
Expected: all PASS (existing tests still green; `id` present everywhere).

- [ ] **Step 9: Commit**

```bash
git add web/src/types.ts web/src/storage/sanitize.ts web/src/storage/sanitize.test.ts web/public/roster.json web/src/roster.test.ts web/src/components/leaves.test.tsx web/src/components/summary.test.tsx
git commit -m "feat(web): add stable Person.id (sanitizer backfill + fixture + test fixups)"
```

---

### Task 2: Pure mutations (`mutations.ts`)

Pure add/update/remove + `buildPerson`/`deriveInitials`. No `Date`/IO.

**Files:**
- Create: `web/src/roster/mutations.ts`
- Test: `web/src/roster/mutations.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// web/src/roster/mutations.test.ts
import { describe, it, expect } from "vitest";
import { addPerson, updatePerson, removePerson, deriveInitials, type PersonInput } from "./mutations";
import type { RosterData } from "../types";

const empty: RosterData = { teams: [], snapshot: { day: "", time: "", prev: "", next: "", slackConnected: false } };

function input(over: Partial<PersonInput> = {}): PersonInput {
  return {
    name: "Maya R.", role: "EM", team: "Platform", cat: "planned", conf: "high",
    what: "Failover runbook", ticket: "PLAT-412", since: null,
    detail: { tickets: ["PLAT-412"], note: "Cycle commitment." }, ...over,
  };
}

describe("deriveInitials", () => {
  it("takes the first letter of up to two words, uppercased", () => {
    expect(deriveInitials("Maya R.")).toBe("MR");
    expect(deriveInitials("devin o.")).toBe("DO");
    expect(deriveInitials("Alex")).toBe("A");
  });
});

describe("addPerson", () => {
  it("creates a new team when the team does not exist", () => {
    const r = addPerson(empty, input());
    expect(r.teams).toHaveLength(1);
    expect(r.teams[0].name).toBe("Platform");
    expect(r.teams[0].people[0].name).toBe("Maya R.");
    expect(r.teams[0].people[0].id).toMatch(/.+/);
    expect(r.teams[0].people[0].initials).toBe("MR");
  });

  it("appends to an existing team", () => {
    const r = addPerson(addPerson(empty, input()), input({ name: "Priya N." }));
    expect(r.teams).toHaveLength(1);
    expect(r.teams[0].people.map((p) => p.name)).toEqual(["Maya R.", "Priya N."]);
  });

  it("assigns unique ids", () => {
    const r = addPerson(addPerson(empty, input()), input({ name: "Priya N." }));
    const [a, b] = r.teams[0].people;
    expect(a.id).not.toBe(b.id);
  });

  it("does not mutate the input roster", () => {
    addPerson(empty, input());
    expect(empty.teams).toHaveLength(0);
  });
});

describe("updatePerson", () => {
  it("updates fields in place and re-derives initials, preserving id and order", () => {
    const r1 = addPerson(addPerson(empty, input()), input({ name: "Priya N." }));
    const id = r1.teams[0].people[0].id;
    const r2 = updatePerson(r1, id, input({ name: "Maya Rao", what: "Drills" }));
    const people = r2.teams[0].people;
    expect(people[0].id).toBe(id);            // same id
    expect(people[0].name).toBe("Maya Rao");
    expect(people[0].initials).toBe("MR");
    expect(people[0].what).toBe("Drills");
    expect(people.map((p) => p.name)).toEqual(["Maya Rao", "Priya N."]); // order preserved
  });

  it("moves a person to a new team and prunes the emptied source team", () => {
    const r1 = addPerson(empty, input());          // Maya in Platform (only member)
    const id = r1.teams[0].people[0].id;
    const r2 = updatePerson(r1, id, input({ team: "Payments" }));
    expect(r2.teams.map((t) => t.name)).toEqual(["Payments"]); // Platform pruned
    expect(r2.teams[0].people[0].id).toBe(id);
  });

  it("returns the roster unchanged when the id is unknown", () => {
    const r1 = addPerson(empty, input());
    expect(updatePerson(r1, "nope", input())).toBe(r1);
  });
});

describe("removePerson", () => {
  it("removes the person and prunes an emptied team", () => {
    const r1 = addPerson(empty, input());
    const id = r1.teams[0].people[0].id;
    expect(removePerson(r1, id).teams).toEqual([]);
  });

  it("keeps the team when other members remain", () => {
    const r1 = addPerson(addPerson(empty, input()), input({ name: "Priya N." }));
    const id = r1.teams[0].people[0].id;
    const r2 = removePerson(r1, id);
    expect(r2.teams[0].people.map((p) => p.name)).toEqual(["Priya N."]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/roster/mutations.test.ts`
Expected: FAIL — cannot find module `./mutations`.

- [ ] **Step 3: Implement `mutations.ts`**

```ts
// web/src/roster/mutations.ts
import type { Category, Confidence, Person, PersonDetail, RosterData, Team } from "../types";

export interface PersonInput {
  name: string;
  role: string;
  team: string;
  cat: Category;
  conf: Confidence;
  what: string;
  ticket: string | null;
  since: string | null;
  detail: PersonDetail;
}

export function deriveInitials(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

export function buildPerson(input: PersonInput): Person {
  return { id: crypto.randomUUID(), initials: deriveInitials(input.name), ...input };
}

function addToTeam(teams: Team[], person: Person, teamName: string): Team[] {
  return teams.some((t) => t.name === teamName)
    ? teams.map((t) => (t.name === teamName ? { ...t, people: [...t.people, person] } : t))
    : [...teams, { name: teamName, lead: "", people: [person] }];
}

export function addPerson(roster: RosterData, input: PersonInput): RosterData {
  return { ...roster, teams: addToTeam(roster.teams, buildPerson(input), input.team) };
}

export function updatePerson(roster: RosterData, id: string, input: PersonInput): RosterData {
  const currentTeam = roster.teams.find((t) => t.people.some((p) => p.id === id));
  if (!currentTeam) return roster;
  const rebuilt: Person = { id, initials: deriveInitials(input.name), ...input };

  if (currentTeam.name === input.team) {
    return {
      ...roster,
      teams: roster.teams.map((t) =>
        t.name === input.team ? { ...t, people: t.people.map((p) => (p.id === id ? rebuilt : p)) } : t),
    };
  }

  const without = roster.teams
    .map((t) => (t.name === currentTeam.name ? { ...t, people: t.people.filter((p) => p.id !== id) } : t))
    .filter((t) => t.people.length > 0);
  return { ...roster, teams: addToTeam(without, rebuilt, input.team) };
}

export function removePerson(roster: RosterData, id: string): RosterData {
  return {
    ...roster,
    teams: roster.teams
      .map((t) => ({ ...t, people: t.people.filter((p) => p.id !== id) }))
      .filter((t) => t.people.length > 0),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/roster/mutations.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/roster/mutations.ts web/src/roster/mutations.test.ts
git commit -m "feat(web): pure roster mutations (add/update/remove person, implicit teams)"
```

---

### Task 3: Persistence hook (`useRoster.ts`)

Owns load + save-then-commit. Tested with `renderHook` and a fake store.

**Files:**
- Create: `web/src/useRoster.ts`
- Test: `web/src/useRoster.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// web/src/useRoster.test.ts
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useRoster } from "./useRoster";
import type { RosterStore } from "./storage/RosterStore";
import type { RosterData } from "./types";

const base: RosterData = { teams: [], snapshot: { day: "old", time: "old", prev: "", next: "", slackConnected: false } };

function fakeStore(over: Partial<RosterStore> = {}): RosterStore {
  return { load: async () => base, save: vi.fn(async () => {}), ...over };
}

describe("useRoster", () => {
  it("loads the roster from the store", async () => {
    const { result } = renderHook(() => useRoster(fakeStore()));
    await waitFor(() => expect(result.current.roster).not.toBeNull());
    expect(result.current.roster!.teams).toEqual([]);
  });

  it("commit saves first, then updates state and refreshes the snapshot", async () => {
    const save = vi.fn(async () => {});
    const { result } = renderHook(() => useRoster(fakeStore({ save })));
    await waitFor(() => expect(result.current.roster).not.toBeNull());

    await act(async () => {
      await result.current.commit((r) => ({ ...r, teams: [{ name: "T", lead: "", people: [] }] }));
    });

    expect(save).toHaveBeenCalledTimes(1);
    const saved = save.mock.calls[0][0] as RosterData;
    expect(saved.teams).toHaveLength(1);
    expect(saved.snapshot.day).not.toBe("old"); // snapshot refreshed to "now"
    expect(result.current.roster!.teams).toHaveLength(1);
  });

  it("leaves state unchanged and rejects when save fails", async () => {
    const save = vi.fn(async () => { throw new Error("offline"); });
    const { result } = renderHook(() => useRoster(fakeStore({ save })));
    await waitFor(() => expect(result.current.roster).not.toBeNull());

    await act(async () => {
      await expect(
        result.current.commit((r) => ({ ...r, teams: [{ name: "T", lead: "", people: [] }] })),
      ).rejects.toThrow("offline");
    });

    expect(result.current.roster!.teams).toEqual([]); // unchanged
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/useRoster.test.ts`
Expected: FAIL — cannot find module `./useRoster`.

- [ ] **Step 3: Implement `useRoster.ts`**

```ts
// web/src/useRoster.ts
import { useEffect, useRef, useState } from "react";
import type { RosterData } from "./types";
import type { RosterStore } from "./storage/RosterStore";
import { createRosterStore } from "./storage/createRosterStore";
import { todaySnapshot } from "./storage/sanitize";

export function useRoster(store?: RosterStore) {
  const [roster, setRoster] = useState<RosterData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const storeRef = useRef<RosterStore | null>(store ?? null);

  useEffect(() => {
    let cancelled = false;
    const ready = store ? Promise.resolve(store) : createRosterStore();
    ready
      .then((s) => { storeRef.current = s; return s.load(); })
      .then((d) => { if (!cancelled) { setRoster(d); setError(null); } })
      .catch((e) => { if (!cancelled) { setError(String(e)); setRoster(null); } });
    return () => { cancelled = true; };
  }, [store]);

  async function commit(updater: (r: RosterData) => RosterData) {
    if (!roster || !storeRef.current) return;
    const next: RosterData = { ...updater(roster), snapshot: todaySnapshot() };
    await storeRef.current.save(next); // throws on failure → caller keeps the user's input
    setRoster(next);
  }

  return { roster, error, commit };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/useRoster.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/useRoster.ts web/src/useRoster.test.ts
git commit -m "feat(web): useRoster hook (load + save-then-commit persistence)"
```

---

### Task 4: Roster-actions context + wire "Correct my row"

A tiny context delivers the edit action to `ExpandedPanel` without prop-drilling.

**Files:**
- Create: `web/src/rosterActions.ts`
- Modify: `web/src/components/ExpandedPanel.tsx`
- Test: `web/src/components/expandedPanel.test.tsx`

- [ ] **Step 1: Create the context**

```ts
// web/src/rosterActions.ts
import { createContext, useContext } from "react";

export interface RosterActions {
  onEditPerson?: (id: string) => void;
}

export const RosterActionsContext = createContext<RosterActions>({});
export const useRosterActions = (): RosterActions => useContext(RosterActionsContext);
```

- [ ] **Step 2: Write the failing tests**

```tsx
// web/src/components/expandedPanel.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExpandedPanel } from "./ExpandedPanel";
import { RosterActionsContext } from "../rosterActions";
import type { Person } from "../types";

const person: Person = {
  id: "p1", name: "Maya R.", initials: "MR", role: "EM", team: "Platform",
  cat: "planned", conf: "high", what: "Failover", ticket: "PLAT-412", since: null,
  detail: { tickets: ["PLAT-412"], note: "Cycle commitment." },
};

describe("ExpandedPanel 'Correct my row'", () => {
  it("calls onEditPerson with the person id when the action is provided", async () => {
    const onEditPerson = vi.fn();
    render(
      <RosterActionsContext.Provider value={{ onEditPerson }}>
        <ExpandedPanel person={person} />
      </RosterActionsContext.Provider>,
    );
    await userEvent.click(screen.getByRole("button", { name: /Correct Maya's row/ }));
    expect(onEditPerson).toHaveBeenCalledWith("p1");
  });

  it("renders the button as display-only (no handler) when no action is provided", async () => {
    render(<ExpandedPanel person={person} />);
    const btn = screen.getByRole("button", { name: /Correct Maya's row/ });
    await userEvent.click(btn); // must not throw
    expect(btn).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/components/expandedPanel.test.tsx`
Expected: FAIL — the button has no `onClick`/`onEditPerson` wiring yet.

- [ ] **Step 4: Wire `ExpandedPanel` to the context**

In `web/src/components/ExpandedPanel.tsx`: import the hook and use it for the button's handler. Change the top import block and the button.

Add after the existing import:

```ts
import { useRosterActions } from "../rosterActions";
```

Inside the component body, add at the top:

```ts
  const { onEditPerson } = useRosterActions();
```

Replace the existing "Correct …'s row" button with:

```tsx
          <button
            type="button"
            onClick={onEditPerson ? () => onEditPerson(person.id) : undefined}
            className="tsd-focus mt-[14px] font-sans font-semibold text-[12px] leading-none text-matcha-deep bg-transparent border-none p-0 cursor-pointer inline-flex items-center gap-[5px]"
          >
            Correct {first}'s row
            <span aria-hidden="true">→</span>
          </button>
```

(Remove the old display-only comment.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/expandedPanel.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/rosterActions.ts web/src/components/ExpandedPanel.tsx web/src/components/expandedPanel.test.tsx
git commit -m "feat(web): RosterActions context; wire 'Correct my row' to onEditPerson"
```

---

### Task 5: Shared `PersonForm`

One full-page form for add + edit, with delete (two-click confirm).

**Files:**
- Create: `web/src/components/PersonForm.tsx`
- Test: `web/src/components/PersonForm.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// web/src/components/PersonForm.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PersonForm } from "./PersonForm";
import type { Person } from "../types";

const person: Person = {
  id: "p1", name: "Maya R.", initials: "MR", role: "EM", team: "Platform",
  cat: "planned", conf: "high", what: "Failover", ticket: "PLAT-412", since: null,
  detail: { tickets: ["PLAT-412", "PLAT-409"], note: "Cycle commitment." },
};

describe("PersonForm", () => {
  it("renders labelled fields and submits parsed input (open items split into a list)", async () => {
    const onSave = vi.fn(async () => {});
    render(<PersonForm teams={["Platform"]} onSave={onSave} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText("Name"), "Priya N.");
    await userEvent.type(screen.getByLabelText("Team"), "Platform");
    await userEvent.type(screen.getByLabelText("Working on"), "Federation");
    await userEvent.type(screen.getByLabelText("Open items"), "PLAT-388\nPLAT-390");
    await userEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    expect(onSave).toHaveBeenCalledTimes(1);
    const input = onSave.mock.calls[0][0];
    expect(input.name).toBe("Priya N.");
    expect(input.team).toBe("Platform");
    expect(input.detail.tickets).toEqual(["PLAT-388", "PLAT-390"]);
  });

  it("requires a name and a team", async () => {
    const onSave = vi.fn(async () => {});
    render(<PersonForm teams={[]} onSave={onSave} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("prefills from an existing person in edit mode", () => {
    render(<PersonForm initial={person} teams={["Platform"]} onSave={async () => {}} onCancel={() => {}} onDelete={async () => {}} />);
    expect(screen.getByLabelText("Name")).toHaveValue("Maya R.");
    expect(screen.getByLabelText("Open items")).toHaveValue("PLAT-412\nPLAT-409");
  });

  it("shows an error and keeps input when save fails", async () => {
    const onSave = vi.fn(async () => { throw new Error("offline"); });
    render(<PersonForm initial={person} teams={["Platform"]} onSave={onSave} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn.t save/i);
    expect(screen.getByLabelText("Name")).toHaveValue("Maya R."); // input preserved
  });

  it("delete requires a confirm step then calls onDelete", async () => {
    const onDelete = vi.fn(async () => {});
    render(<PersonForm initial={person} teams={["Platform"]} onSave={async () => {}} onCancel={() => {}} onDelete={onDelete} />);
    await userEvent.click(screen.getByRole("button", { name: /^Delete$/ }));
    expect(onDelete).not.toHaveBeenCalled(); // first click only arms it
    await userEvent.click(screen.getByRole("button", { name: /Confirm delete/ }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/PersonForm.test.tsx`
Expected: FAIL — cannot find module `./PersonForm`.

- [ ] **Step 3: Implement `PersonForm.tsx`**

```tsx
// web/src/components/PersonForm.tsx
import { useId, useState, type FormEvent } from "react";
import type { Person } from "../types";
import type { PersonInput } from "../roster/mutations";
import { CAT_ORDER, CATEGORIES } from "../categories";

const fieldClass =
  "font-mono text-[13px] text-ink px-[12px] py-[9px] rounded-[8px] border border-line-2 bg-transparent";
const labelClass = "flex flex-col gap-[6px] font-mono text-[12px] text-ink-2";

export function PersonForm({
  initial, teams, onSave, onCancel, onDelete,
}: {
  initial?: Person;
  teams: string[];
  onSave: (input: PersonInput) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}) {
  const listId = useId();
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState(initial?.role ?? "");
  const [team, setTeam] = useState(initial?.team ?? "");
  const [cat, setCat] = useState(initial?.cat ?? "planned");
  const [conf, setConf] = useState(initial?.conf ?? "high");
  const [what, setWhat] = useState(initial?.what ?? "");
  const [ticket, setTicket] = useState(initial?.ticket ?? "");
  const [since, setSince] = useState(initial?.since ?? "");
  const [openItems, setOpenItems] = useState((initial?.detail.tickets ?? []).join("\n"));
  const [note, setNote] = useState(initial?.detail.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !team.trim()) {
      setError("Name and team are required.");
      return;
    }
    const input: PersonInput = {
      name: name.trim(), role: role.trim(), team: team.trim(),
      cat, conf, what: what.trim(),
      ticket: ticket.trim() || null,
      since: since.trim() || null,
      detail: {
        tickets: openItems.split("\n").map((s) => s.trim()).filter(Boolean),
        note: note.trim(),
      },
    };
    setError(null);
    setBusy(true);
    try {
      await onSave(input);
      // success: the parent navigates back to the list (this form unmounts)
    } catch {
      setError("Couldn't save. Check your connection and try again.");
      setBusy(false);
    }
  }

  async function onDeleteClick() {
    if (!onDelete) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setBusy(true);
    try {
      await onDelete();
    } catch {
      setError("Couldn't delete. Check your connection and try again.");
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  return (
    <main className="p-[38px_48px_44px] max-w-[640px]">
      <h1 className="font-serif font-normal text-[24px] leading-none tracking-[-0.02em] text-ink m-0">
        {initial ? "Edit person" : "Add person"}
      </h1>
      <form onSubmit={onSubmit} className="mt-[24px] flex flex-col gap-[16px]">
        <label className={labelClass}>
          Name
          <input className={fieldClass} style={{ outlineColor: "var(--focus)" }} value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className={labelClass}>
          Role
          <input className={fieldClass} style={{ outlineColor: "var(--focus)" }} value={role} onChange={(e) => setRole(e.target.value)} />
        </label>
        <label className={labelClass}>
          Team
          <input className={fieldClass} style={{ outlineColor: "var(--focus)" }} value={team} onChange={(e) => setTeam(e.target.value)} list={listId} required />
          <datalist id={listId}>
            {teams.map((t) => <option key={t} value={t} />)}
          </datalist>
        </label>
        <label className={labelClass}>
          Category
          <select className={fieldClass} style={{ outlineColor: "var(--focus)" }} value={cat} onChange={(e) => setCat(e.target.value as typeof cat)}>
            {CAT_ORDER.map((k) => <option key={k} value={k}>{CATEGORIES[k].label}</option>)}
          </select>
        </label>
        <label className={labelClass}>
          Confidence
          <select className={fieldClass} style={{ outlineColor: "var(--focus)" }} value={conf} onChange={(e) => setConf(e.target.value as typeof conf)}>
            <option value="high">High</option>
            <option value="low">Low (inferred)</option>
          </select>
        </label>
        <label className={labelClass}>
          Working on
          <input className={fieldClass} style={{ outlineColor: "var(--focus)" }} value={what} onChange={(e) => setWhat(e.target.value)} />
        </label>
        <label className={labelClass}>
          Ticket
          <input className={fieldClass} style={{ outlineColor: "var(--focus)" }} value={ticket} onChange={(e) => setTicket(e.target.value)} />
        </label>
        <label className={labelClass}>
          Since note
          <input className={fieldClass} style={{ outlineColor: "var(--focus)" }} value={since} onChange={(e) => setSince(e.target.value)} />
        </label>
        <label className={labelClass}>
          Open items
          <textarea className={fieldClass} style={{ outlineColor: "var(--focus)" }} rows={3} value={openItems} onChange={(e) => setOpenItems(e.target.value)} />
        </label>
        <label className={labelClass}>
          Why note
          <textarea className={fieldClass} style={{ outlineColor: "var(--focus)" }} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

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

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/PersonForm.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the guardrail**

Run: `npm run guardrail`
Expected: `OK — no raw design values`.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/PersonForm.tsx web/src/components/PersonForm.test.tsx
git commit -m "feat(web): shared PersonForm (add/edit, two-click delete, AA, generic save error)"
```

---

### Task 6: Key rows by `person.id`

**Files:**
- Modify: `web/src/components/RosterTable.tsx`
- Modify: `web/src/components/PersonRow.tsx`

- [ ] **Step 1: Key people by id in `RosterTable.tsx`**

Change the person map's key from `p.name` to `p.id`:

```tsx
          {team.people.map((p, i) => (
            <PersonRow key={p.id} person={p} idx={i + 1} last={ti === lastTeam && i === team.people.length - 1} />
          ))}
```

- [ ] **Step 2: Build `panelId` from `person.id` in `PersonRow.tsx`**

Replace the `panelId` line (and its comment) with:

```tsx
  const panelId = `person-panel-${person.id}`;
```

- [ ] **Step 3: Run the existing render tests**

Run: `npx vitest run src/components/table.test.tsx src/App.test.tsx`
Expected: PASS (the fixture now has ids from Task 1, so keys/panel ids are stable and unique).

- [ ] **Step 4: Commit**

```bash
git add web/src/components/RosterTable.tsx web/src/components/PersonRow.tsx
git commit -m "feat(web): key roster rows and panels by stable person.id"
```

---

### Task 7: Wire `App` — view state, `editable`, add/edit/delete

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/App.test.tsx`

- [ ] **Step 1: Add failing tests to `App.test.tsx`**

Add these imports at the top of `web/src/App.test.tsx` (alongside the existing ones):

```tsx
import userEvent from "@testing-library/user-event";
import { emptyRoster } from "./storage/sanitize";
```

Add a new describe block:

```tsx
describe("App editing (editable build)", () => {
  function editableStore() {
    let current: RosterData = emptyRoster();
    return {
      store: { load: async () => current, save: async (d: RosterData) => { current = d; } } as RosterStore,
    };
  }

  it("empty state offers to add the first person; adding shows the row", async () => {
    const { store } = editableStore();
    render(<App store={store} editable />);
    await screen.findByText(/No one on the roster yet/i);
    await userEvent.click(screen.getByRole("button", { name: /Add your first person/i }));
    await userEvent.type(screen.getByLabelText("Name"), "Maya R.");
    await userEvent.type(screen.getByLabelText("Team"), "Platform");
    await userEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    expect(await screen.findByText("Maya R.")).toBeInTheDocument();
    expect(screen.getByText("Platform")).toBeInTheDocument();
  });

  it("'Correct my row' opens the edit form prefilled", async () => {
    const seeded: RosterData = {
      teams: [{ name: "Platform", lead: "", people: [{
        id: "p1", name: "Maya R.", initials: "MR", role: "EM", team: "Platform",
        cat: "planned", conf: "high", what: "Failover", ticket: "PLAT-412", since: null,
        detail: { tickets: [], note: "n" },
      }] }],
      snapshot: { day: "d", time: "t", prev: "", next: "", slackConnected: false },
    };
    render(<App store={{ load: async () => seeded, save: async () => {} } as RosterStore} editable />);
    await userEvent.click(await screen.findByRole("button", { name: /Maya R\./ }));
    await userEvent.click(screen.getByRole("button", { name: /Correct Maya's row/ }));
    expect(screen.getByLabelText("Name")).toHaveValue("Maya R.");
  });

  it("the demo (not editable) shows no Add button", async () => {
    render(<App store={{ load: async () => emptyRoster(), save: async () => {} } as RosterStore} />);
    await screen.findByText(/No one on the roster yet/i);
    expect(screen.queryByRole("button", { name: /Add/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — `App` has no `editable`/view/add wiring.

- [ ] **Step 3: Rewrite `App.tsx`**

```tsx
// web/src/App.tsx
import { useState } from "react";
import { derive } from "./roster";
import type { RosterStore } from "./storage/RosterStore";
import { useRoster } from "./useRoster";
import { addPerson, removePerson, updatePerson } from "./roster/mutations";
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

export default function App({ store, onSignOut, editable = false }: { store?: RosterStore; onSignOut?: () => void; editable?: boolean }) {
  const { roster, error, commit } = useRoster(store);
  const [view, setView] = useState<View>({ mode: "list" });
  const toList = () => setView({ mode: "list" });

  if (error) {
    return (
      <div className="p-[38px_48px_44px] font-mono text-[13px]" style={{ color: "var(--rust-deep)" }}>
        Could not load the roster: {error}
      </div>
    );
  }
  if (!roster) {
    return <div className="p-[38px_48px_44px] font-mono text-[12px] text-muted">Loading…</div>;
  }

  const d = derive(roster);
  const teamNames = roster.teams.map((t) => t.name);

  if (editable && view.mode === "add") {
    return (
      <PersonForm teams={teamNames} onCancel={toList}
        onSave={(input) => commit((r) => addPerson(r, input)).then(toList)} />
    );
  }

  const editing = editable && view.mode === "edit" ? d.all.find((p) => p.id === view.id) : undefined;
  if (editing) {
    return (
      <PersonForm initial={editing} teams={teamNames} onCancel={toList}
        onSave={(input) => commit((r) => updatePerson(r, editing.id, input)).then(toList)}
        onDelete={() => commit((r) => removePerson(r, editing.id)).then(toList)} />
    );
  }

  const actions = editable ? { onEditPerson: (id: string) => setView({ mode: "edit", id }) } : {};
  return (
    <RosterActionsContext.Provider value={actions}>
      <main className="p-[38px_48px_44px]">
        <Header snapshot={roster.snapshot} total={d.total} onSignOut={onSignOut} />
        {d.total === 0 ? (
          <div className="mt-[26px] flex flex-col items-start gap-[14px]">
            <p className="font-mono text-[12px] text-muted">No one on the roster yet.</p>
            {editable && <AddButton label="Add your first person" onClick={() => setView({ mode: "add" })} />}
          </div>
        ) : (
          <>
            {editable && (
              <div className="mt-[18px]">
                <AddButton label="Add person" onClick={() => setView({ mode: "add" })} />
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

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS (all App tests, including the prior load/empty/error/sign-out ones).

- [ ] **Step 5: Run typecheck + guardrail**

Run: `npm run typecheck && npm run guardrail`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/App.tsx web/src/App.test.tsx
git commit -m "feat(web): App view state + editable CRUD wiring (add/edit/delete)"
```

---

### Task 8: Pass `editable` from `Root` in the authenticated build

**Files:**
- Modify: `web/src/Root.tsx`

- [ ] **Step 1: Pass `editable` on the authed App render**

In `web/src/Root.tsx`, the session branch renders `<App onSignOut={…} />`. Add `editable`:

```tsx
  return <App onSignOut={() => { void authPort.signOut(); }} editable />;
```

(The demo passthrough `if (!authPort) return <App />;` stays unchanged — read-only.)

- [ ] **Step 2: Run the Root tests + typecheck**

Run: `npx vitest run src/Root.test.tsx && npm run typecheck`
Expected: PASS (Root's existing tests still pass; the authed branch now renders an editable App, but those tests only assert "Team status"/"Sign out" which are unaffected).

- [ ] **Step 3: Commit**

```bash
git add web/src/Root.tsx
git commit -m "feat(web): enable editing in the authenticated build (Root passes editable)"
```

---

### Task 9: Verify green gate + demo bundle still SDK-free

**Files:** none (verification only).

- [ ] **Step 1: Full suite + typecheck + lint + guardrail**

Run: `npm test && npm run typecheck && npm run lint && npm run guardrail`
Expected: all PASS.

- [ ] **Step 2: Demo build excludes the SDK**

Run: `VITE_BACKEND=local npm run build && ! grep -riq "supabase" dist/assets`
Expected: build succeeds and `grep` finds nothing (exit 0).

- [ ] **Step 3: Supabase variant compiles**

Run: `VITE_BACKEND=supabase VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=test npm run build`
Expected: build succeeds.

- [ ] **Step 4: Restore demo build, confirm clean tree**

```bash
VITE_BACKEND=local npm run build >/dev/null 2>&1
git status   # expect clean working tree; dist/ is gitignored
```

---

## Self-Review

**Spec coverage:**
- Stable `Person.id` + sanitizer backfill → Task 1. ✔
- Pure `addPerson/updatePerson/removePerson` + implicit teams + `deriveInitials`/`buildPerson` → Task 2. ✔
- `useRoster` save-then-commit + live snapshot → Task 3. ✔
- `RosterActionsContext` + functional "Correct my row" → Task 4. ✔
- Shared `PersonForm` (add/edit, fields, Open-items parsing, two-click delete, generic save error, AA) → Task 5. ✔
- Key rows by id → Task 6. ✔
- `App` view state + `editable` gate + Add affordance + empty-state CTA + edit/delete wiring → Task 7. ✔
- `Root` passes `editable` (demo read-only) → Task 8. ✔
- Green gate + demo-bundle-SDK-free → Task 9. ✔
- Live end-to-end check → performed after merge (human + controller), per spec.

**Placeholder scan:** No TBD/TODO; every code step shows full code; commands have expected output. Task 1 Step 7 names each file and the exact literal to change.

**Type consistency:** `PersonInput`, `buildPerson`, `deriveInitials`, `addPerson(roster,input)`, `updatePerson(roster,id,input)`, `removePerson(roster,id)`, `useRoster(store?) → {roster,error,commit}`, `RosterActions.onEditPerson`, `PersonForm` props (`initial?`,`teams`,`onSave`,`onCancel`,`onDelete?`), and `App` props (`store?`,`onSignOut?`,`editable?`) are used identically across tasks and match the spec. `todaySnapshot`/`emptyRoster` are imported from `./storage/sanitize` (exported there since Phase 1).
