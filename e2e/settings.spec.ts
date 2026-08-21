import { test, expect } from "./mock-naics-data.ts";

// §V16: shareable URL — `term` prefills + auto-runs the search.
test("term query param prefills input and auto-runs search", async ({ page }) => {
  await page.goto("/?term=home+health+care");
  await expect(page.locator("#naics-input")).toHaveValue("home health care");
  await expect(page.locator("#naics-result .code")).toHaveText("621610");
});

// §V16: URL updates via replaceState on submit, not per keystroke (no history spam).
test("term syncs to URL on submit, not while typing", async ({ page }) => {
  await page.goto("/");
  const historyLenBeforeTyping = await page.evaluate(() => history.length);
  await page.fill("#naics-input", "hvac");
  expect(await page.evaluate(() => history.length)).toBe(historyLenBeforeTyping);
  expect(new URL(page.url()).searchParams.get("term")).toBeNull();

  await page.click("#naics-submit");
  await expect(page.locator("#naics-result")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("term")).toBe("hvac");
  expect(await page.evaluate(() => history.length)).toBe(historyLenBeforeTyping);
});

// §V17: detailsMode=list -> flat candidate rows instead of the decision tree.
test("detailsMode=list shows a flat candidate list, not the decision tree", async ({ page }) => {
  await page.goto("/?term=hvac&details=list");
  await expect(page.locator("#naics-qa")).toBeVisible();
  await expect(page.locator("#naics-qa .qa-list-row")).toHaveCount(2);
  await expect(page.locator("#naics-qa button[data-group]")).toHaveCount(0);
});

// list row: no definitions rendered until the one "Show definitions" toggle above the list is
// checked (§V17); clicking anywhere on the row card picks that code straight away.
test("list mode: 'Show definitions' toggle reveals all rows' definitions, row click picks a code", async ({
  page,
}) => {
  await page.goto("/?term=hvac&details=list");
  await expect(page.locator(".definition")).toHaveCount(0);

  await page.check("#qa-list-showdef");
  await expect(page.locator(".qa-list-row .definition")).toHaveCount(2);

  await page.locator(".qa-list-row").first().click();
  await expect(page.locator("#naics-qa")).toBeHidden();
  await expect(page.locator("#naics-result .code")).toBeVisible();
});

// alwaysShowDefinition=1 -> list rows pre-expanded, toggle pre-checked, no click needed.
test("showDef=1 pre-expands list row definitions", async ({ page }) => {
  await page.goto("/?term=hvac&details=list&showDef=1");
  await expect(page.locator("#qa-list-showdef")).toBeChecked();
  await expect(page.locator(".qa-list-row").first().locator(".definition")).toBeVisible();
});

// §V18: floor narrows the candidate pool without affecting the primary result or the band decision.
test("floor filters the Q&A candidate pool, primary result unaffected", async ({ page }) => {
  await page.goto("/?term=hvac&details=list&floor=0.5");
  await expect(page.locator("#naics-result .code")).toBeVisible(); // still shown regardless of floor
  await expect(page.locator("#naics-qa .qa-list-row")).toHaveCount(1); // "hvac": .65 kept, .35 dropped
});

// §V18: floor emptying the whole pool falls back to the full hierarchy browse, not a blank list.
test("floor emptying the candidate pool falls back to hierarchy browse", async ({ page }) => {
  await page.goto("/?term=hvac&floor=0.99");
  await expect(page.locator("#naics-qa")).toBeVisible();
  const optionCount = await page.locator("#naics-qa button[data-code]").count();
  expect(optionCount).toBeGreaterThan(10); // full hierarchy root, not a blank list
});

// §V15: gear settings UI persists to localStorage and survives a reload without query params.
test("settings persist to localStorage across reloads", async ({ page }) => {
  await page.goto("/");
  await page.click("#settings-panel summary");
  await page.selectOption("#setting-details", "tree"); // away from default (list) to prove it stuck
  await page.fill("#setting-floor", "0.3");
  await page.dispatchEvent("#setting-floor", "change");

  await page.goto("/"); // fresh load, no query params
  await expect(page.locator("#setting-details")).toHaveValue("tree");
  await expect(page.locator("#setting-floor")).toHaveValue("0.3");
});

// §V21: malformed localStorage settings must not crash the app — falls back to defaults.
test("malformed naics-settings localStorage does not crash the app", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    localStorage.setItem("naics-settings", "{not json");
  });
  await page.goto("/");
  await expect(page.locator("#setting-details")).toHaveValue("list");
  expect(errors).toEqual([]);
});
