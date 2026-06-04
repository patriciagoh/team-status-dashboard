// web/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import "matcha-oat-design-system/tokens.css";
import "matcha-oat-design-system/fonts.css";
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
