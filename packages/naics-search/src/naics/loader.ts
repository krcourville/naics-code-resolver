import { BeaconModel } from "./beacon-model.ts";
import { defaultProvider } from "./default-provider.ts";
import { flattenHierarchy, type HierarchyTree } from "./hierarchy.ts";
import { getActiveProvider } from "./provider.ts";

/** Resolved model + hierarchy data, ready to predict and drill down with. */
export interface LoadedNaics {
  model: BeaconModel;
  /** code -> title, flattened across every level of the hierarchy. */
  titles: Map<string, string>;
  hierarchy: HierarchyTree;
}

let loadPromise: Promise<LoadedNaics> | undefined;

/**
 * Kicks off the data-provider fetch exactly once; every caller (mount, plus
 * any submit that races ahead of load) awaits the same in-flight promise, so
 * nothing is ever dropped or re-loaded (§V48). Data source defaults to
 * `defaultProvider` (unpkg + GitHub Release fallback, §V49/§V60) — override
 * via `configureDataProvider()` before the first call (§V50).
 */
export function loadNaics(): Promise<LoadedNaics> {
  loadPromise ??= (async () => {
    const { params, hierarchy } = await getActiveProvider(defaultProvider)();
    return { model: new BeaconModel(params), titles: flattenHierarchy(hierarchy), hierarchy };
  })();
  return loadPromise;
}
