// @vitest-environment jsdom
import type { NaicsData } from "@cajuncodemonkey/naics-search";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

const hierarchy: NaicsData["hierarchy"] = {
  "11": { code: "11", title: "Agriculture", children: {} },
};
const params = { naics: ["111110"] } as NaicsData["params"];

// naics-search's loadNaics() caches its promise at module scope (§V48) — reset
// modules per test so each test gets a fresh, isolated singleton to configure.
beforeEach(() => {
  vi.resetModules();
});
afterEach(() => {
  vi.restoreAllMocks();
});

async function loadHookModules() {
  const { configureDataProvider } = await import("@cajuncodemonkey/naics-search");
  const { useNaicsSearch } = await import("./useNaicsSearch.ts");
  return { configureDataProvider, useNaicsSearch };
}

describe("useNaicsSearch", () => {
  test("status moves loading -> ready once loadNaics resolves", async () => {
    const { configureDataProvider, useNaicsSearch } = await loadHookModules();
    configureDataProvider(() => Promise.resolve({ params, hierarchy }));
    const { result } = renderHook(() => useNaicsSearch());

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    if (result.current.status === "ready") {
      expect(typeof result.current.search).toBe("function");
    }
  });

  test("status moves loading -> error when loadNaics rejects", async () => {
    const { configureDataProvider, useNaicsSearch } = await loadHookModules();
    configureDataProvider(() => Promise.reject(new Error("network down")));
    const { result } = renderHook(() => useNaicsSearch());

    await waitFor(() => expect(result.current.status).toBe("error"));
  });

  test("unmounting mid-load never triggers a setState-after-unmount warning (V56)", async () => {
    const { configureDataProvider, useNaicsSearch } = await loadHookModules();
    let resolveLoad!: (v: NaicsData) => void;
    configureDataProvider(() => new Promise((resolve) => (resolveLoad = resolve)));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { unmount } = renderHook(() => useNaicsSearch());
    unmount();
    resolveLoad({ params, hierarchy }); // resolves AFTER unmount
    await new Promise((r) => setTimeout(r, 0)); // flush microtasks

    expect(errorSpy).not.toHaveBeenCalled();
  });
});
