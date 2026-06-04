// web/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import "matcha-oat-design-system/tokens.css";
// Self-hosted fonts (no Google Fonts @import → no visitor-IP leak). Only the
// weights/styles the Matcha Oat tokens use; Sacramento (--script) is unused.
import "@fontsource/newsreader/400.css";
import "@fontsource/newsreader/500.css";
import "@fontsource/newsreader/600.css";
import "@fontsource/newsreader/400-italic.css";
import "@fontsource/newsreader/500-italic.css";
import "@fontsource/hanken-grotesk/400.css";
import "@fontsource/hanken-grotesk/500.css";
import "@fontsource/hanken-grotesk/600.css";
import "@fontsource/hanken-grotesk/700.css";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import "./tokens.categories.css";
import "./index.css";
import { Root } from "./Root";
import { createAuthPort } from "./auth/createAuthPort";

createAuthPort()
  .then((authPort) => {
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <Root authPort={authPort} />
      </React.StrictMode>,
    );
  })
  .catch((err) => {
    // e.g. missing/invalid Supabase env in the real build — show something, not a blank screen.
    console.error("Failed to start:", err);
    const root = document.getElementById("root");
    if (root) {
      root.textContent = "Failed to start. Check the app configuration.";
    }
  });
