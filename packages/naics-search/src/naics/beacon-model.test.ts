import { describe, expect, test } from "vite-plus/test";
import { BeaconModel, type BeaconParams } from "./beacon-model.ts";
import fixtureParams from "./__fixtures__/tiny-model.json" with { type: "json" };

// Oracle: Python BeaconModel.predict_proba() fit on the same tiny synthetic
// dataset used by scripts/build_model_test.py, params exported via
// scripts/build-model.py's export_model(). Proves the TS scoring port (§V6)
// matches the real algorithm, not just the stemmer.
const ORACLE: Record<string, Record<string, number>> = {
  "corn farm": { "111110": 0.5, "111150": 0.5 },
  "grocery store": { "445110": 0.9999975001249938, "445120": 2.499875006249689e-6 },
  wheat: { "111150": 1.0 },
  "gas station": { "445120": 1.0 },
  "random text zzz": {},
};

describe("BeaconModel.predictProba parity vs Python", () => {
  const model = new BeaconModel(fixtureParams as BeaconParams);

  test.each(Object.entries(ORACLE))("%s", (query, expected) => {
    const actual = model.predictProba(query);
    const actualPositive = Object.fromEntries(Object.entries(actual).filter(([, v]) => v > 0.0));
    expect(Object.keys(actualPositive).sort()).toEqual(Object.keys(expected).sort());
    for (const naics in expected) {
      expect(actualPositive[naics]).toBeCloseTo(expected[naics], 9);
    }
  });
});
