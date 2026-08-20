import { describe, expect, test } from "vite-plus/test";
import { cleanText } from "./stem.ts";

// Oracle: beacon/beacon_example_output.txt (BUSINESS DESCRIPTION -> CLEAN TEXT),
// produced by the real Python BeaconModel.clean_text().
const ORACLE: Array<[string, string]> = [
  ["blueberry farm", "blueberri farm"],
  ["residential remodeling", "residenti remodel"],
  ["retail bakery", "retail bakeri"],
  ["sporting goods manufacturing", "sport good manufactur"],
  ["toy wholesaler", "toy wholesal"],
  ["car dealer", "car dealer"],
  ["new car dealership", "new car dealership"],
  ["apothecary", "apothecari"],
  ["pharmacy", "pharmaci"],
  ["convenience store", "conveni store"],
  ["pet store", "pet store"],
  ["commercial photography", "commerci photograph"],
  ["gasoline station", "gasolin station"],
  ["gift store", "gift store"],
  ["florist", "florist"],
  ["consultant", "consult"],
  ["landscaping", "landscap"],
  ["landscape architect", "landscap architect"],
  ["medical doctor", "medic doctor"],
  ["fast food restaurant", "fast food restaur"],
  ["car repair", "car repair"],
  ["gobbledygook", "gobbledygook"],
];

describe("cleanText", () => {
  test.each(ORACLE)("%s -> %s", (input, expected) => {
    expect(cleanText(input)).toBe(expected);
  });
});
