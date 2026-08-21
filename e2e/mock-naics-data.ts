import { test as base, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";

const DATA_DIR = fileURLToPath(new URL("../packages/naics-search/src/data/", import.meta.url));

function dataFilePath(url: string): string {
  return `${DATA_DIR}${url.includes("naics-hierarchy.json") ? "naics-hierarchy.json" : "naics-model.json"}`;
}

/**
 * Routes the default provider's unpkg URL (V49) to local fixture data — the
 * real `@cajuncodemonkey/naics-search-data` package/GitHub Release doesn't
 * exist until a real tag is published (V61), so e2e can't hit the live CDN.
 */
async function mockNaicsData(page: Page): Promise<void> {
  await page.route("https://unpkg.com/@cajuncodemonkey/naics-search-data*/**", (route) =>
    route.fulfill({ path: dataFilePath(route.request().url()) }),
  );
}

/** Same URL pattern as the default mock, but delayed — for the §V28 2s-delay-gated loading text test. */
export async function mockNaicsDataSlow(page: Page, delayMs: number): Promise<void> {
  await page.route("https://unpkg.com/@cajuncodemonkey/naics-search-data*/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.fulfill({ path: dataFilePath(route.request().url()) });
  });
}

/** Same URL pattern, but both the primary AND fallback hosts fail — for the loadNaics() rejection path (T88/V49/V60). */
export async function mockNaicsDataFailure(page: Page): Promise<void> {
  await page.route("https://unpkg.com/@cajuncodemonkey/naics-search-data*/**", (route) =>
    route.fulfill({ status: 500, body: "mocked failure" }),
  );
  await page.route(
    "https://github.com/krcourville/naics-code-resolver/releases/download/**",
    (route) => route.fulfill({ status: 500, body: "mocked failure" }),
  );
}

export const test = base.extend<{ mockedNaicsData: void }>({
  mockedNaicsData: [
    async ({ page }, use) => {
      await mockNaicsData(page);
      await use();
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
