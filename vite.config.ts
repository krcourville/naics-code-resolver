import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  // data/*.json are generated compact (scripts/build-model.py, build-hierarchy.py) —
  // oxfmt pretty-prints JSON by default, which would silently re-inflate them on every commit.
  // SPEC.md's caveman encoding uses bare `~` for §T wip status — oxfmt's markdown formatter
  // doubles it to `~~` (strikethrough syntax), corrupting status cells (B13).
  fmt: { ignorePatterns: ["beacon/**", "packages/naics-search/src/data/**", "SPEC.md"] },
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
