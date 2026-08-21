import { describe, expect, test } from "vite-plus/test";
import fixtureParams from "./__fixtures__/tiny-model.json" with { type: "json" };
import { loadNaics } from "./loader.ts";
import { configureDataProvider } from "./provider.ts";

const hierarchy = { "11": { code: "11", title: "Agriculture", children: {} } };

describe("loadNaics retry-after-failure", () => {
  test("a rejected load doesn't wedge future calls forever", async () => {
    let attempt = 0;
    configureDataProvider(() => {
      attempt++;
      if (attempt === 1) return Promise.reject(new Error("network down"));
      return Promise.resolve({ params: fixtureParams, hierarchy });
    });

    await expect(loadNaics()).rejects.toThrow("network down");
    const loaded = await loadNaics(); // retry, same process, no reload
    expect(loaded.hierarchy).toEqual(hierarchy);
    expect(attempt).toBe(2);
  });
});
