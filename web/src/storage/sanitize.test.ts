// web/src/storage/sanitize.test.ts
import { describe, it, expect } from "vitest";
import { sanitizeRoster, sanitizeDoc, emptyDoc } from "./sanitize";

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

  it("an empty teams+snapshot blob is valid input", () => {
    expect(() => sanitizeRoster({ teams: [], snapshot: {} })).not.toThrow();
    expect(sanitizeRoster({ teams: [], snapshot: {} }).teams).toEqual([]);
  });

  it("preserves a person id when present and generates one when missing", () => {
    const withId = sanitizeRoster({
      teams: [{ name: "T", lead: "L", people: [{ id: "keep-me", name: "A", cat: "planned" }] }],
      snapshot: {},
    });
    expect(withId.teams[0].people[0].id).toBe("keep-me");

    const withoutId = sanitizeRoster({
      teams: [{ name: "T", lead: "L", people: [{ name: "A", cat: "planned" }] }],
      snapshot: {},
    });
    expect(withoutId.teams[0].people[0].id).toMatch(/.+/); // a generated id
  });
});

describe("sanitizeDoc", () => {
  it("accepts the new shape and backfills engineer ids", () => {
    const d = sanitizeDoc(
      { engineers: [{ name: "Maya R.", role: "EM", team: "Platform" }], corrections: {} },
      { syncedAt: "t", states: {} },
    );
    expect(d.engineers[0].name).toBe("Maya R.");
    expect(d.engineers[0].id).toMatch(/.+/);
    expect(d.engineers[0].linearUserId).toBeNull();
    expect(d.work.syncedAt).toBe("t");
  });

  it("migrates a legacy Phase-3 teams[] blob to engineers (no throw, no work)", () => {
    const legacy = {
      teams: [{ name: "Platform", lead: "", people: [
        { id: "p1", name: "Maya R.", role: "EM", team: "Platform", cat: "planned", conf: "high", what: "x", ticket: null, since: null, detail: { tickets: [], note: "" } },
      ] }],
      snapshot: { day: "", time: "", prev: "", next: "", slackConnected: false },
    };
    const d = sanitizeDoc(legacy, {});
    expect(d.engineers).toEqual([{ id: "p1", name: "Maya R.", role: "EM", team: "Platform", linearUserId: null, email: null }]);
    expect(d.work.states).toEqual({});
    expect(d.corrections).toEqual({});
  });

  it("throws on a non-null unrecognized blob", () => {
    expect(() => sanitizeDoc({ nope: 1 }, {})).toThrow();
  });

  it("emptyDoc is valid input to sanitizeDoc", () => {
    expect(() => sanitizeDoc(emptyDoc(), emptyDoc().work)).not.toThrow();
    expect(emptyDoc().engineers).toEqual([]);
  });
});
