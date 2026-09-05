import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

if (import.meta.env.VITE_SENTRY_DSN) {
  void import("./sentry")
    .then(({ initDashboardSentry }) => initDashboardSentry())
    .catch(() => undefined);
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
