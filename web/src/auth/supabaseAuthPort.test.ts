// web/src/auth/supabaseAuthPort.test.ts
import { describe, it, expect, vi } from "vitest";
import { makeSupabaseAuthPort, type SupabaseAuthLike, type SupaSession } from "./supabaseAuthPort";

function fakeAuth(over: Partial<SupabaseAuthLike> = {}): SupabaseAuthLike {
  return {
    getSession: async () => ({ data: { session: null } }),
    signInWithPassword: async () => ({ error: null }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    ...over,
  };
}

describe("makeSupabaseAuthPort", () => {
  it("maps a supabase session to {userId,email}", async () => {
    const auth = fakeAuth({ getSession: async () => ({ data: { session: { user: { id: "u1", email: "a@b.c" } } } }) });
    expect(await makeSupabaseAuthPort(auth).getSession()).toEqual({ userId: "u1", email: "a@b.c" });
  });

  it("returns null when there is no session", async () => {
    expect(await makeSupabaseAuthPort(fakeAuth()).getSession()).toBeNull();
  });

  it("signIn passes credentials through", async () => {
    const signInWithPassword = vi.fn(async () => ({ error: null }));
    await makeSupabaseAuthPort(fakeAuth({ signInWithPassword })).signIn("e@x.com", "pw");
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "e@x.com", password: "pw" });
  });

  it("signIn throws on error", async () => {
    const auth = fakeAuth({ signInWithPassword: async () => ({ error: { message: "bad" } }) });
    await expect(makeSupabaseAuthPort(auth).signIn("e", "p")).rejects.toThrow("bad");
  });

  it("onAuthChange maps sessions and unsubscribe calls the subscription", () => {
    const unsubscribe = vi.fn();
    let handler: ((e: string, s: SupaSession | null) => void) | null = null;
    const auth = fakeAuth({
      onAuthStateChange: (cb) => { handler = cb; return { data: { subscription: { unsubscribe } } }; },
    });
    const seen: Array<unknown> = [];
    const off = makeSupabaseAuthPort(auth).onAuthChange((s) => seen.push(s));
    handler!("SIGNED_IN", { user: { id: "u2", email: null } });
    expect(seen).toEqual([{ userId: "u2", email: null }]);
    off();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
