// web/src/useRoster.test.ts
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useRoster } from "./useRoster";
import type { RosterStore } from "./storage/RosterStore";
import type { RosterDoc } from "./types";

const base: RosterDoc = { engineers: [], corrections: {}, work: { syncedAt: null, states: {} } };

function fakeStore(over: Partial<RosterStore> = {}): RosterStore {
  return { load: async () => base, save: vi.fn(async () => {}), ...over };
}

describe("useRoster", () => {
  it("loads the doc from the store", async () => {
    const { result } = renderHook(() => useRoster(fakeStore()));
    await waitFor(() => expect(result.current.doc).not.toBeNull());
    expect(result.current.doc!.engineers).toEqual([]);
  });

  it("commit saves first, then updates state", async () => {
    const save = vi.fn(async () => {});
    const { result } = renderHook(() => useRoster(fakeStore({ save })));
    await waitFor(() => expect(result.current.doc).not.toBeNull());
    await act(async () => {
      await result.current.commit((d) => ({ ...d, engineers: [{ id: "e1", name: "X", role: "", team: "T", linearUserId: null, email: null }] }));
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.doc!.engineers).toHaveLength(1);
  });

  it("leaves state unchanged and rejects when save fails", async () => {
    const save = vi.fn(async () => { throw new Error("offline"); });
    const { result } = renderHook(() => useRoster(fakeStore({ save })));
    await waitFor(() => expect(result.current.doc).not.toBeNull());
    await act(async () => {
      await expect(result.current.commit((d) => ({ ...d, engineers: [{ id: "e1", name: "X", role: "", team: "T", linearUserId: null, email: null }] }))).rejects.toThrow("offline");
    });
    expect(result.current.doc!.engineers).toEqual([]);
  });
});
