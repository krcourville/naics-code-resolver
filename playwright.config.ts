import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  workers: 1, // single worker so the confidence-band tally in resolver.spec.ts sums across all cases
  reporter: "list",
  // model+hierarchy are ~40MB static JSON (pkg ships them as real .json assets, native
  // JSON.parse, not bundled-as-JS) — a cold first load takes ~5s. Headroom over the
  // observed ~4.5-6s, not a hang mask.
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:5173",
  },
  webServer: {
    command: "vp dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
