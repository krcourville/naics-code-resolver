export type DetailsMode = "tree" | "list";

export interface Settings {
  details: DetailsMode;
  showDef: boolean;
  floor: number;
}

export const DEFAULT_SETTINGS: Settings = { details: "list", showDef: false, floor: 0 };

const STORAGE_KEY = "naics-settings";

/** [0,1] inclusive clamp (§V18) — out-of-range floor input never escapes this range. */
export function clampFloor(value: number): number {
  return Math.min(1, Math.max(0, value));
}

// §V21: malformed/corrupt localStorage JSON must not crash — treat like absent.
export function parseStoredJson(raw: string | null): Partial<Settings> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return pickSettings(parsed as Record<string, unknown>);
  } catch {
    return {};
  }
}

export function parseQueryParams(params: URLSearchParams): Partial<Settings> {
  const out: Partial<Settings> = {};
  const details = params.get("details");
  if (details === "tree" || details === "list") out.details = details;
  const showDef = params.get("showDef");
  if (showDef === "0" || showDef === "1") out.showDef = showDef === "1";
  const floorRaw = params.get("floor");
  if (floorRaw !== null) {
    const n = Number(floorRaw);
    if (!Number.isNaN(n)) out.floor = clampFloor(n);
  }
  return out;
}

function pickSettings(p: Record<string, unknown>): Partial<Settings> {
  const out: Partial<Settings> = {};
  if (p.details === "tree" || p.details === "list") out.details = p.details;
  if (typeof p.showDef === "boolean") out.showDef = p.showDef;
  if (typeof p.floor === "number" && !Number.isNaN(p.floor)) out.floor = clampFloor(p.floor);
  return out;
}

/** §V15: load order query param > localStorage > default. */
export function mergeSettings(
  fromStorage: Partial<Settings>,
  fromQuery: Partial<Settings>,
): Settings {
  return { ...DEFAULT_SETTINGS, ...fromStorage, ...fromQuery };
}

/** §V15: load order query param > localStorage > default (browser entry point). */
export function loadSettings(params: URLSearchParams): Settings {
  return mergeSettings(
    parseStoredJson(localStorage.getItem(STORAGE_KEY)),
    parseQueryParams(params),
  );
}

/** §V15: write-through persist to both localStorage and the URL (replaceState, ⊥ history spam). */
export function saveSettings(settings: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  const params = new URLSearchParams(location.search);
  params.set("details", settings.details);
  params.set("showDef", settings.showDef ? "1" : "0");
  params.set("floor", String(settings.floor));
  history.replaceState(null, "", `${location.pathname}?${params}`);
}
