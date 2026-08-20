import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  // GitHub Pages project site: served at /naics-code-resolver/, not root.
  base: "/naics-code-resolver/",
  plugins: [react()],
});
