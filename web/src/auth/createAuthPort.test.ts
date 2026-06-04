// web/src/auth/createAuthPort.test.ts
import { describe, it, expect } from "vitest";
import { createAuthPort } from "./createAuthPort";

describe("createAuthPort", () => {
  it("returns null in the demo (non-supabase) build", async () => {
    // VITE_BACKEND is unset in tests → demo path
    expect(await createAuthPort()).toBeNull();
  });
});
