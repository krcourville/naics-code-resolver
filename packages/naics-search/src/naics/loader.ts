import { BeaconModel, type BeaconParams } from "./beacon-model.ts";
import { flattenHierarchy, type HierarchyTree } from "./hierarchy.ts";

export interface LoadedNaics {
  model: BeaconModel;
  titles: Map<string, string>;
  hierarchy: HierarchyTree;
}

let loadPromise: Promise<LoadedNaics> | undefined;

/**
 * Kicks off the model+hierarchy import exactly once; every caller (mount,
 * plus any submit that races ahead of load) awaits the same in-flight
 * promise, so nothing is ever dropped or re-loaded (§V5). Bundled inside the
 * pkg via dynamic import (§V23) — no fetch, no DOM global, runs in any
 * modern JS/bundler runtime (§V24).
 */
export function loadNaics(): Promise<LoadedNaics> {
  loadPromise ??= (async () => {
    const [{ default: params }, { default: hierarchy }] = await Promise.all([
      import("../data/naics-model.json") as Promise<{ default: BeaconParams }>,
      import("../data/naics-hierarchy.json") as Promise<{ default: HierarchyTree }>,
    ]);
    return { model: new BeaconModel(params), titles: flattenHierarchy(hierarchy), hierarchy };
  })();
  return loadPromise;
}
