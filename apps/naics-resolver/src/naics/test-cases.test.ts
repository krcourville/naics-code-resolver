import { describe, expect, test } from "vite-plus/test";
import { TEST_CASES } from "./test-cases.ts";

describe("TEST_CASES", () => {
  test("covers every category at least once", () => {
    const categories = new Set(TEST_CASES.map((c) => c.category));
    expect(categories).toEqual(new Set(["clear", "ambiguous", "edge"]));
  });

  test("descriptions are non-empty and unique", () => {
    const descriptions = TEST_CASES.map((c) => c.description);
    expect(descriptions.every((d) => d.trim().length > 0)).toBe(true);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });

  test("has enough cases for meaningful band tuning", () => {
    expect(TEST_CASES.length).toBeGreaterThanOrEqual(20);
  });
});
