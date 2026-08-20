import { describe, expect, test, vi } from "vite-plus/test";
import fixtureParams from "./__fixtures__/tiny-model.json" with { type: "json" };

const hierarchy = {
  "11": { code: "11", title: "Agriculture", children: {} },
};

// Data is bundled (dynamic import, §V23/§V24) rather than fetched, so tests
// swap in a tiny fixture via module mocking instead of a fetch stub.
vi.mock("../data/naics-model.json", () => ({ default: fixtureParams }));
vi.mock("../data/naics-hierarchy.json", () => ({ default: hierarchy }));

describe("loadNaics", () => {
  test("resolves model + flattened hierarchy titles", async () => {
    const { loadNaics } = await import("./loader.ts");
    const loaded = await loadNaics();
    expect(loaded.model.predictTopN("corn farm").length).toBeGreaterThan(0);
    expect(loaded.titles.get("11")).toBe("Agriculture");
    expect(loaded.hierarchy).toEqual(hierarchy);
  });

  test("concurrent callers share one in-flight load (V5: never dropped/re-loaded)", async () => {
    const { loadNaics } = await import("./loader.ts");
    const [a, b] = await Promise.all([loadNaics(), loadNaics()]);
    expect(a).toBe(b);
  });
});
