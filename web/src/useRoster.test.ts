// web/src/useRoster.test.ts
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useRoster } from "./useRoster";
import type { RosterStore } from "./storage/RosterStore";
import type { RosterData } from "./types";

const base: RosterData = { teams: [], snapshot: { day: "old", time: "old", prev: "", next: "", slackConnected: false } };

function fakeStore(over: Partial<RosterStore> = {}): RosterStore {
  return { load: async () => base, save: vi.fn(async () => {}), ...over };
}

describe("useRoster", () => {
  it("loads the roster from the store", async () => {
    const { result } = renderHook(() => useRoster(fakeStore()));
    await waitFor(() => expect(result.current.roster).not.toBeNull());
    expect(result.current.roster!.teams).toEqual([]);
  });

  it("commit saves first, then updates state and refreshes the snapshot", async () => {
    const save = vi.fn(async () => {});
    const { result } = renderHook(() => useRoster(fakeStore({ save })));
    await waitFor(() => expect(result.current.roster).not.toBeNull());

    await act(async () => {
      await result.current.commit((r) => ({ ...r, teams: [{ name: "T", lead: "", people: [] }] }));
    });

    expect(save).toHaveBeenCalledTimes(1);
    const saved = (save.mock.calls[0] as unknown[])[0] as RosterData;
    expect(saved.teams).toHaveLength(1);
    expect(saved.snapshot.day).not.toBe("old"); // snapshot refreshed to "now"
    expect(result.current.roster!.teams).toHaveLength(1);
  });

  it("leaves state unchanged and rejects when save fails", async () => {
    const save = vi.fn(async () => { throw new Error("offline"); });
    const { result } = renderHook(() => useRoster(fakeStore({ save })));
    await waitFor(() => expect(result.current.roster).not.toBeNull());

    await act(async () => {
      await expect(
        result.current.commit((r) => ({ ...r, teams: [{ name: "T", lead: "", people: [] }] })),
      ).rejects.toThrow("offline");
    });

    expect(result.current.roster!.teams).toEqual([]); // unchanged
  });
});
