// web/src/roster/mutations.test.ts
import { describe, it, expect } from "vitest";
import {
  addEngineer, updateEngineer, removeEngineer, setCorrection, clearCorrection,
  deriveInitials, type EngineerInput,
} from "./mutations";
import type { RosterDoc } from "../types";

const empty: RosterDoc = { engineers: [], corrections: {}, work: { syncedAt: null, states: {} } };

function input(over: Partial<EngineerInput> = {}): EngineerInput {
  return { name: "Maya R.", role: "EM", team: "Platform", linearUserId: null, email: null, ...over };
}

describe("deriveInitials", () => {
  it("first letter of up to two words, uppercased", () => {
    expect(deriveInitials("Maya R.")).toBe("MR");
    expect(deriveInitials("alex")).toBe("A");
  });
});

describe("engineer mutations", () => {
  it("addEngineer appends a flat engineer with a fresh id", () => {
    const d = addEngineer(empty, input());
    expect(d.engineers).toHaveLength(1);
    expect(d.engineers[0].name).toBe("Maya R.");
    expect(d.engineers[0].id).toMatch(/.+/);
    expect(empty.engineers).toHaveLength(0); // immutable
  });

  it("updateEngineer changes fields, preserving id", () => {
    const d1 = addEngineer(empty, input());
    const id = d1.engineers[0].id;
    const d2 = updateEngineer(d1, id, input({ team: "Payments", linearUserId: "lin_1" }));
    expect(d2.engineers[0].id).toBe(id);
    expect(d2.engineers[0].team).toBe("Payments");
    expect(d2.engineers[0].linearUserId).toBe("lin_1");
  });

  it("removeEngineer drops the engineer and its correction", () => {
    const d1 = addEngineer(empty, input());
    const id = d1.engineers[0].id;
    const d2 = setCorrection(d1, id, { cat: "incident" });
    const d3 = removeEngineer(d2, id);
    expect(d3.engineers).toHaveLength(0);
    expect(d3.corrections[id]).toBeUndefined();
  });

  it("setCorrection and clearCorrection manage the corrections map", () => {
    const d1 = addEngineer(empty, input());
    const id = d1.engineers[0].id;
    const d2 = setCorrection(d1, id, { cat: "unplanned", note: "pulled into triage" });
    expect(d2.corrections[id]).toEqual({ cat: "unplanned", note: "pulled into triage" });
    const d3 = clearCorrection(d2, id);
    expect(d3.corrections[id]).toBeUndefined();
  });
});
