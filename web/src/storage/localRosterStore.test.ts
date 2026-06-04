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
