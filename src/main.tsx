import "./style.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";

createRoot(document.querySelector("#app")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
