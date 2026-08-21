import { describe, expect, test } from "vite-plus/test";
import { classifyConfidence } from "./confidence.ts";

describe("classifyConfidence", () => {
  test("high band (>=.70)", () => {
    expect(classifyConfidence(0.7)).toEqual({ label: "high" });
  });

  test("just under high boundary (.69) -> medium", () => {
    expect(classifyConfidence(0.69)).toEqual({ label: "medium" });
  });

  test("medium band lower boundary (.40) -> medium", () => {
    expect(classifyConfidence(0.4)).toEqual({ label: "medium" });
  });

  test("just under medium boundary (.39) -> low", () => {
    expect(classifyConfidence(0.39)).toEqual({ label: "low" });
  });

  test("low band (0)", () => {
    expect(classifyConfidence(0)).toEqual({ label: "low" });
  });
});
