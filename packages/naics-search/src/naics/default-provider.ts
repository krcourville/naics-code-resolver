import type { BeaconParams } from "./beacon-model.ts";
import type { HierarchyTree } from "./hierarchy.ts";
import type { DataProvider, NaicsData } from "./provider.ts";
import { PKG_VERSION } from "./version.ts";

const REPO = "krcourville/naics-code-resolver";
const MODEL_FILE = "naics-model.json";
const HIERARCHY_FILE = "naics-hierarchy.json";

function unpkgUrl(file: string): string {
  return `https://unpkg.com/@cajuncodemonkey/naics-search-data@${PKG_VERSION}/${file}`;
}

function githubReleaseUrl(file: string): string {
  return `https://github.com/${REPO}/releases/download/naics-search-v${PKG_VERSION}/${file}`;
}

// V60: fetch a single JSON file from ONE host. Any failure — network error,
// non-2xx, or a response that isn't valid JSON (e.g. an HTML error page) —
// throws, so the caller can fall back. ⊥ gated on a specific status/error
// shape (guards recurrence of the B8/B11 class of bug, same lesson as V35).
async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  return (await res.json()) as T;
}

async function fetchFrom(urlFor: (file: string) => string): Promise<NaicsData> {
  const [params, hierarchy] = await Promise.all([
    fetchJson<BeaconParams>(urlFor(MODEL_FILE)),
    fetchJson<HierarchyTree>(urlFor(HIERARCHY_FILE)),
  ]);
  return { params, hierarchy };
}

/**
 * Default {@link DataProvider}: unpkg (CDN-backed, V49) tried first, falling
 * back to the raw GitHub Release asset URL (uncached, but always present once
 * published) on ANY failure of the primary attempt.
 */
export const defaultProvider: DataProvider = async () => {
  try {
    return await fetchFrom(unpkgUrl);
  } catch {
    return await fetchFrom(githubReleaseUrl);
  }
};
