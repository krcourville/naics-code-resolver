import { test as base } from "@playwright/test";
import { expect, mockNaicsDataFailure } from "./mock-naics-data.ts";

// T88: both the default provider's hosts fail -> loadNaics() rejects (V49/V60)
// -> app shows an error state instead of hanging on "Loading…" forever (T84).
// Uses the un-mocked base test (no auto success-mock fixture) so it can wire
// its own failure routes before navigating.
base("shows an error state when both data hosts fail", async ({ page }) => {
  await mockNaicsDataFailure(page);
  await page.goto("/");
  await expect(page.locator("#naics-error")).toBeVisible();
  await expect(page.locator("#naics-loading")).toBeHidden();
});
