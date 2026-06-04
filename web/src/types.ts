export type Category =
  | "planned" | "adhoc" | "lent" | "support" | "unplanned" | "incident";
export type Confidence = "high" | "low";
export type Signal = "calm" | "neutral" | "attn" | "urgent";

export interface PersonDetail {
  tickets: string[];
  note: string;
}

export interface Person {
  id: string;
  name: string;
  initials: string;
  role: string;
  team: string;
  cat: Category;
  conf: Confidence;
  what: string;
  ticket: string | null;
  since: string | null;
  detail: PersonDetail;
  /** Display flag: false when an engineer has no pulled work state and no correction. Optional; undefined ≡ true. */
  hasActivity?: boolean;
}

export interface Team {
  name: string;
  lead: string;
  people: Person[];
}

export interface Snapshot {
  day: string;
  time: string;
  prev: string;
  next: string;
  slackConnected: boolean;
}

export interface RosterData {
  teams: Team[];
  snapshot: Snapshot;
}

// --- Phase 3b: stored document (config / pulled work / corrections) ---

/** Human-owned roster config. */
export interface Engineer {
  id: string;
  name: string;
  role: string;
  team: string;
  linearUserId: string | null; // mapping → Linear Member.id
  email: string | null;        // mapping → Slack/Linear by email
}

/** Human-owned override of a pulled row ("Correct my row"). */
export interface Correction {
  cat?: Category;
  note?: string;
}

/** Pipeline-owned, pulled & classified work for one engineer (read-only in the app). */
export interface WorkState {
  cat: Category;
  conf: Confidence;
  what: string;
  ticket: string | null;
  since: string | null;
  detail: PersonDetail;
}

/** Pipeline-owned snapshot, keyed by engineer id. */
export interface WorkSnapshot {
  syncedAt: string | null;
  states: Record<string, WorkState>;
}

/** The stored document: human side (engineers + corrections) + pipeline side (work). */
export interface RosterDoc {
  engineers: Engineer[];
  corrections: Record<string, Correction>;
  work: WorkSnapshot;
}
