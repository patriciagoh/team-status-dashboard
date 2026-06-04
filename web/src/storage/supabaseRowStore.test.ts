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
