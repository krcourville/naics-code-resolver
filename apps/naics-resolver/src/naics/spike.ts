import {
  BeaconModel,
  type BeaconParams,
  type HierarchyTree,
  type LoadedNaics,
} from "@cajuncodemonkey/naics-search";
import spikeParams from "./spike-fixture.json";

// T70 dev-only spike hierarchy: hand-built, covers only the 4 codes the tiny
// fixture model (packages/naics-search/.../__fixtures__/tiny-model.json,
// duplicated as ./spike-fixture.json since the pkg only exports dist/) knows.
const SPIKE_HIERARCHY: HierarchyTree = {
  "11": {
    code: "11",
    title: "Agriculture, Forestry, Fishing and Hunting",
    children: {
      "111": {
        code: "111",
        title: "Crop Production",
        children: {
          "1111": {
            code: "1111",
            title: "Oilseed and Grain Farming",
            children: {
              "111110": { code: "111110", title: "Soybean Farming", children: {} },
              "111150": { code: "111150", title: "Corn Farming", children: {} },
            },
          },
        },
      },
    },
  },
  "44": {
    code: "44",
    title: "Retail Trade",
    children: {
      "445": {
        code: "445",
        title: "Food and Beverage Retailers",
        children: {
          "445110": { code: "445110", title: "Supermarkets and Grocery Stores", children: {} },
          "445120": { code: "445120", title: "Convenience Stores", children: {} },
        },
      },
    },
  },
};

function flattenTitles(tree: HierarchyTree): Map<string, string> {
  const titles = new Map<string, string>();
  const visit = (node: HierarchyTree[string]) => {
    titles.set(node.code, node.title);
    for (const child of Object.values(node.children)) visit(child);
  };
  for (const node of Object.values(tree)) visit(node);
  return titles;
}

/** T70: skips loadNaics()'s 33MB model fetch — direct BeaconModel(customParams), README escape hatch. */
export function loadSpike(): Promise<LoadedNaics> {
  return Promise.resolve({
    model: new BeaconModel(spikeParams as BeaconParams),
    hierarchy: SPIKE_HIERARCHY,
    titles: flattenTitles(SPIKE_HIERARCHY),
  });
}

// T70: real-data variant of the README's "skip loadNaics(), construct BeaconModel
// yourself" escape hatch — fetch() the pkg's own data files (dev server serves
// any file under project root once base-prefixed, verified via curl) instead of
// loadNaics()'s dynamic import. Dev-only: prod build only copies public/ verbatim,
// this path isn't available there.
let spikeRealPromise: Promise<LoadedNaics> | undefined;

export function loadSpikeReal(): Promise<LoadedNaics> {
  spikeRealPromise ??= (async () => {
    const base = import.meta.env.BASE_URL;
    const [params, hierarchy] = await Promise.all([
      fetch(`${base}packages/naics-search/data/naics-model.json`).then(
        (r) => r.json() as Promise<BeaconParams>,
      ),
      fetch(`${base}packages/naics-search/data/naics-hierarchy.json`).then(
        (r) => r.json() as Promise<HierarchyTree>,
      ),
    ]);
    return { model: new BeaconModel(params), hierarchy, titles: flattenTitles(hierarchy) };
  })();
  return spikeRealPromise;
}
