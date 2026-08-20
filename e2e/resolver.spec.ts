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

// §V9/§C: Q&A must offer the model's own top-N candidates via a decision tree built from
// where their hierarchy paths diverge, not the full hierarchy — "hvac" is a known 2-way
// ambiguity (238220 vs 423730) that splits immediately at the sector level.
test("Q&A offers model candidates via decision tree, not the full hierarchy root", async ({
  page,
}) => {
  await page.goto("/?details=tree");
  await page.fill("#naics-input", "hvac");
  await page.click("#naics-submit");
  await expect(page.locator("#naics-qa")).toBeVisible();

  const groupButtons = page.locator("#naics-qa button[data-group]");
  const groups = await groupButtons.evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-group")),
  );
  expect(groups, "candidates diverge at the sector level").toEqual(
    expect.arrayContaining(["23", "42"]),
  );
  expect(groups.length, "branch choices, not the ~20 hierarchy sectors").toBeLessThan(10);
  await expect(page.locator("#naics-qa-browse")).toBeVisible();

  // pick the Wholesale Trade branch -> down to its single remaining candidate
  await page.locator('#naics-qa button[data-group="42"]').click();
  await page.locator('#naics-qa button[data-code="423730"]').click();
  const resultText = await page.locator("#naics-result").textContent();
  expect(resultText).toContain("423730");
  await expect(page.locator("#naics-qa")).toBeHidden();
});

test("Q&A 'browse full hierarchy' falls back to root sectors", async ({ page }) => {
  await page.goto("/?details=tree");
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
  await page.goto("/?details=tree");
  await page.fill("#naics-input", "hvac");
  await page.click("#naics-submit");
  await expect(page.locator("#naics-qa")).toBeVisible();
  // "hvac" candidates diverge at the sector level -> drill one branch down to the candidate list
  await page.locator('#naics-qa button[data-group="42"]').click();
  const defCount = await page.locator("#naics-qa button .definition").count();
  expect(defCount).toBeGreaterThan(0);
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

// §V28: user must see feedback while the model is loading, ⊥ a silent multi-second wait.
test("loading indicator shown until the model is ready", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#naics-loading")).toBeVisible();
  await expect(page.locator("#naics-loading")).toBeHidden(); // model load completes
});

// §V29: result panel + Q&A candidates link out to census.gov for the code shown, new tab.
test("result panel and Q&A candidates link to census.gov, opened in a new tab", async ({
  page,
}) => {
  await page.goto("/?details=tree");
  await page.fill("#naics-input", "hvac");
  await page.click("#naics-submit");

  const resultLink = page.locator("#naics-result .census-link");
  await expect(resultLink).toHaveAttribute("href", /census\.gov\/naics\/\?input=\d{6}/);
  await expect(resultLink).toHaveAttribute("target", "_blank");

  await page.locator('#naics-qa button[data-group="42"]').click();
  const candidateLink = page.locator("#naics-qa .census-link").first();
  await expect(candidateLink).toHaveAttribute("href", /census\.gov\/naics\/\?input=\d{6}/);
  await expect(candidateLink).toHaveAttribute("target", "_blank");
});
