// web/src/storage/sanitize.ts
import type { Category, Correction, Engineer, Person, RosterData, RosterDoc, Snapshot, Team, WorkSnapshot, WorkState } from "../types";

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

function sanitizeEngineer(raw: unknown): Engineer {
  const r = isRecord(raw) ? raw : {};
  return {
    id: typeof r.id === "string" && r.id ? r.id : crypto.randomUUID(),
    name: str(r.name),
    role: str(r.role),
    team: str(r.team),
    linearUserId: typeof r.linearUserId === "string" ? r.linearUserId : null,
    email: typeof r.email === "string" ? r.email : null,
  };
}

function sanitizeWorkState(raw: unknown): WorkState {
  const r = isRecord(raw) ? raw : {};
  const detail = isRecord(r.detail) ? r.detail : {};
  return {
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

function sanitizeWork(raw: unknown): WorkSnapshot {
  if (!isRecord(raw)) return { syncedAt: null, states: {} };
  const states: Record<string, WorkState> = {};
  if (isRecord(raw.states)) {
    for (const [id, v] of Object.entries(raw.states)) states[id] = sanitizeWorkState(v);
  }
  return { syncedAt: typeof raw.syncedAt === "string" ? raw.syncedAt : null, states };
}

function sanitizeCorrections(raw: unknown): Record<string, Correction> {
  const out: Record<string, Correction> = {};
  if (!isRecord(raw)) return out;
  for (const [id, v] of Object.entries(raw)) {
    if (!isRecord(v)) continue;
    const c: Correction = {};
    if (CATEGORIES.includes(v.cat as never)) c.cat = v.cat as Correction["cat"];
    if (typeof v.note === "string") c.note = v.note;
    out[id] = c;
  }
  return out;
}

export function emptyDoc(): RosterDoc {
  return { engineers: [], corrections: {}, work: { syncedAt: null, states: {} } };
}

export function sanitizeDoc(rawData: unknown, rawWork: unknown): RosterDoc {
  // Legacy migration: a Phase-3 RosterData { teams: [...] } → engineers (no work, no corrections).
  if (isRecord(rawData) && Array.isArray(rawData.teams) && !Array.isArray(rawData.engineers)) {
    const legacy = sanitizeRoster(rawData); // reuse the old parser
    const engineers: Engineer[] = legacy.teams.flatMap((t) =>
      t.people.map((p) => ({ id: p.id, name: p.name, role: p.role, team: t.name, linearUserId: null, email: null })));
    return { engineers, corrections: {}, work: { syncedAt: null, states: {} } };
  }
  if (!isRecord(rawData) || !Array.isArray(rawData.engineers)) {
    throw new Error("Unrecognized roster data");
  }
  return {
    engineers: rawData.engineers.map(sanitizeEngineer),
    corrections: sanitizeCorrections(rawData.corrections),
    work: sanitizeWork(rawWork),
  };
}
