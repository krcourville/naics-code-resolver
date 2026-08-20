import { loadNaics } from "./naics/loader.ts";
import { getNode } from "./naics/drilldown.ts";

export { loadNaics, type LoadedNaics } from "./naics/loader.ts";
export { BeaconModel, type BeaconParams, type NaicsScore } from "./naics/beacon-model.ts";
export {
  drilldownOptions,
  getAncestorPath,
  getNode,
  isResolved,
  type DrillOption,
} from "./naics/drilldown.ts";
export type { HierarchyNode, HierarchyTree } from "./naics/hierarchy.ts";

export interface SearchResult {
  naicsCode: string;
  title: string;
  description?: string;
  censusUrl: string;
  score: number;
}

function censusUrl(naicsCode: string): string {
  return `https://www.census.gov/naics/?input=${naicsCode}&year=2022&details=${naicsCode}`;
}

/**
 * Free-text business description -> ranked NAICS code matches. Simple
 * entry point; for the full resolver flow (confidence-driven Q&A,
 * hierarchy drill-down) use `loadNaics()` + the drilldown functions
 * directly, as this repo's app does.
 */
export async function search(businessDescription: string, topN = 10): Promise<SearchResult[]> {
  const { model, hierarchy, titles } = await loadNaics();
  return model.predictTopN(businessDescription, topN).map(({ naics, score }) => {
    const node = getNode(hierarchy, naics);
    return {
      naicsCode: naics,
      title: node?.title ?? titles.get(naics) ?? naics,
      description: node?.definition,
      censusUrl: censusUrl(naics),
      score,
    };
  });
}
