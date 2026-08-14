import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vite-plus/test";
import { BeaconModel, type BeaconParams } from "./beacon-model.ts";

/**
 * §V6/T5: parity vs the real Python BeaconModel, fit on the same 2017 census
 * data (default hyperparams) as beacon/beacon_example.py. Oracle values are
 * copied verbatim from beacon/beacon_example_output.txt — do not hand-tune.
 */
const modelPath = fileURLToPath(new URL("../../public/naics-model.json", import.meta.url));
const params = JSON.parse(readFileSync(modelPath, "utf-8")) as BeaconParams;
const model = new BeaconModel(params);

const PREDICT_ORACLE: Array<[string, string]> = [
  ["blueberry farm", "111334"],
  ["residential remodeling", "236118"],
  ["retail bakery", "311811"],
  ["sporting goods manufacturing", "339920"],
  ["toy wholesaler", "423920"],
  ["car dealer", "441120"],
  ["new car dealership", "441110"],
  ["apothecary", "446110"],
  ["pharmacy", "446110"],
  ["convenience store", "445120"],
  ["pet store", "453910"],
  ["commercial photography", "541922"],
  ["gasoline station", "447110"],
  ["gift store", "453220"],
  ["florist", "453110"],
  ["consultant", "541611"],
  ["landscaping", "561730"],
  ["landscape architect", "541320"],
  ["medical doctor", "621111"],
  ["fast food restaurant", "722513"],
  ["car repair", "811111"],
  ["gobbledygook", ""],
];

const RESTAURANT_ORACLE: Record<string, number> = {
  "492210": 0.017431492207497463,
  "561720": 0.02150706185676149,
  "722511": 0.4358003060020304,
  "722513": 0.4813180151544924,
};

const DEALER_TOP10_ORACLE = [
  "441120",
  "441110",
  "441320",
  "441228",
  "454310",
  "441222",
  "444190",
  "441310",
  "453930",
  "441210",
];

describe("BeaconModel parity vs Python (real 2017 census fit)", () => {
  test.each(PREDICT_ORACLE)("predict('%s') === '%s'", (text, expectedNaics) => {
    const top1 = model.predictTopN(text, 1)[0]?.naics ?? "";
    expect(top1).toBe(expectedNaics);
  });

  test("predict_proba('restaurant') scores > 0.01 match oracle", () => {
    const scores = model.predictProba("restaurant");
    const actual = Object.fromEntries(Object.entries(scores).filter(([, v]) => v > 0.01));
    expect(Object.keys(actual).sort()).toEqual(Object.keys(RESTAURANT_ORACLE).sort());
    for (const naics in RESTAURANT_ORACLE) {
      // naics-model.json rounds proportions to 6 decimals on export (§V7 size
      // budget); that quantization propagates through the ensemble average.
      expect(actual[naics]).toBeCloseTo(RESTAURANT_ORACLE[naics], 4);
    }
  });

  test("predict_top10('dealer') matches oracle order", () => {
    const top10 = model.predictTopN("dealer", 10).map((s) => s.naics);
    expect(top10).toEqual(DEALER_TOP10_ORACLE);
  });
});
