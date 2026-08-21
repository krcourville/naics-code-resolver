import type { BeaconParams } from "./beacon-model.ts";
import type { HierarchyTree } from "./hierarchy.ts";

/** Raw model+hierarchy payload a {@link DataProvider} resolves. */
export interface NaicsData {
  params: BeaconParams;
  hierarchy: HierarchyTree;
}

/** Async source of {@link NaicsData} — how `loadNaics()` gets its bytes. */
export type DataProvider = () => Promise<NaicsData>;

let activeProvider: DataProvider | undefined;

/**
 * Overrides the data source `loadNaics()`/`search()` use. Call once, before
 * the first `search()`/`loadNaics()`/drilldown call — after data starts
 * loading, changing the provider has no effect on the in-flight/cached load.
 */
export function configureDataProvider(provider: DataProvider): void {
  activeProvider = provider;
}

/** @internal exposed for `loader.ts` — not part of the public API surface. */
export function getActiveProvider(defaultProvider: DataProvider): DataProvider {
  return activeProvider ?? defaultProvider;
}
