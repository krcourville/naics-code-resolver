import { describe, expect, test } from "vite-plus/test";
import { fsDataProvider } from "./fs-provider.ts";

const FIXTURES = new URL("./__fixtures__/", import.meta.url);

describe("fsDataProvider", () => {
  test("reads model+hierarchy JSON off disk", async () => {
    const provider = fsDataProvider({
      model: new URL("tiny-model.json", FIXTURES).pathname,
      hierarchy: new URL("tiny-hierarchy.json", FIXTURES).pathname,
    });
    const { params, hierarchy } = await provider();
    expect(params.naics.length).toBeGreaterThan(0);
    expect(hierarchy["11"]?.title).toBe("Agriculture");
  });
});
