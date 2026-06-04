// web/src/roster/merge.ts
import type { Person, RosterData, RosterDoc, Snapshot, Team } from "../types";
import { deriveInitials } from "./mutations";

export function mergeRoster(doc: RosterDoc): RosterData {
  const byTeam = new Map<string, Person[]>();
  const order: string[] = [];

  for (const e of doc.engineers) {
    const work = doc.work.states[e.id];
    const corr = doc.corrections[e.id];
    const correctionIsSignal = !!corr && (corr.cat !== undefined || (corr.note ?? "") !== "");
    const person: Person = {
      id: e.id,
      name: e.name,
      initials: deriveInitials(e.name),
      role: e.role,
      team: e.team,
      cat: corr?.cat ?? work?.cat ?? "planned",
      conf: work?.conf ?? "high",
      what: work?.what ?? "",
      ticket: work?.ticket ?? null,
      since: work?.since ?? null,
      detail: {
        tickets: work?.detail.tickets ?? [],
        note: corr?.note ?? work?.detail.note ?? "",
      },
      hasActivity: !!work || correctionIsSignal,
    };
    if (!byTeam.has(e.team)) { byTeam.set(e.team, []); order.push(e.team); }
    byTeam.get(e.team)!.push(person);
  }

  const teams: Team[] = order.map((name) => ({ name, lead: "", people: byTeam.get(name)! }));
  const snapshot: Snapshot = { day: doc.work.syncedAt ?? "", time: "", prev: "", next: "", slackConnected: false };
  return { teams, snapshot };
}
