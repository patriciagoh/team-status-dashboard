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
