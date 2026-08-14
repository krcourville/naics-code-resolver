import { BeaconModel, type BeaconParams } from "./beacon-model.ts";
import { flattenHierarchy, type HierarchyTree } from "./hierarchy.ts";

export interface LoadedNaics {
  model: BeaconModel;
  titles: Map<string, string>;
  hierarchy: HierarchyTree;
}

let loadPromise: Promise<LoadedNaics> | undefined;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to load ${url}: ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

/**
 * Kicks off the model+hierarchy fetch exactly once; every caller (mount,
 * plus any submit that races ahead of load) awaits the same in-flight
 * promise, so nothing is ever dropped or re-fetched (§V5).
 */
export function loadNaics(): Promise<LoadedNaics> {
  loadPromise ??= (async () => {
    const [params, hierarchy] = await Promise.all([
      fetchJson<BeaconParams>("/naics-model.json"),
      fetchJson<HierarchyTree>("/naics-hierarchy.json"),
    ]);
    return { model: new BeaconModel(params), titles: flattenHierarchy(hierarchy), hierarchy };
  })();
  return loadPromise;
}
