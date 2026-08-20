import { BeaconModel, type BeaconParams } from "./beacon-model.ts";
import { flattenHierarchy, type HierarchyTree } from "./hierarchy.ts";

/** Resolved model + hierarchy data, ready to predict and drill down with. */
export interface LoadedNaics {
  model: BeaconModel;
  /** code -> title, flattened across every level of the hierarchy. */
  titles: Map<string, string>;
  hierarchy: HierarchyTree;
}

let loadPromise: Promise<LoadedNaics> | undefined;

// A real (unbundled) .json dynamic import needs `with { type: "json" }` in plain
// Node and in any real static-file server response (real `application/json`
// content-type — Node and browsers both enforce the JSON-module import
// assertion there). Vite's dev server is the outlier: it serves `.json?import`
// as a JS module, and the assertion conflicts with that. Try plain first (so
// Vite dev keeps working), fall back to the attribute on ANY failure — the
// first attempt's error shape differs across Node/browsers, so don't gate on
// a specific error code/message.
async function importJson<T>(path: string): Promise<{ default: T }> {
  try {
    return (await import(/* @vite-ignore */ path)) as { default: T };
  } catch {
    return (await import(/* @vite-ignore */ path, { with: { type: "json" } })) as {
      default: T;
    };
  }
}

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
      importJson<BeaconParams>("../data/naics-model.json"),
      importJson<HierarchyTree>("../data/naics-hierarchy.json"),
    ]);
    return { model: new BeaconModel(params), titles: flattenHierarchy(hierarchy), hierarchy };
  })();
  return loadPromise;
}
