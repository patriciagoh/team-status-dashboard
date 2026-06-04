import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from https://patriciagoh.github.io/team-status-dashboard/
export default defineConfig({
  plugins: [react()],
  // Pages demo serves under the repo subpath (default); Vercel sets VITE_BASE=/.
  base: process.env.VITE_BASE || "/team-status-dashboard/",
});
