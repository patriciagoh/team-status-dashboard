// web/src/storage/localRosterStore.ts
import type { RosterStore } from "./RosterStore";
import { sanitizeDoc } from "./sanitize";

export function makeLocalRosterStore(): RosterStore {
  return {
    async load() {
      const res = await fetch(`${import.meta.env.BASE_URL}roster.json`);
      if (!res.ok) throw new Error(`roster.json ${res.status}`);
      // The demo fixture is one flat RosterDoc JSON. sanitizeDoc reads engineers/
      // corrections from rawData and work from the separate rawWork arg, so we pass
      // raw for both (raw.work is the pipeline side; raw's own `work` key is ignored).
      const raw: unknown = await res.json();
      const work = typeof raw === "object" && raw !== null ? (raw as { work?: unknown }).work : null;
      return sanitizeDoc(raw, work);
    },
    async save() {
      throw new Error("demo is read-only");
    },
  };
}
