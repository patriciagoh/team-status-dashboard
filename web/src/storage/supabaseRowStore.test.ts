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
