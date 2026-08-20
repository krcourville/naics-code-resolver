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

// Plain Node requires `with { type: "json" }` on a real (unbundled) .json dynamic
// import (throws ERR_IMPORT_ATTRIBUTE_MISSING otherwise). Vite's dev server does the
// opposite — it serves `.json?import` as a JS module, which conflicts with the native
// JSON-module MIME check the attribute triggers. Try plain first (bundlers/Vite), retry
// with the attribute only on Node's specific error, so both environments work.
async function importJson<T>(path: string): Promise<{ default: T }> {
  try {
    return (await import(/* @vite-ignore */ path)) as { default: T };
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "ERR_IMPORT_ATTRIBUTE_MISSING"
    ) {
      return (await import(/* @vite-ignore */ path, { with: { type: "json" } })) as {
        default: T;
      };
    }
    throw err;
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
