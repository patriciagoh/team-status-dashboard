// web/src/storage/localRosterStore.ts
import type { RosterStore } from "./RosterStore";
import { sanitizeRoster } from "./sanitize";

export function makeLocalRosterStore(): RosterStore {
  return {
    async load() {
      const res = await fetch(`${import.meta.env.BASE_URL}roster.json`);
      if (!res.ok) throw new Error(`roster.json ${res.status}`);
      return sanitizeRoster(await res.json());
    },
    async save() {
      throw new Error("demo is read-only");
    },
  };
}
