// web/src/auth/supabaseAuthPort.ts
import type { AuthPort, Session } from "./AuthPort";
import { getSupabaseClient } from "../storage/supabaseClient";

export type SupaSession = { user: { id: string; email?: string | null } };

/** Minimal slice of supabase.auth used here — so the mapping is testable against a fake. */
export interface SupabaseAuthLike {
  getSession(): Promise<{ data: { session: SupaSession | null } }>;
  signInWithPassword(c: { email: string; password: string }): Promise<{ error: { message: string } | null }>;
  signOut(): Promise<{ error: { message: string } | null }>;
  onAuthStateChange(
    cb: (event: string, session: SupaSession | null) => void,
  ): { data: { subscription: { unsubscribe(): void } } };
}

function mapSession(s: SupaSession | null): Session | null {
  return s ? { userId: s.user.id, email: s.user.email ?? null } : null;
}

export function makeSupabaseAuthPort(auth: SupabaseAuthLike): AuthPort {
  return {
    async getSession() {
      const { data } = await auth.getSession();
      return mapSession(data.session);
    },
    async signIn(email, password) {
      const { error } = await auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    },
    async signOut() {
      const { error } = await auth.signOut();
      if (error) throw new Error(error.message);
    },
    onAuthChange(cb) {
      const { data } = auth.onAuthStateChange((_event, session) => cb(mapSession(session)));
      return () => data.subscription.unsubscribe();
    },
  };
}

/** Live binding over the shared Phase 1 client (one client for data + auth). */
export async function createSupabaseAuthPort(): Promise<AuthPort> {
  const supabase = await getSupabaseClient();
  const auth = supabase.auth;
  const adapter: SupabaseAuthLike = {
    getSession: () => auth.getSession().then((r) => ({ data: { session: r.data.session as SupaSession | null } })),
    signInWithPassword: (c) => auth.signInWithPassword(c).then((r) => ({ error: r.error })),
    signOut: () => auth.signOut().then((r) => ({ error: r.error })),
    onAuthStateChange: (cb) => auth.onAuthStateChange((event, session) => cb(event, session as SupaSession | null)),
  };
  return makeSupabaseAuthPort(adapter);
}
