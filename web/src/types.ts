export type Category =
  | "planned" | "adhoc" | "lent" | "support" | "unplanned" | "incident";
export type Confidence = "high" | "low";
export type Signal = "calm" | "neutral" | "attn" | "urgent";

export interface PersonDetail {
  tickets: string[];
  note: string;
}

export interface Person {
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
