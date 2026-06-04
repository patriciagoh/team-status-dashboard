// web/src/storage/supabaseRosterStore.ts
import type { RosterStore, RowStore } from "./RosterStore";
import { emptyRoster, sanitizeRoster } from "./sanitize";

export function makeSupabaseRosterStore(rowStore: RowStore): RosterStore {
  return {
    async load() {
      const raw = await rowStore.getRow();
      if (raw === null) {
        const empty = emptyRoster();
        await rowStore.putRow(empty);
        return empty;
      }
      return sanitizeRoster(raw);
    },
    async save(data) {
      await rowStore.putRow(data);
    },
  };
}
