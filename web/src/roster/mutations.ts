// web/src/roster/mutations.ts
import type { Category, Confidence, Person, PersonDetail, RosterData, Team } from "../types";

export interface PersonInput {
  name: string;
  role: string;
  team: string;
  cat: Category;
  conf: Confidence;
  what: string;
  ticket: string | null;
  since: string | null;
  detail: PersonDetail;
}

export function deriveInitials(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
}

export function buildPerson(input: PersonInput): Person {
  return { id: crypto.randomUUID(), initials: deriveInitials(input.name), ...input };
}

function addToTeam(teams: Team[], person: Person, teamName: string): Team[] {
  return teams.some((t) => t.name === teamName)
    ? teams.map((t) => (t.name === teamName ? { ...t, people: [...t.people, person] } : t))
    : [...teams, { name: teamName, lead: "", people: [person] }];
}

export function addPerson(roster: RosterData, input: PersonInput): RosterData {
  return { ...roster, teams: addToTeam(roster.teams, buildPerson(input), input.team) };
}

export function updatePerson(roster: RosterData, id: string, input: PersonInput): RosterData {
  const currentTeam = roster.teams.find((t) => t.people.some((p) => p.id === id));
  if (!currentTeam) return roster;
  const rebuilt: Person = { id, initials: deriveInitials(input.name), ...input };

  if (currentTeam.name === input.team) {
    return {
      ...roster,
      teams: roster.teams.map((t) =>
        t.name === input.team ? { ...t, people: t.people.map((p) => (p.id === id ? rebuilt : p)) } : t),
    };
  }

  const without = roster.teams
    .map((t) => (t.name === currentTeam.name ? { ...t, people: t.people.filter((p) => p.id !== id) } : t))
    .filter((t) => t.people.length > 0);
  return { ...roster, teams: addToTeam(without, rebuilt, input.team) };
}

export function removePerson(roster: RosterData, id: string): RosterData {
  return {
    ...roster,
    teams: roster.teams
      .map((t) => ({ ...t, people: t.people.filter((p) => p.id !== id) }))
      .filter((t) => t.people.length > 0),
  };
}
