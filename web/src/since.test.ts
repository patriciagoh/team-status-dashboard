import { describe, it, expect } from "vitest";
import { isNewSnapshot } from "./since";

describe("isNewSnapshot", () => {
  it("returns true for 'new this snapshot' (lowercase)", () => {
    expect(isNewSnapshot("new this snapshot")).toBe(true);
  });

  it("returns true for 'New this snapshot' (title-case)", () => {
    expect(isNewSnapshot("New this snapshot")).toBe(true);
  });

  it("returns false for null", () => {
    expect(isNewSnapshot(null)).toBe(false);
  });

  it("returns false for an unrelated since string", () => {
    expect(isNewSnapshot("moved off PLAT-401 → incident")).toBe(false);
  });
});
