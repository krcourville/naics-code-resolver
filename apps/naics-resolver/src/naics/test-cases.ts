/** Curated business-description test cases driving the Playwright suite (T11),
 * which tunes the §C confidence bands against real predictions. `category`
 * is a coverage tag, not an expected outcome — thresholds are provisional. */
export type TestCaseCategory = "clear" | "ambiguous" | "edge";

export interface TestCase {
  description: string;
  category: TestCaseCategory;
}

export const TEST_CASES: TestCase[] = [
  // clear: one obvious sector/industry, expect high band, no Q&A
  { description: "retail bakery", category: "clear" },
  { description: "corn farm", category: "clear" },
  { description: "blueberry farm", category: "clear" },
  { description: "gas station", category: "clear" },
  { description: "gasoline station", category: "clear" },
  { description: "pharmacy", category: "clear" },
  { description: "apothecary", category: "clear" },
  { description: "grocery store", category: "clear" },
  { description: "convenience store", category: "clear" },
  { description: "pet store", category: "clear" },
  { description: "gift store", category: "clear" },
  { description: "florist", category: "clear" },
  { description: "fast food restaurant", category: "clear" },
  { description: "commercial photography", category: "clear" },
  { description: "sporting goods manufacturing", category: "clear" },
  { description: "toy wholesaler", category: "clear" },
  { description: "residential remodeling", category: "clear" },
  { description: "landscape architect", category: "clear" },
  { description: "car repair", category: "clear" },

  // ambiguous: plausible in multiple NAICS branches, expect medium/low band + Q&A
  { description: "car dealer", category: "ambiguous" },
  { description: "new car dealership", category: "ambiguous" },
  { description: "landscaping", category: "ambiguous" },
  { description: "consultant", category: "ambiguous" },
  { description: "medical doctor", category: "ambiguous" },
  { description: "contractor", category: "ambiguous" },
  { description: "online store", category: "ambiguous" },
  { description: "cleaning service", category: "ambiguous" },
  { description: "hvac", category: "ambiguous" },

  // edge: empty/unmapped input, must not crash the inference or UI
  { description: "gobbledygook", category: "edge" },
  { description: "random text zzz", category: "edge" },
  { description: "a", category: "edge" },
];
