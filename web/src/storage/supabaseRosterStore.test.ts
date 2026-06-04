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
    { id: "sv1", name: "A", initials: "A", role: "Eng", team: "T", cat: "planned", conf: "high",
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
