// web/src/storage/sanitize.test.ts
import { describe, it, expect } from "vitest";
import { sanitizeRoster, emptyRoster } from "./sanitize";

describe("sanitizeRoster", () => {
  it("accepts a valid roster and preserves people", () => {
    const r = sanitizeRoster({
      teams: [{ name: "T", lead: "L", people: [
        { name: "A", initials: "A", role: "Eng", team: "T", cat: "planned", conf: "high",
          what: "x", ticket: "T-1", since: null, detail: { tickets: ["T-1"], note: "n" } },
      ] }],
      snapshot: { day: "d", time: "t", prev: "p", next: "n", slackConnected: true },
    });
    expect(r.teams[0].people[0].name).toBe("A");
    expect(r.teams[0].people[0].cat).toBe("planned");
    expect(r.snapshot.slackConnected).toBe(true);
  });

  it("backfills missing optional person fields", () => {
    const r = sanitizeRoster({
      teams: [{ name: "T", lead: "L", people: [{ name: "A", cat: "planned" }] }],
      snapshot: { day: "d", time: "t" },
    });
    const p = r.teams[0].people[0];
    expect(p.since).toBeNull();
    expect(p.conf).toBe("high");
    expect(p.detail).toEqual({ tickets: [], note: "" });
    expect(p.ticket).toBeNull();
  });

  it("clamps an out-of-union category to a safe default", () => {
    const r = sanitizeRoster({
      teams: [{ name: "T", lead: "L", people: [{ name: "A", cat: "bogus" }] }],
      snapshot: {},
    });
    expect(["planned","adhoc","lent","support","unplanned","incident"]).toContain(r.teams[0].people[0].cat);
  });

  it("accepts an empty roster", () => {
    const r = sanitizeRoster({ teams: [], snapshot: {} });
    expect(r.teams).toEqual([]);
  });

  it("throws on a non-null unrecognized blob", () => {
    expect(() => sanitizeRoster({ nope: 1 })).toThrow();
    expect(() => sanitizeRoster("garbage")).toThrow();
    expect(() => sanitizeRoster(42)).toThrow();
  });

  it("emptyRoster() is itself valid input", () => {
    expect(() => sanitizeRoster(emptyRoster())).not.toThrow();
    expect(emptyRoster().teams).toEqual([]);
  });
});
