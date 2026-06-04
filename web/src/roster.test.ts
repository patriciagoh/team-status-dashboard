import { describe, it, expect } from "vitest";
import { derive } from "./roster";
import type { RosterData, Person } from "./types";

let _n = 0;
function person(cat: Person["cat"], since: string | null = null): Person {
  return {
    id: `t${++_n}`,
    name: "X Y", initials: "XY", role: "Eng", team: "T", cat, conf: "high",
    what: "w", ticket: null, since, detail: { tickets: [], note: "" },
  };
}

const data: RosterData = {
  snapshot: { day: "d", time: "t", prev: "p", next: "n", slackConnected: false },
  teams: [
    { name: "A", lead: "X Y", people: [person("planned"), person("incident", "new this snapshot"), person("unplanned")] },
    { name: "B", lead: "X Y", people: [person("planned"), person("support"), person("lent")] },
  ],
};

describe("derive", () => {
  it("empty roster returns zeroed totals", () => {
    const empty = derive({ teams: [], snapshot: data.snapshot });
    expect(empty.total).toBe(0);
    expect(empty.offPlan).toBe(0);
    expect(empty.firefighting).toBe(0);
    expect(empty.teams).toEqual([]);
  });

  const d = derive(data);

  it("counts total people", () => expect(d.total).toBe(6));
  it("counts per category", () => {
    expect(d.counts.planned).toBe(2);
    expect(d.counts.incident).toBe(1);
    expect(d.counts.unplanned).toBe(1);
    expect(d.counts.support).toBe(1);
    expect(d.counts.lent).toBe(1);
  });
  it("onPlan = planned count", () => expect(d.onPlan).toBe(2));
  it("offPlan = incident + unplanned", () => expect(d.offPlan).toBe(2));
  it("firefighting = incident only", () => expect(d.firefighting).toBe(1));
  it("changed = anyone with a since note", () => expect(d.changed).toBe(1));
  it("per-team tally is non-zero categories in calm->urgent order", () => {
    const teamA = d.teams.find((t) => t.name === "A")!;
    expect(teamA.tally.map((x) => x.key)).toEqual(["planned", "unplanned", "incident"]);
    expect(teamA.offPlan).toBe(2);
  });
  it("team B has no off-plan", () => {
    expect(d.teams.find((t) => t.name === "B")!.offPlan).toBe(0);
  });

  it("excludes no-activity people from category counts but counts them in total", () => {
    const data = {
      snapshot: { day: "", time: "", prev: "", next: "", slackConnected: false },
      teams: [{ name: "T", lead: "", people: [
        { ...person("planned"), hasActivity: true },
        { ...person("incident"), hasActivity: false }, // no tracked activity
      ] }],
    };
    const d = derive(data as never);
    expect(d.total).toBe(2);             // counted in headcount
    expect(d.counts.incident).toBe(0);   // not counted in categories
    expect(d.counts.planned).toBe(1);
    expect(d.firefighting).toBe(0);
  });
});
