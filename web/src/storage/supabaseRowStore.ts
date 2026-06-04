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
