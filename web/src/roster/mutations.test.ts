// web/src/roster/mutations.test.ts
import { describe, it, expect } from "vitest";
import { addPerson, updatePerson, removePerson, deriveInitials, type PersonInput } from "./mutations";
import type { RosterData } from "../types";

const empty: RosterData = { teams: [], snapshot: { day: "", time: "", prev: "", next: "", slackConnected: false } };

function input(over: Partial<PersonInput> = {}): PersonInput {
  return {
    name: "Maya R.", role: "EM", team: "Platform", cat: "planned", conf: "high",
    what: "Failover runbook", ticket: "PLAT-412", since: null,
    detail: { tickets: ["PLAT-412"], note: "Cycle commitment." }, ...over,
  };
}

describe("deriveInitials", () => {
  it("takes the first letter of up to two words, uppercased", () => {
    expect(deriveInitials("Maya R.")).toBe("MR");
    expect(deriveInitials("devin o.")).toBe("DO");
    expect(deriveInitials("Alex")).toBe("A");
  });
});

describe("addPerson", () => {
  it("creates a new team when the team does not exist", () => {
    const r = addPerson(empty, input());
    expect(r.teams).toHaveLength(1);
    expect(r.teams[0].name).toBe("Platform");
    expect(r.teams[0].people[0].name).toBe("Maya R.");
    expect(r.teams[0].people[0].id).toMatch(/.+/);
    expect(r.teams[0].people[0].initials).toBe("MR");
  });

  it("appends to an existing team", () => {
    const r = addPerson(addPerson(empty, input()), input({ name: "Priya N." }));
    expect(r.teams).toHaveLength(1);
    expect(r.teams[0].people.map((p) => p.name)).toEqual(["Maya R.", "Priya N."]);
  });

  it("assigns unique ids", () => {
    const r = addPerson(addPerson(empty, input()), input({ name: "Priya N." }));
    const [a, b] = r.teams[0].people;
    expect(a.id).not.toBe(b.id);
  });

  it("does not mutate the input roster", () => {
    addPerson(empty, input());
    expect(empty.teams).toHaveLength(0);
  });
});

describe("updatePerson", () => {
  it("updates fields in place and re-derives initials, preserving id and order", () => {
    const r1 = addPerson(addPerson(empty, input()), input({ name: "Priya N." }));
    const id = r1.teams[0].people[0].id;
    const r2 = updatePerson(r1, id, input({ name: "Maya Rao", what: "Drills" }));
    const people = r2.teams[0].people;
    expect(people[0].id).toBe(id);            // same id
    expect(people[0].name).toBe("Maya Rao");
    expect(people[0].initials).toBe("MR");
    expect(people[0].what).toBe("Drills");
    expect(people.map((p) => p.name)).toEqual(["Maya Rao", "Priya N."]); // order preserved
  });

  it("moves a person to a new team and prunes the emptied source team", () => {
    const r1 = addPerson(empty, input());          // Maya in Platform (only member)
    const id = r1.teams[0].people[0].id;
    const r2 = updatePerson(r1, id, input({ team: "Payments" }));
    expect(r2.teams.map((t) => t.name)).toEqual(["Payments"]); // Platform pruned
    expect(r2.teams[0].people[0].id).toBe(id);
  });

  it("returns the roster unchanged when the id is unknown", () => {
    const r1 = addPerson(empty, input());
    expect(updatePerson(r1, "nope", input())).toBe(r1);
  });
});

describe("removePerson", () => {
  it("removes the person and prunes an emptied team", () => {
    const r1 = addPerson(empty, input());
    const id = r1.teams[0].people[0].id;
    expect(removePerson(r1, id).teams).toEqual([]);
  });

  it("keeps the team when other members remain", () => {
    const r1 = addPerson(addPerson(empty, input()), input({ name: "Priya N." }));
    const id = r1.teams[0].people[0].id;
    const r2 = removePerson(r1, id);
    expect(r2.teams[0].people.map((p) => p.name)).toEqual(["Priya N."]);
  });
});
