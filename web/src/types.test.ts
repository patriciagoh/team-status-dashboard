import { describe, it, expect } from "vitest";
import roster from "../public/roster.json";
import type { RosterData } from "./types";
import { CATEGORIES } from "./categories";

const data = roster as RosterData;

describe("roster.json fixture", () => {
  it("has four teams totalling 26 people", () => {
    expect(data.teams).toHaveLength(4);
    const total = data.teams.reduce((n, t) => n + t.people.length, 0);
    expect(total).toBe(26);
  });

  it("every person has a known category and a high/low confidence", () => {
    for (const team of data.teams) {
      for (const p of team.people) {
        expect(Object.keys(CATEGORIES)).toContain(p.cat);
        expect(["high", "low"]).toContain(p.conf);
        expect(p.team).toBe(team.name);
      }
    }
  });
});
