import { describe, expect, test } from "vite-plus/test";
import {
  clampFloor,
  DEFAULT_SETTINGS,
  mergeSettings,
  parseQueryParams,
  parseStoredJson,
} from "./settings.ts";

describe("clampFloor", () => {
  test("clamps below 0", () => {
    expect(clampFloor(-0.5)).toBe(0);
  });
  test("clamps above 1", () => {
    expect(clampFloor(1.5)).toBe(1);
  });
  test("passes through in-range", () => {
    expect(clampFloor(0.42)).toBe(0.42);
  });
});

describe("parseQueryParams", () => {
  test("reads showDef/floor", () => {
    expect(parseQueryParams(new URLSearchParams("showDef=1&floor=0.6"))).toEqual({
      showDef: true,
      floor: 0.6,
    });
  });
  test("ignores invalid values", () => {
    expect(parseQueryParams(new URLSearchParams("showDef=maybe&floor=nope"))).toEqual({});
  });
  test("empty params -> empty partial", () => {
    expect(parseQueryParams(new URLSearchParams())).toEqual({});
  });
});

describe("parseStoredJson (§V21 malformed-input safety)", () => {
  test("valid JSON parsed", () => {
    expect(parseStoredJson('{"showDef":true,"floor":0.3}')).toEqual({
      showDef: true,
      floor: 0.3,
    });
  });
  test("stale details field dropped (§V13)", () => {
    expect(parseStoredJson('{"details":"tree","showDef":true,"floor":0.3}')).toEqual({
      showDef: true,
      floor: 0.3,
    });
  });
  test("null (absent key) -> empty partial", () => {
    expect(parseStoredJson(null)).toEqual({});
  });
  test("corrupt JSON -> empty partial, no throw", () => {
    expect(() => parseStoredJson("{not json")).not.toThrow();
    expect(parseStoredJson("{not json")).toEqual({});
  });
  test("valid JSON but wrong shape (array) -> empty partial", () => {
    expect(parseStoredJson("[1,2,3]")).toEqual({});
  });
  test("unknown/garbage fields dropped", () => {
    expect(parseStoredJson('{"foo":"bar","floor":"not a number"}')).toEqual({});
  });
});

describe("mergeSettings (§V15 load order: query > localStorage > default)", () => {
  test("no overrides -> defaults", () => {
    expect(mergeSettings({}, {})).toEqual(DEFAULT_SETTINGS);
  });
  test("localStorage overrides default", () => {
    expect(mergeSettings({ floor: 0.5 }, {})).toEqual({ ...DEFAULT_SETTINGS, floor: 0.5 });
  });
  test("query param overrides localStorage", () => {
    expect(mergeSettings({ floor: 0.5 }, { floor: 0.9 })).toEqual({
      ...DEFAULT_SETTINGS,
      floor: 0.9,
    });
  });
});
