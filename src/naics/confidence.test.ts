import { describe, expect, test } from "vite-plus/test";
import { classifyConfidence } from "./confidence.ts";

describe("classifyConfidence", () => {
  test("high band, wide margin -> no Q&A", () => {
    expect(classifyConfidence(0.7, 0.5)).toEqual({ label: "high", offerQA: false });
  });

  test("just under high boundary (.69) -> medium", () => {
    expect(classifyConfidence(0.69, 0.1)).toEqual({ label: "medium", offerQA: true });
  });

  test("medium band lower boundary (.40) -> medium", () => {
    expect(classifyConfidence(0.4, 0.1)).toEqual({ label: "medium", offerQA: true });
  });

  test("just under medium boundary (.39) -> low", () => {
    expect(classifyConfidence(0.39, 0.0)).toEqual({ label: "low", offerQA: true });
  });

  test("low band always offers Q&A", () => {
    expect(classifyConfidence(0.1, 0.05)).toEqual({ label: "low", offerQA: true });
  });

  test("high band but top-2 margin < .10 -> Q&A offered", () => {
    expect(classifyConfidence(0.75, 0.7)).toEqual({ label: "high", offerQA: true });
  });

  test("high band, margin exactly .10 -> no Q&A (not < .10)", () => {
    expect(classifyConfidence(0.8, 0.7)).toEqual({ label: "high", offerQA: false });
  });

  test("no second score -> margin check skipped", () => {
    expect(classifyConfidence(0.9, undefined)).toEqual({ label: "high", offerQA: false });
  });
});
