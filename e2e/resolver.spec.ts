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
