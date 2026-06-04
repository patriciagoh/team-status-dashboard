// web/src/storage/createRosterStore.test.ts
import { describe, it, expect, afterEach, vi } from "vitest";
import { createRosterStore } from "./createRosterStore";

afterEach(() => vi.unstubAllEnvs());

describe("createRosterStore", () => {
  it("returns the read-only local store by default", async () => {
    // VITE_BACKEND is unset in tests → local path
    const store = await createRosterStore();
    await expect(store.save({} as never)).rejects.toThrow(/read-only/);
  });
});
