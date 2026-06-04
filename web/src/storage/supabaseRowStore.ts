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
