import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  // GitHub Pages project site: served at /naics-code-resolver/, not root.
  base: "/naics-code-resolver/",
  plugins: [react()],
  staged: {
    "*": "vp check --fix",
  },
  // data/*.json are generated compact (scripts/build-model.py, build-hierarchy.py) —
  // oxfmt pretty-prints JSON by default, which would silently re-inflate them on every commit.
  fmt: { ignorePatterns: ["beacon/**", "packages/naics-search/src/data/**"] },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: ["beacon/**"],
  },
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
  },
});
