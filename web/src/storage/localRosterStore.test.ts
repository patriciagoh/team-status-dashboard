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
