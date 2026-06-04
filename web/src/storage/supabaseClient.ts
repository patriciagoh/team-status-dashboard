// web/src/storage/supabaseClient.ts
// Single shared Supabase client for data + auth (auth wired in Phase 2).
// Dynamic-imports the SDK so it is absent from the demo (VITE_BACKEND=local) bundle.
import type { SupabaseClient } from "@supabase/supabase-js";

let clientPromise: Promise<SupabaseClient> | null = null;

export function getSupabaseClient(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(
        import.meta.env.VITE_SUPABASE_URL as string,
        import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      ),
    );
  }
  return clientPromise;
}
