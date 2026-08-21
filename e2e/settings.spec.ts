import { test, expect } from "./mock-naics-data.ts";

// §V16: shareable URL — `term` prefills + auto-runs the search.
test("term query param prefills input and auto-runs search", async ({ page }) => {
  await page.goto("/?term=home+health+care");
  await expect(page.locator("#naics-input")).toHaveValue("home health care");
  await expect(page.locator('#naics-result [data-code="621610"]')).toBeVisible();
});

// §V16: URL updates via replaceState on submit, not per keystroke (no history spam).
test("term syncs to URL on submit, not while typing", async ({ page }) => {
  await page.goto("/");
  const historyLenBeforeTyping = await page.evaluate(() => history.length);
  await page.fill("#naics-input", "hvac");
  expect(await page.evaluate(() => history.length)).toBe(historyLenBeforeTyping);
  expect(new URL(page.url()).searchParams.get("term")).toBeNull();

  await page.click("#naics-submit");
  await expect(page.locator("#naics-result [data-code]").first()).toBeVisible();
  expect(new URL(page.url()).searchParams.get("term")).toBe("hvac");
  expect(await page.evaluate(() => history.length)).toBe(historyLenBeforeTyping);
});

// definitions/examples hidden by default; the one "Show definitions" toggle in the
// settings Sheet reveals them on every item at once (§V4).
test("'Show definitions' toggle in settings reveals every item's definition", async ({ page }) => {
  await page.goto("/?term=hvac");
  await expect(page.locator('[data-slot="item-description"]')).toHaveCount(0);

  await page.click("#settings-trigger");
  await page.check("#setting-showdef");
  await expect(page.locator('[data-slot="item-description"]')).toHaveCount(2);
});

// showDef=1 -> definitions pre-expanded, toggle pre-checked, no click needed.
test("showDef=1 pre-expands item definitions", async ({ page }) => {
  await page.goto("/?term=hvac&showDef=1");
  await expect(page.locator('[data-slot="item-description"]')).toHaveCount(2);
  await page.click("#settings-trigger");
  await expect(page.locator("#setting-showdef")).toBeChecked();
});

// §V18: floor narrows the whole results list (§V14: no separate primary result to spare).
test("floor filters the results list", async ({ page }) => {
  await page.goto("/?term=hvac&floor=0.5");
  await expect(page.locator("#naics-result [data-code]")).toHaveCount(1); // "hvac": .65 kept, .35 dropped
});

// §V7: floor emptying the whole pool shows the empty state, not a blank/crashed page.
test("floor emptying the candidate pool shows the empty state", async ({ page }) => {
  await page.goto("/?term=hvac&floor=0.99");
  await expect(page.locator("#naics-empty")).toBeVisible();
  await expect(page.locator("#naics-result [data-code]")).toHaveCount(0);
});

// §V15: settings persist to localStorage and survive a reload without query params.
test("settings persist to localStorage across reloads", async ({ page }) => {
  await page.goto("/");
  await page.click("#settings-trigger");
  await page.fill("#setting-floor", "0.3");
  await page.dispatchEvent("#setting-floor", "change");
  await page.check("#setting-showdef");

  await page.goto("/"); // fresh load, no query params
  await page.click("#settings-trigger");
  await expect(page.locator("#setting-floor")).toHaveValue("0.3");
  await expect(page.locator("#setting-showdef")).toBeChecked();
});

// §V21/§V13: malformed/stale localStorage settings must not crash the app.
test("malformed naics-settings localStorage does not crash the app", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    localStorage.setItem("naics-settings", "{not json");
  });
  await page.goto("/");
  await page.click("#settings-trigger");
  await expect(page.locator("#setting-floor")).toHaveValue("0");
  expect(errors).toEqual([]);
});

// §V13: a stale `details` field from before this redesign parses without error.
test("stale 'details' field in localStorage does not crash the app", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    localStorage.setItem(
      "naics-settings",
      JSON.stringify({ details: "tree", showDef: true, floor: 0.2 }),
    );
  });
  await page.goto("/");
  await page.click("#settings-trigger");
  await expect(page.locator("#setting-floor")).toHaveValue("0.2");
  await expect(page.locator("#setting-showdef")).toBeChecked();
  expect(errors).toEqual([]);
});
