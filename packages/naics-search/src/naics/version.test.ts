import { describe, expect, test } from "vite-plus/test";
import pkg from "../../package.json" with { type: "json" };
import { PKG_VERSION } from "./version.ts";

describe("PKG_VERSION", () => {
  test("stays in sync with package.json's version (V64)", () => {
    expect(PKG_VERSION).toBe(pkg.version);
  });
});
