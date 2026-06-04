// web/src/roster/merge.test.ts
import { describe, it, expect } from "vitest";
import { mergeRoster } from "./merge";
import type { RosterDoc } from "../types";

function doc(over: Partial<RosterDoc> = {}): RosterDoc {
  return { engineers: [], corrections: {}, work: { syncedAt: null, states: {} }, ...over };
}

describe("mergeRoster", () => {
  it("overlays pulled work onto an engineer", () => {
    const d = doc({
      engineers: [{ id: "e1", name: "Maya R.", role: "EM", team: "Platform", linearUserId: null, email: null }],
      work: { syncedAt: "Tue 9:02 AM", states: { e1: { cat: "incident", conf: "high", what: "DB pool", ticket: "INC-1", since: null, detail: { tickets: ["INC-1"], note: "sev2" } } } },
    });
    const r = mergeRoster(d);
    const p = r.teams[0].people[0];
    expect(p.name).toBe("Maya R.");
    expect(p.initials).toBe("MR");
    expect(p.cat).toBe("incident");
    expect(p.what).toBe("DB pool");
    expect(p.hasActivity).toBe(true);
    expect(r.snapshot.day).toBe("Tue 9:02 AM"); // syncedAt carried for the header
  });

  it("marks an engineer with no work and no correction as no-activity", () => {
    const d = doc({ engineers: [{ id: "e1", name: "Priya N.", role: "Eng", team: "Platform", linearUserId: null, email: null }] });
    const p = mergeRoster(d).teams[0].people[0];
    expect(p.hasActivity).toBe(false);
    expect(p.what).toBe("");
  });

  it("applies a correction (category + note) as real signal", () => {
    const d = doc({
      engineers: [{ id: "e1", name: "A B", role: "Eng", team: "T", linearUserId: null, email: null }],
      corrections: { e1: { cat: "unplanned", note: "pulled into triage" } },
    });
    const p = mergeRoster(d).teams[0].people[0];
    expect(p.cat).toBe("unplanned");
    expect(p.detail.note).toBe("pulled into triage");
    expect(p.hasActivity).toBe(true);
  });

  it("an empty-note correction with no category is NOT treated as activity", () => {
    const d = doc({
      engineers: [{ id: "e1", name: "A B", role: "Eng", team: "T", linearUserId: null, email: null }],
      corrections: { e1: { note: "" } },
    });
    expect(mergeRoster(d).teams[0].people[0].hasActivity).toBe(false);
  });

  it("a correction category overrides the pulled work category", () => {
    const d = doc({
      engineers: [{ id: "e1", name: "A B", role: "Eng", team: "T", linearUserId: null, email: null }],
      work: { syncedAt: null, states: { e1: { cat: "planned", conf: "high", what: "x", ticket: null, since: null, detail: { tickets: [], note: "auto" } } } },
      corrections: { e1: { cat: "incident" } },
    });
    expect(mergeRoster(d).teams[0].people[0].cat).toBe("incident");
  });

  it("groups engineers into teams in first-seen order", () => {
    const d = doc({ engineers: [
      { id: "e1", name: "A", role: "", team: "Platform", linearUserId: null, email: null },
      { id: "e2", name: "B", role: "", team: "Payments", linearUserId: null, email: null },
      { id: "e3", name: "C", role: "", team: "Platform", linearUserId: null, email: null },
    ] });
    const r = mergeRoster(d);
    expect(r.teams.map((t) => t.name)).toEqual(["Platform", "Payments"]);
    expect(r.teams[0].people.map((p) => p.name)).toEqual(["A", "C"]);
  });
});
