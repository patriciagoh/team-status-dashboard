// web/src/storage/RosterStore.ts
import type { Correction, Engineer, RosterDoc } from "../types";

/** App-facing seam: load the full doc (human + pipeline work); save persists ONLY the human side. */
export interface RosterStore {
  load(): Promise<RosterDoc>;
  save(doc: RosterDoc): Promise<void>;
}

/** The human-owned slice the app may persist. */
export interface HumanDoc {
  engineers: Engineer[];
  corrections: Record<string, Correction>;
}

/** Adapter sub-seam: read both columns; write only the human column. */
export interface RowStore {
  getRow(): Promise<{ data: unknown; work: unknown } | null>; // null = no row yet
  putHuman(human: HumanDoc): Promise<void>;
}
