import { test, expect } from "@playwright/test";
import { TEST_CASES, type TestCaseCategory } from "../src/naics/test-cases.ts";

const RESULT_RE = /confidence: (\d\.\d\d) \((high|medium|low)\)/;

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
    await expect(page.locator("#naics-result")).toBeVisible();

    const resultText = await page.locator("#naics-result").textContent();
    expect(errors, `no runtime errors for "${description}"`).toEqual([]);

    const match = resultText?.match(RESULT_RE);
    if (!match) {
      // §V3 exception: legitimately unmapped input (edge case) — must fail
      // gracefully, not crash.
      expect(category, `unmatched result only expected for edge cases: "${description}"`).toBe(
        "edge",
      );
      return;
    }

    const [, score, label] = match;
    bandTally[category][label] = (bandTally[category][label] ?? 0) + 1;

    const code = resultText?.match(/^\s*(\d{6})/)?.[1];
    expect(code, `§V3: displayed code must be a valid 6-digit NAICS code`).toMatch(/^\d{6}$/);
    expect(Number(score)).toBeGreaterThanOrEqual(0);
    expect(Number(score)).toBeLessThanOrEqual(1);

    // §V2: medium/low band always offers Q&A. (high band's offer depends on
    // top-2 margin, not observable from the DOM alone, so it's not asserted.)
    if (label !== "high") {
      await expect(page.locator("#naics-qa")).toBeVisible();
    }
  });
}

test.afterAll(() => {
  console.log("confidence band distribution:", JSON.stringify(bandTally, null, 2));
});

// §V9: Q&A must offer the model's own top-N candidates, not the full
// hierarchy — "hvac" is a known 2-way ambiguity (238220 vs 423730).
test("Q&A offers model candidates, not the full hierarchy root", async ({ page }) => {
  await page.goto("/");
  await page.fill("#naics-input", "hvac");
  await page.click("#naics-submit");
  await expect(page.locator("#naics-qa")).toBeVisible();

  const qaButtons = page.locator("#naics-qa button[data-code]");
  const codes = await qaButtons.evaluateAll((els) => els.map((el) => el.getAttribute("data-code")));
  expect(codes).toContain("238220");
  expect(codes).toContain("423730");
  expect(codes.length, "candidate picks, not the ~20 hierarchy sectors").toBeLessThan(10);
  await expect(page.locator("#naics-qa-browse")).toBeVisible();

  // picking a candidate resolves straight to it (§V3), no intermediate hierarchy step
  await page.locator('#naics-qa button[data-code="423730"]').click();
  const resultText = await page.locator("#naics-result").textContent();
  expect(resultText).toContain("423730");
  await expect(page.locator("#naics-qa")).toBeHidden();
});

test("Q&A 'browse full hierarchy' falls back to root sectors", async ({ page }) => {
  await page.goto("/");
  await page.fill("#naics-input", "hvac");
  await page.click("#naics-submit");
  await page.click("#naics-qa-browse");
  const optionCount = await page.locator("#naics-qa button[data-code]").count();
  expect(optionCount).toBeGreaterThan(10); // full hierarchy root, not the 2 candidates
});

// §V10: definition + illustrative examples shown when present (result panel and
// Q&A candidate picks), and absence never crashes the UI.
test("result panel shows definition + illustrative examples when present", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("/");
  await page.fill("#naics-input", "home health care");
  await page.click("#naics-submit");
  await expect(page.locator("#naics-result .code")).toHaveText("621610");
  await expect(page.locator("#naics-result .definition")).toContainText(
    "skilled nursing services in the home",
  );
  await expect(page.locator("#naics-result .examples li")).toHaveCount(4);
  await expect(page.locator("#naics-result .examples")).toContainText(
    "Visiting nurse associations",
  );
  expect(errors).toEqual([]);
});

test("Q&A candidate picks show a definition snippet to help choose", async ({ page }) => {
  await page.goto("/");
  await page.fill("#naics-input", "hvac");
  await page.click("#naics-submit");
  await expect(page.locator("#naics-qa")).toBeVisible();
  const defCount = await page.locator("#naics-qa button .definition").count();
  expect(defCount).toBeGreaterThan(0);
});
