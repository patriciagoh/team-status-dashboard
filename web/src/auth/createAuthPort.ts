// web/src/auth/createAuthPort.ts
import type { AuthPort } from "./AuthPort";

export async function createAuthPort(): Promise<AuthPort | null> {
  if (import.meta.env.VITE_BACKEND === "supabase") {
    const { createSupabaseAuthPort } = await import("./supabaseAuthPort");
    return createSupabaseAuthPort();
  }
  return null; // demo: no auth, SDK stays out of the bundle
}
