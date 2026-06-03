import React from "react";
import ReactDOM from "react-dom/client";
import "matcha-oat-design-system/tokens.css";
import "matcha-oat-design-system/fonts.css";
import "./tokens.categories.css";
import "./index.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
