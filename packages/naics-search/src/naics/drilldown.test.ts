import { describe, expect, test } from "vite-plus/test";
import { drilldownOptions, isResolved } from "./drilldown.ts";
import type { HierarchyTree } from "./hierarchy.ts";

// Tiny 3-level tree mirroring official structure depth (sector -> industry group -> national industry).
const tree: HierarchyTree = {
  "11": {
    code: "11",
    title: "Agriculture",
    children: {
      "1111": {
        code: "1111",
        title: "Oilseed and Grain Farming",
        children: {
          "111110": { code: "111110", title: "Soybean Farming", children: {} },
          "111120": { code: "111120", title: "Oilseed Farming", children: {} },
        },
      },
    },
  },
  "22": { code: "22", title: "Utilities", children: {} },
};

describe("drilldownOptions", () => {
  test("root (null code) -> top-level sectors, sorted by code", () => {
    expect(drilldownOptions(tree, null)).toEqual([
      { code: "11", title: "Agriculture" },
      { code: "22", title: "Utilities" },
    ]);
  });

  test("intermediate code -> its children only", () => {
    expect(drilldownOptions(tree, "11")).toEqual([
      { code: "1111", title: "Oilseed and Grain Farming" },
    ]);
  });

  test("leaf 6-digit code -> no further options", () => {
    expect(drilldownOptions(tree, "111110")).toEqual([]);
  });

  test("unknown code -> no options", () => {
    expect(drilldownOptions(tree, "999999")).toEqual([]);
  });
});

describe("isResolved (§V3: final code must be a confirmed 6-digit NAICS code)", () => {
  test("6-digit leaf is resolved", () => {
    expect(isResolved(tree, "111110")).toBe(true);
  });

  test("intermediate node with children is not resolved", () => {
    expect(isResolved(tree, "1111")).toBe(false);
  });

  test("sector with no children in fixture still reports resolved by structure, not digit count", () => {
    // "22" has no children in this tiny fixture even though it's a 2-digit
    // sector code in reality — isResolved trusts tree structure, not code length.
    expect(isResolved(tree, "22")).toBe(true);
  });

  test("unknown code is not resolved", () => {
    expect(isResolved(tree, "999999")).toBe(false);
  });
});

describe("full drill-down path reaches a single 6-digit code", () => {
  test("root -> sector -> group -> leaf terminates at exactly one resolved code", () => {
    let code: string | null = null;
    let steps = 0;
    while (true) {
      const options = drilldownOptions(tree, code);
      if (options.length === 0) break;
      code = options[0].code;
      steps++;
      if (steps > 10) throw new Error("drill-down did not terminate");
    }
    expect(code).toBe("111110");
    expect(isResolved(tree, code!)).toBe(true);
  });
});
