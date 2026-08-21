# @cajuncodemonkey/naics-search

Free-text business description → ranked [NAICS](https://www.census.gov/naics/) code
matches, plus the building blocks for a confidence-driven clarifying Q&A flow. Ported
from the [BEACON](https://github.com/uscensusbureau/BEACON) model — inference itself
runs entirely client-side, no server/backend. The ~34MB model+hierarchy data is **not**
bundled in this package; it's fetched over the network the first time you call
`search()`/`loadNaics()` (see [Data loading](#data-loading) below).

Built for [naics-code-resolver](https://github.com/krcourville/naics-code-resolver),
a free-text NAICS code lookup tool. See that repo for the full resolver UI this
package powers and the "how it works" writeup, or try the
[live app](https://krcourville.github.io/naics-code-resolver/) directly.

## Install

```sh
npm install @cajuncodemonkey/naics-search
```

## Usage

```ts
import { search } from "@cajuncodemonkey/naics-search";

const results = await search("retail bakery");
// [{ naicsCode: "311811", title: "Retail Bakeries", description: "...",
//    censusUrl: "https://www.census.gov/naics/?input=311811&year=2022&details=311811",
//    score: 0.87 }, ...]
```

`search()` is async on every call, but only pays the model+hierarchy load cost once —
the first call kicks it off, every concurrent/later call awaits the same in-flight load.

## API

### `search(businessDescription: string, topN?: number): Promise<SearchResult[]>`

Ranked NAICS matches, highest score first. `topN` defaults to `10`.

```ts
interface SearchResult {
  naicsCode: string;
  title: string;
  description?: string; // official Census definition, when available
  censusUrl: string;
  score: number; // [0,1] model confidence
}
```

### Full resolver flow (drilldown Q&A)

`search()` alone is enough for a simple lookup. For a confidence-driven Q&A flow (offer
a drill-down when the top match is ambiguous, let the user narrow it down against the
official NAICS hierarchy) use the lower-level pieces directly — this is exactly what
the [live app](https://github.com/krcourville/naics-code-resolver) does:

```ts
import {
  loadNaics,
  drilldownOptions,
  getAncestorPath,
  getNode,
  isResolved,
} from "@cajuncodemonkey/naics-search";

const { model, hierarchy, titles } = await loadNaics();
const candidates = model.predictTopN("hvac", 5); // [{ naics, score }, ...]

// static hierarchy drill-down, not model/LLM-generated questions
const topLevelOptions = drilldownOptions(hierarchy, null); // sectors
const isLeaf = isResolved(hierarchy, "238220"); // true -> a confirmed 6-digit code
const path = getAncestorPath(hierarchy, "238220"); // breadcrumb from root
const node = getNode(hierarchy, "238220"); // { title, definition?, examples?, children }
```

- `loadNaics(): Promise<{ model: BeaconModel; hierarchy: HierarchyTree; titles: Map<string, string> }>`
  — memoized; every caller awaits the same load, nothing is re-triggered.
- `BeaconModel#predictTopN(text: string, n?: number): NaicsScore[]` — `{ naics, score }[]`,
  descending by score, positive scores only.
- `BeaconModel#predictProba(text: string): Record<string, number>` — full score
  distribution over all 6-digit codes.
- `drilldownOptions(tree, code)` — children of `code` (or top-level sectors if `code` is
  `null`).
- `isResolved(tree, code)` — `true` once a node has no children (a confirmed 6-digit code).
- `getAncestorPath(tree, code)` — root-to-node `{code,title}[]` chain, for breadcrumbs.
- `getNode(tree, code)` — full node (`title`, `definition?`, `examples?`, `children`).

Want your own data (BEACON-refit params, or a different vintage), or to construct the
model without going through `loadNaics()`/any provider at all? Construct `BeaconModel`
directly — `new BeaconModel(customParams)`, where `customParams` matches the exported
`BeaconParams` shape. This is the same data `scripts/build-model.py` in the main repo
exports.

## Data loading

`search()`/`loadNaics()`/the drilldown fns all need the ~34MB model+hierarchy data, which
is **not** in this package's install — it's fetched at runtime the first time you call
any of them. By default that fetch goes to
[unpkg](https://unpkg.com) (`@cajuncodemonkey/naics-search-data`, a tiny sibling package
that exists only to give unpkg a tarball to serve — you never install it directly),
falling back automatically to a raw GitHub Release download if unpkg fails for any
reason. If both fail, the `loadNaics()`/`search()` promise rejects — handle that like
any other failed fetch.

### Overriding the data source

Call `configureDataProvider()` once, before your first `search()`/`loadNaics()` call:

```ts
import { configureDataProvider } from "@cajuncodemonkey/naics-search";

configureDataProvider(async () => ({
  params: /* your BeaconParams */,
  hierarchy: /* your HierarchyTree */,
}));
```

A `DataProvider` is just `() => Promise<{ params: BeaconParams; hierarchy: HierarchyTree }>`
— fetch it from wherever you like. For Node consumers (scripts, tests, self-hosted/offline
setups) a ready-made filesystem provider ships as a separate entry point so `node:fs`
never lands in a browser bundle:

```ts
import { configureDataProvider } from "@cajuncodemonkey/naics-search";
import { fsDataProvider } from "@cajuncodemonkey/naics-search/fs-provider";

configureDataProvider(
  fsDataProvider({ model: "./naics-model.json", hierarchy: "./naics-hierarchy.json" }),
);
```

## Caveats

- **Network required by default.** Unlike versions before 2.0, this package ships no
  data — the first `search()`/`loadNaics()` call needs network access (unpkg, falling
  back to a GitHub Release download) unless you supply your own provider. Offline/
  air-gapped consumers should use `configureDataProvider()` with the fs provider (or
  their own) pointed at a locally-obtained copy of the data.
- **Sparse model, not exhaustive.** The underlying BeaconModel keeps only nonzero
  n-gram → NAICS proportions (~98.8% of the dense form is zero); scores are a purity-
  weighted heuristic over 2017/2022 Census training data, not a guarantee — always
  treat `score` as a confidence signal, not ground truth.
- **Main entry stays DOM-free.** The package itself (and its default data provider) only
  uses `fetch` — no `document`/`window`/other browser-only globals — so it works in
  Node 18+ and any bundler target alike. The Node-only `fs-provider` subpath is opt-in
  and never pulled into a browser build unless you import it yourself.
- **English business descriptions only.** No multi-language support.
- **Static Q&A only.** Any drill-down UI you build on `drilldownOptions`/`getNode`
  should stay a static hierarchy browse — there's no model/LLM-generated question
  text here by design.

## License

MIT. BEACON (the model this package ports) is public domain (CC0 1.0) — see the
[upstream license](https://github.com/uscensusbureau/BEACON/blob/main/LICENSE.md).

See [CONTRIBUTING.md](https://github.com/krcourville/naics-code-resolver/blob/main/CONTRIBUTING.md)
in the main repo for release steps.
