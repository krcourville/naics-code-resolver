import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { defaultProvider } from "./default-provider.ts";

const OK = {
  params: { naics: ["111110"] },
  hierarchy: { "11": { code: "11", title: "Ag", children: {} } },
};

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: () => Promise.resolve(body) } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("defaultProvider", () => {
  test("primary (unpkg) success is used directly", async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(jsonResponse(url.includes("naics-model.json") ? OK.params : OK.hierarchy)),
    );
    vi.stubGlobal("fetch", fetchMock);

    const data = await defaultProvider();
    expect(data.params).toEqual(OK.params);
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes("unpkg.com"))).toBe(true);
  });

  test.each([
    ["non-2xx status", () => Promise.resolve(jsonResponse(null, false, 404))],
    ["network error", () => Promise.reject(new Error("network down"))],
    [
      "invalid JSON body",
      () =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.reject(new SyntaxError("bad json")),
        } as Response),
    ],
  ])("falls back to GitHub Release on %s from the primary host", async (_label, primaryImpl) => {
    const fetchMock = vi.fn((url: string) => {
      if (String(url).includes("unpkg.com")) return primaryImpl();
      return Promise.resolve(
        jsonResponse(String(url).includes("naics-model.json") ? OK.params : OK.hierarchy),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const data = await defaultProvider();
    expect(data.params).toEqual(OK.params);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("github.com"))).toBe(true);
  });

  test("rejects when both hosts fail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(null, false, 500))),
    );
    await expect(defaultProvider()).rejects.toThrow();
  });
});
