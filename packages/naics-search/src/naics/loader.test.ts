import { describe, expect, test } from "vite-plus/test";
import fixtureParams from "./__fixtures__/tiny-model.json" with { type: "json" };
import { loadNaics } from "./loader.ts";
import { configureDataProvider } from "./provider.ts";

const hierarchy = {
  "11": { code: "11", title: "Agriculture", children: {} },
};

// Provider-based loading (§V47-V54) swaps in a fake provider instead of the
// old bundled-JSON module mock.
configureDataProvider(() => Promise.resolve({ params: fixtureParams, hierarchy }));

describe("loadNaics", () => {
  test("resolves model + flattened hierarchy titles", async () => {
    const loaded = await loadNaics();
    expect(loaded.model.predictTopN("corn farm").length).toBeGreaterThan(0);
    expect(loaded.titles.get("11")).toBe("Agriculture");
    expect(loaded.hierarchy).toEqual(hierarchy);
  });

  test("concurrent callers share one in-flight load (V48: never dropped/re-loaded)", async () => {
    const [a, b] = await Promise.all([loadNaics(), loadNaics()]);
    expect(a).toBe(b);
  });
});
