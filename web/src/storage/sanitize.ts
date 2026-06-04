// web/src/storage/sanitize.ts
import type { Category, Person, RosterData, Snapshot, Team } from "../types";

const CATEGORIES: Category[] = ["planned", "adhoc", "lent", "support", "unplanned", "incident"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function category(v: unknown): Category {
  return CATEGORIES.includes(v as Category) ? (v as Category) : "adhoc";
}

export function todaySnapshot(): Snapshot {
  const now = new Date();
  return {
    day: now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
    time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    prev: "—",
    next: "—",
    slackConnected: false,
  };
}

export function emptyRoster(): RosterData {
  return { teams: [], snapshot: todaySnapshot() };
}

function sanitizePerson(raw: unknown, teamName: string): Person {
  const r = isRecord(raw) ? raw : {};
  const detail = isRecord(r.detail) ? r.detail : {};
  return {
    id: typeof r.id === "string" && r.id ? r.id : crypto.randomUUID(),
    name: str(r.name),
    initials: str(r.initials),
    role: str(r.role),
    team: str(r.team, teamName),
    cat: category(r.cat),
    conf: r.conf === "low" ? "low" : "high",
    what: str(r.what),
    ticket: typeof r.ticket === "string" ? r.ticket : null,
    since: typeof r.since === "string" ? r.since : null,
    detail: {
      tickets: Array.isArray(detail.tickets) ? detail.tickets.filter((t): t is string => typeof t === "string") : [],
      note: str(detail.note),
    },
  };
}

export function sanitizeRoster(raw: unknown): RosterData {
  if (!isRecord(raw) || !Array.isArray(raw.teams) || !isRecord(raw.snapshot)) {
    throw new Error("Unrecognized roster data");
  }
  const s = raw.snapshot;
  const snapshot: Snapshot = {
    day: str(s.day),
    time: str(s.time),
    prev: str(s.prev, "—"),
    next: str(s.next, "—"),
    slackConnected: s.slackConnected === true,
  };
  const teams: Team[] = raw.teams.map((t) => {
    const tr = isRecord(t) ? t : {};
    const name = str(tr.name);
    const people = Array.isArray(tr.people) ? tr.people.map((p) => sanitizePerson(p, name)) : [];
    return { name, lead: str(tr.lead), people };
  });
  return { teams, snapshot };
}
