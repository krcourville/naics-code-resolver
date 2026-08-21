import "./style.css";
import { configureDataProvider } from "@cajuncodemonkey/naics-search";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app.tsx";
import { spikeProvider, spikeRealProvider } from "./naics/spike.ts";

// T70: `?spike=1` (tiny fixture) / `?spike=real` (fetch() real data, README
// escape hatch) in dev bypass the default data provider for manual UX testing.
if (import.meta.env.DEV) {
  const spikeMode = new URLSearchParams(location.search).get("spike");
  if (spikeMode === "1") configureDataProvider(spikeProvider);
  else if (spikeMode === "real") configureDataProvider(spikeRealProvider);
}

createRoot(document.querySelector("#app")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
