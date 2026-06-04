import { describe, it, expect } from "vitest";
import roster from "../public/roster.json";
import type { RosterDoc } from "./types";
import { CATEGORIES } from "./categories";

const doc = roster as RosterDoc;

describe("roster.json fixture (RosterDoc)", () => {
  it("has 26 engineers, each in a named team", () => {
    expect(doc.engineers).toHaveLength(26);
    for (const e of doc.engineers) {
      expect(typeof e.id).toBe("string");
      expect(e.team.length).toBeGreaterThan(0);
    }
  });

  it("every pulled work state has a known category and a high/low confidence", () => {
    const states = Object.values(doc.work.states);
    expect(states.length).toBe(26);
    for (const w of states) {
      expect(Object.keys(CATEGORIES)).toContain(w.cat);
      expect(["high", "low"]).toContain(w.conf);
    }
  });

  it("carries a synced stamp", () => {
    expect(typeof doc.work.syncedAt).toBe("string");
  });
});
