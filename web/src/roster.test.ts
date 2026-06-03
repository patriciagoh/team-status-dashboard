import { describe, it, expect } from "vitest";
import { derive } from "./roster";
import type { RosterData } from "./types";

function person(cat: RosterData["teams"][0]["people"][0]["cat"], since: string | null = null) {
  return {
    name: "X Y", initials: "XY", role: "Eng", team: "T", cat, conf: "high" as const,
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
  const d = derive(data);

  it("counts total people", () => expect(d.total).toBe(6));
  it("counts per category", () => {
    expect(d.counts.planned).toBe(2);
    expect(d.counts.incident).toBe(1);
    expect(d.counts.unplanned).toBe(1);
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
});
