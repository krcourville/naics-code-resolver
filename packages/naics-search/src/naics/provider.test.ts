import { describe, expect, test } from "vite-plus/test";
import { configureDataProvider, getActiveProvider, type NaicsData } from "./provider.ts";

const fixture: NaicsData = { params: {} as never, hierarchy: {} };

describe("configureDataProvider/getActiveProvider", () => {
  test("falls back to the passed default when unconfigured", async () => {
    const fallback = () => Promise.resolve(fixture);
    expect(await getActiveProvider(fallback)()).toBe(fixture);
  });

  test("configured provider overrides the default", async () => {
    const custom = () => Promise.resolve(fixture);
    configureDataProvider(custom);
    const fallback = () => Promise.reject(new Error("should not run"));
    expect(getActiveProvider(fallback)).toBe(custom);
  });
});
