import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from https://patriciagoh.github.io/team-status-dashboard/
export default defineConfig({
  plugins: [react()],
  base: "/team-status-dashboard/",
});
