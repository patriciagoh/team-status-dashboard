// web/src/storage/createRosterStore.ts
import type { RosterStore } from "./RosterStore";
import { makeLocalRosterStore } from "./localRosterStore";

export async function createRosterStore(): Promise<RosterStore> {
  if (import.meta.env.VITE_BACKEND === "supabase") {
    const [{ createSupabaseRowStore }, { makeSupabaseRosterStore }] = await Promise.all([
      import("./supabaseRowStore"),
      import("./supabaseRosterStore"),
    ]);
    return makeSupabaseRosterStore(await createSupabaseRowStore());
  }
  return makeLocalRosterStore();
}
