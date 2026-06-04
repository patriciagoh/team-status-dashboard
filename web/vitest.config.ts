import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // Pin the build-flag env so the suite is deterministic regardless of a
    // developer's .env.local (e.g. VITE_BACKEND=supabase for the real app).
    // Unit tests exercise the demo/local + null-auth defaults; the supabase
    // paths are covered by the live test, not unit tests.
    env: { VITE_BACKEND: "", VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "" },
  },
});
