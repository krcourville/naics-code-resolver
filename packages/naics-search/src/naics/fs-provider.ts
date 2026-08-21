import { readFile } from "node:fs/promises";
import type { BeaconParams } from "./beacon-model.ts";
import type { HierarchyTree } from "./hierarchy.ts";
import type { DataProvider } from "./provider.ts";

/**
 * Node-only {@link DataProvider} reading model+hierarchy JSON off local disk —
 * for tests, offline consumers, or a custom `configureDataProvider()` source.
 * Shipped as a separate entry (`@cajuncodemonkey/naics-search/fs-provider`) so
 * `node:fs` never lands in the browser-facing main bundle.
 */
export function fsDataProvider(paths: { model: string; hierarchy: string }): DataProvider {
  return async () => {
    const [params, hierarchy] = await Promise.all([
      readFile(paths.model, "utf8").then((text) => JSON.parse(text) as BeaconParams),
      readFile(paths.hierarchy, "utf8").then((text) => JSON.parse(text) as HierarchyTree),
    ]);
    return { params, hierarchy };
  };
}
