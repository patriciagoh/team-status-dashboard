// web/src/storage/RosterStore.ts
import type { RosterData } from "../types";

/** App-facing persistence seam: load/save the whole roster document. */
export interface RosterStore {
  load(): Promise<RosterData>;
  save(data: RosterData): Promise<void>;
}

/** Adapter-internal sub-seam: raw row I/O. `getRow` returns null when no row exists yet. */
export interface RowStore {
  getRow(): Promise<unknown | null>;
  putRow(data: RosterData): Promise<void>;
}
