import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  workers: 1, // single worker so the confidence-band tally in resolver.spec.ts sums across all cases
  reporter: "list",
  // model+hierarchy are ~40MB static JSON (pkg ships them as real .json assets, native
  // JSON.parse, not bundled-as-JS). Prod-build load is ~800ms once the OS page cache is
  // warm, but the very first request against a freshly-started `vp preview` (page cache
  // cold) still measured ~6s (R10) — headroom for that first-test cold hit, not a hang mask.
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:5173",
  },
  webServer: {
    // Prod build + vp preview, not vp dev (R10): dev's JSON `import()` runs through
    // Vite's JS-module transform pipeline, inflating cold-load ~6x vs real prod UX.
    command: "pnpm run build && vp preview --port 5173",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
