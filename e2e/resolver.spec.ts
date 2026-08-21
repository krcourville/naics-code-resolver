import { mockNaicsDataSlow, test, expect } from "./mock-naics-data.ts";
import { TEST_CASES, type TestCaseCategory } from "../apps/naics-resolver/src/naics/test-cases.ts";

// Tallies actual band distribution per category so §C's provisional
// thresholds can be eyeballed/tuned against the curated list (T10, T11).
const bandTally: Record<TestCaseCategory, Record<string, number>> = {
  clear: {},
  ambiguous: {},
  edge: {},
};

for (const { description, category } of TEST_CASES) {
  test(`"${description}" (${category})`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.goto("/");
    await page.fill("#naics-input", description);
    await page.click("#naics-submit");

    const items = page.locator("#naics-result [data-code]");
    const emptyState = page.locator("#naics-empty");
    await expect(items.first().or(emptyState)).toBeVisible();
    expect(errors, `no runtime errors for "${description}"`).toEqual([]);

    const count = await items.count();
    if (count === 0) {
      // §V3 exception: legitimately unmapped input (edge case) — must fail
      // gracefully, not crash.
      expect(category, `unmatched result only expected for edge cases: "${description}"`).toBe(
        "edge",
      );
      return;
    }

    const code = await items.first().getAttribute("data-code");
    expect(code, `§V3: displayed code must be a valid 6-digit NAICS code`).toMatch(/^\d{6}$/);

    const confText = (await items.first().textContent()) ?? "";
    const match = confText.match(/(🟢|🟡|🔴)\s*(\d\.\d\d)/);
    if (match) {
      const [, emoji, score] = match;
      const label = emoji === "🟢" ? "high" : emoji === "🟡" ? "medium" : "low";
      bandTally[category][label] = (bandTally[category][label] ?? 0) + 1;
      expect(Number(score)).toBeGreaterThanOrEqual(0);
      expect(Number(score)).toBeLessThanOrEqual(1);
    }
  });
}

test.afterAll(() => {
  console.log("confidence band distribution:", JSON.stringify(bandTally, null, 2));
});

// §V5/§V14: results always render as a full ranked list, ∀ confidence tier — no
// confidence-gated hero/list split, even for an unambiguous high-confidence match.
test("results list shows all top candidates regardless of confidence", async ({ page }) => {
  await page.goto("/");
  await page.fill("#naics-input", "home health care");
  await page.click("#naics-submit");
  const items = page.locator("#naics-result [data-code]");
  await expect(items.first()).toBeVisible();
  expect(await items.count()).toBeGreaterThan(1);
  await expect(items.first()).toHaveAttribute("data-code", "621610");
});

test("result item shows definition + illustrative examples when 'Show definitions' is on", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/?showDef=1");
  await page.fill("#naics-input", "home health care");
  await page.click("#naics-submit");

  const first = page.locator('#naics-result [data-code="621610"]');
  await expect(first.locator('[data-slot="item-description"]')).toContainText(
    "skilled nursing services in the home",
  );
  await expect(first.locator("li")).toHaveCount(4);
  await expect(first.locator("ul")).toContainText("Visiting nurse associations");
  expect(errors).toEqual([]);
});

test("'How does it work?' link points to the README section on GitHub", async ({ page }) => {
  await page.goto("/");
  const link = page.locator('a:has-text("How does it work?")');
  await expect(link).toHaveAttribute(
    "href",
    "https://github.com/krcourville/naics-code-resolver#how-does-it-work",
  );
  await expect(link).toHaveAttribute("target", "_blank");
});

// §V8: fast (mocked, <2s) load never flashes a loading skeleton.
test("skeleton stays hidden on a fast load", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#naics-skeleton")).toBeHidden();
  await expect(page.locator("#naics-input")).toBeEnabled(); // model ready
  await expect(page.locator("#naics-skeleton")).toBeHidden();
});

// §V8: a load past the 2s delay still shows feedback, ⊥ a silent multi-second wait.
test("skeleton shown once a slow load passes the 2s delay", async ({ page }) => {
  await mockNaicsDataSlow(page, 2500);
  await page.goto("/");
  await page.fill("#naics-input", "hvac");
  await page.click("#naics-submit");
  await expect(page.locator("#naics-skeleton")).toBeVisible();
  await expect(page.locator("#naics-skeleton")).toBeHidden(); // model load + predict completes
  await expect(page.locator("#naics-result [data-code]").first()).toBeVisible();
});

// §V29: every result item links out to census.gov for its code, new tab.
test("result items link to census.gov, opened in a new tab", async ({ page }) => {
  await page.goto("/");
  await page.fill("#naics-input", "hvac");
  await page.click("#naics-submit");

  const link = page.locator("#naics-result .census-link").first();
  await expect(link).toHaveAttribute("href", /census\.gov\/naics\/\?input=\d{6}/);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveText(/\d{6}/); // link text includes the naics code
});
