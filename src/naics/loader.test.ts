import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import fixtureParams from "./__fixtures__/tiny-model.json" with { type: "json" };

const hierarchy = {
  "11": { code: "11", title: "Agriculture", children: {} },
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe("loadNaics", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          url.includes("model") ? jsonResponse(fixtureParams) : jsonResponse(hierarchy),
        ),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("resolves model + flattened hierarchy titles", async () => {
    const { loadNaics } = await import("./loader.ts");
    const { model, titles } = await loadNaics();
    expect(model.predictTopN("corn farm").length).toBeGreaterThan(0);
    expect(titles.get("11")).toBe("Agriculture");
  });

  test("concurrent callers share one in-flight fetch (V5: never dropped/refetched)", async () => {
    const { loadNaics } = await import("./loader.ts");
    const [a, b] = await Promise.all([loadNaics(), loadNaics()]);
    expect(a).toBe(b);
    expect(fetch).toHaveBeenCalledTimes(2); // one for model, one for hierarchy — not doubled
  });

  test("failed fetch rejects rather than hanging or silently dropping", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("nope", { status: 500 }))),
    );
    const { loadNaics } = await import("./loader.ts");
    await expect(loadNaics()).rejects.toThrow(/500/);
  });
});
