import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite-plus";

export default defineConfig({
  // GitHub Pages project site: served at /naics-code-resolver/, not root.
  base: "/naics-code-resolver/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
});
