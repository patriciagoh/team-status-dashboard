// web/src/storage/supabaseRosterStore.ts
import type { RosterStore, RowStore } from "./RosterStore";
import { emptyDoc, sanitizeDoc } from "./sanitize";

export function makeSupabaseRosterStore(rowStore: RowStore): RosterStore {
  return {
    async load() {
      const row = await rowStore.getRow();
      if (row === null) {
        const doc = emptyDoc();
        await rowStore.putHuman({ engineers: doc.engineers, corrections: doc.corrections });
        return doc;
      }
      return sanitizeDoc(row.data, row.work);
    },
    async save(doc) {
      await rowStore.putHuman({ engineers: doc.engineers, corrections: doc.corrections });
    },
  };
}
