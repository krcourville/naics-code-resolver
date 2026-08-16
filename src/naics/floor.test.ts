import { describe, expect, test } from "vite-plus/test";
import { filterByFloor } from "./floor.ts";
import type { NaicsScore } from "./beacon-model.ts";

const CANDS: NaicsScore[] = [
  { naics: "238220", score: 0.65 },
  { naics: "423730", score: 0.35 },
];

describe("filterByFloor (§V18)", () => {
  test("floor 0 keeps everything", () => {
    expect(filterByFloor(CANDS, 0)).toEqual(CANDS);
  });
  test("drops candidates below floor", () => {
    expect(filterByFloor(CANDS, 0.5)).toEqual([CANDS[0]]);
  });
  test("floor above all scores empties the pool", () => {
    expect(filterByFloor(CANDS, 0.9)).toEqual([]);
  });
  test("boundary score kept (>=)", () => {
    expect(filterByFloor(CANDS, 0.65)).toEqual([CANDS[0]]);
  });
});
