import { defineConfig } from "vite-plus";

export default defineConfig({
  // GitHub Pages project site: served at /naics-code-resolver/, not root.
  base: "/naics-code-resolver/",
  staged: {
    "*": "vp check --fix",
  },
  fmt: { ignorePatterns: ["beacon/**"] },
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
