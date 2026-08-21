# SPEC

## §G GOAL

static page: free-text business description → client-side ONNX inference → 6-digit NAICS code; ambiguous/low-confidence → drill-down clarifying Q&A vs official NAICS hierarchy till single code confirmed. core resolver logic also shipped as standalone npm pkg `@cajuncodemonkey/naics-search` (search+drilldown fns) for reuse outside this app; React consumers get `@cajuncodemonkey/naics-search-react` (`useNaicsSearch()` hook) wrapping its load-state.

## §C CONSTRAINTS

- Vite+ static build (`vp build`), React, single page. ⊥ backend, ⊥ API routes, ⊥ server-side inference.
- React state via built-in hooks only (`useState`/`useEffect`/etc). ⊥ Redux/Zustand/router lib — single page, no routing needed.
- BeaconModel logic ported to TS, runs client-side only. ⊥ ONNX/WASM runtime — BeaconModel = custom sklearn `BaseEstimator` (hand-rolled clean_text/stem/n-gram dict lookup/purity-weighted scoring), ⊥ standard sklearn Pipeline → skl2onnx has ⊥ registered converter, ONNX export infeasible.
- BEACON census repo added as git submodule — source of truth for fit/predict logic to port.
- standalone script fits BeaconModel, exports fitted dictionaries/weights/sector params → `naics-model.json` on demand. sparse format required — dense per-sector float arrays are ~98.8% zero (BEACON purity weights concentrate each n-gram on ~1 NAICS code, avg 1.17 nonzero/key on real 2017 data) and blow up to 391MB; sparse {ngram:{naicsCode:prop}} + 6-decimal rounding + compact JSON → 35.5MB raw/5.5MB gzip. artifact committed to source control. ⊥ auto-run in CI — user updates manually.
- model + NAICS hierarchy JSON load async on mount. ⊥ block text input — user types immediately. submit before load done → await load, then infer.
- confidence bands (provisional, tune via Playwright testing): High ≥.70 → show code, no prompt | Medium .40–.69 → show code + confidence, offer narrow-down | Low <.40 → show best guess + confidence, push toward Q&A/manual browse. also trigger Q&A when top-2 scores within .10 regardless of band.
- confidence shown numeric (0–1) & text label (high/medium/low).
- clarifying Q&A = static NAICS hierarchy drill-down lookup. ⊥ model/LLM-generated questions.
- NAICS hierarchy data = official Census NAICS structure file. confirmed absent from beacon submodule (T3, searched) → fetched separately, see §R.
- automated testing via Playwright, driven off curated business-description test-case list.
- ⊥ accounts, ⊥ history, ⊥ analytics, ⊥ multi-language, ⊥ offline/PWA, ⊥ server-side logging.
- ? exact confidence thresholds provisional — may shift after Playwright test runs.
- deployed via GitHub Pages, project site (not custom domain) → served at `/naics-code-resolver/`, Vite `base` ! match.
- deploy = GitHub Actions workflow, triggered on push to `main`: `vp build` → publish `dist/` to Pages. ⊥ manual deploy step.
- "How does it work?" = README section, ⊥ deployed page (single page stays lean, no diagram/explainer bloat). README section carries description + mermaid diagram (client-side inference → confidence bands → Q&A flow). deployed page link → README section, ⊥ in-page anchor.
- README: fuller project description (what it is, why client-side ML, key constraints) + mermaid diagram of the flow.
- search text state bound to URL query param `term` (shareable URLs).
- settings (detailsMode, alwaysShowDefinition, floor) driven by query params, persisted localStorage. load order: query param > localStorage > default (§V15). detailsMode default = list (plain list, ⊥ decision tree).
- floor setting: number [0,1], default 0.
- visual theme = Cajun Code Monkey brand palette (primary #F27B57/#D65C37 orange, #FFAA02/#DC8503 gold accent, neutrals #000000–#FFFFFF, tan/brown #F4C7AA/#D59A7C/#F7C5A0/#F9DBC9), replaces prior generic purple accent (#aa3bff). light+dark mode both derive from same brand hues. heading font = "M PLUS Rounded 1C" weight 900 (Google Font).
- new workspace pkg `packages/naics-search/`, added to `pnpm-workspace.yaml` packages list. exports functions only, ⊥ UI framework/React, minimal deps.
- pkg exports `search(businessDescription: string)` → list `{naicsCode, title, description, censusUrl, score}`. `censusUrl` = `https://www.census.gov/naics/?input={code}&year=2022&details={code}`, `{code}`=naicsCode. `score`[0,1] = model confidence for that code — app (§C:35 single source of truth) needs it for §V2/§V8/§V18 banding/floor-filter, ⊥ separate scored-candidate export.
- pkg also exports drilldown Q&A functions (ported from `src/naics/drilldown.ts`) — full resolver flow available, ⊥ search() alone.
- model+hierarchy JSON ⊥ bundled inside pkg (was: dynamic import, superseded) — loaded async via pluggable data-provider contract, on first `search()`/drilldown call. importing module still ⊥ pay data cost upfront.
- pkg built w/ `tsdown`, ESM output.
- app (`src/main.ts`/`src/naics/*`) consumes this pkg internally — single source of truth, ⊥ duplicated logic.
- published public npm registry as `@cajuncodemonkey/naics-search` (scope owned).
- publish = CI, tag-triggered: push tag `naics-search-v*` → GH Actions: `vp install` → `vp check`/`vp test` → `tsdown` build → `npm publish --access public --provenance` via npm trusted publishing (OIDC, `id-token: write`) — ⊥ long-lived `NPM_TOKEN` secret. ⊥ publish on plain `main` push.
- `packages/naics-search/README.md` published w/ pkg (npm listing) — ! cover: exported API docs (`search()`+drilldown fns, param/return shapes), caveats (network-by-default data load via pluggable provider — default CDN, fs/custom override available —, zero bundled data bytes, sparse-model tradeoffs per §C model constraints), simple usage example, link back to this repo (https://github.com/krcourville/naics-code-resolver). ⊥ release steps — those live in repo-root `CONTRIBUTING.md` instead (npm listing = end-user docs, ⊥ maintainer process).
- repo-root `CONTRIBUTING.md` — maintainer release steps for `@cajuncodemonkey/naics-search`: bump version → commit → tag `naics-search-vX.Y.Z` → push tag → CI publishes via npm Trusted Publisher (OIDC, T64).
- npm registry Trusted Publisher configured on `@cajuncodemonkey/naics-search` (GitHub Actions, `krcourville/naics-code-resolver`, workflow `publish-naics-search.yml`, "Allow npm publish") — outside spec/build scope, user action, done via npmjs.com package settings.
- every `packages/naics-search/src/index.ts` export (fns, classes, methods, exported types/interfaces incl. fields) ! carry a TSDoc comment (`/** ... */`) — params/return documented where non-obvious. `vp pack --dts` ships these into `dist/index.d.mts`, consumer IDE hover = only API doc surface beyond README.
- monorepo reorg: app code (`src/`, `index.html`, `public/`, root-level app config) moves → `apps/naics-resolver/`. root becomes workspace orchestrator only — ⊥ app code @ root. `pnpm-workspace.yaml` packages list → `apps/*`, `packages/*` (drop bare `.`).
- knip added to `vp check`/CI, gates immediately (fails build on unused files/exports/deps) — ⊥ report-only grace period.
- publint + attw enabled via `packages/naics-search`'s existing tsdown build (`publint: true`, `attw: true` in tsdown config, §R13) — zero new build tool, gates CI immediately same as knip.
- knip/publint/attw config ! exclude `beacon/**` (submodule, not this project's maintained code, §C existing submodule constraint).
- pkg data-provider contract: async fn/type returning `{params: BeaconParams, hierarchy: HierarchyTree}` — replaces bundled-JSON dynamic import as the loading mechanism (see edited bundling bullet above). pkg ships zero data bytes: `package.json` `files` ⊥ list `data`, build script drops `cp -r src/data data`. `src/data/*.json` stays in-repo (still needed for release-asset publish + app's own build).
- built-in providers, all pkg-shipped: default primary = unpkg (`unpkg.com/@cajuncodemonkey/naics-search-data@{version}/{path}`, npm-tarball-backed, Cloudflare CDN, no documented file-size wall — replaces jsDelivr, which caps GH-sourced files @ 20MB, below the 32MB model file), auto-fallback → raw GitHub Release asset URL (same tag) on failure; fs provider (local path → async read) shipped for automated tests + as example custom/offline provider.
- new tiny workspace pkg `packages/naics-search-data` — carries ONLY `naics-model.json`/`naics-hierarchy.json` (copied from `packages/naics-search/src/data/*.json` @ build/publish time, single source of truth per V26 discipline). published npm `@cajuncodemonkey/naics-search-data`, version kept lockstep w/ `naics-search` (same tag triggers both publishes, same workflow). nobody depends on/installs it — exists purely as an unpkg-servable blob, ⊥ a real dependency (R9's "no byte savings" objection ⊥ apply here, since nothing installs it).
- consumer overrides data source via one-time global config setter (e.g. `configureDataProvider(fn)`) called before first `search()`/`loadNaics()` — ⊥ per-call provider param threaded through `search()`/drilldown fns.
- `loadNaics()` can now reject (both default hosts fail) — new failure path, ⊥ possible under old bundled-data mechanism.
- `apps/naics-resolver` (this repo's own app) uses pkg's default CDN provider too, ⊥ a local/bundled override — dogfoods same path external consumers get.
- data release assets (`naics-model.json`/`naics-hierarchy.json`) attached in the same tag-triggered `publish-naics-search.yml` run (tag `naics-search-v*`) that publishes npm — one tag push produces both, version-locked, ⊥ separate workflow/tag.
- ⊥ persistent cache (Cache API/IndexedDB)/web worker for data loading — browser HTTP cache on unpkg's immutable version-pinned URLs accepted as sufficient for "don't re-download every visit."
- `BeaconModel` export unchanged by this — stays the low-level bypass (sync, takes parsed params directly), independent of provider mechanism (§R9).
- new workspace pkg `packages/naics-search-react`, added to `pnpm-workspace.yaml`. exports `useNaicsSearch()` React hook — thin wrapper over `naics-search`'s `loadNaics()` load-state (loading/error/ready) + ready-to-call `search()`/drilldown fns. owns ⊥ app policy (confidence bands, settings, Q&A UI stay in `apps/naics-resolver`, single-source-of-truth per §C above).
- pkg published npm `@cajuncodemonkey/naics-search-react`, own `tsdown` build + own tag-triggered publish workflow (`naics-search-react-v*`), mirrors `naics-search`'s existing publish pattern.
- depends on `@cajuncodemonkey/naics-search` as real dep (version-locked); `react` = `peerDependency` only, ⊥ bundled.
- `useNaicsSearch()` — no args, data-provider config (if needed) set globally via `naics-search`'s `configureDataProvider()` before mount, ⊥ the hook's concern. return = discriminated union on `status`: `{status:'loading'}` \| `{status:'error', error}` \| `{status:'ready', search, drilldownOptions, getNode, isResolved, getAncestorPath, censusUrl}` — TS narrows on `status==='ready'`, ⊥ runtime guard needed before calling fns.
- hook's effect ! guard unmount-before-resolve: mounted-flag/cancelled-bool in cleanup, skips setState after unmount. `loadNaics()` itself ⊥ cancellable (shared cached promise, §V48) — guard only covers this hook instance's own state.
- `apps/naics-resolver` = only in-repo consumer to update — T67 (existing loading-indicator) refactored to consume the hook, T84 (error-state UI) built directly on the hook's `status:'error'` branch. single owner of load/error state, ⊥ duplicated-then-migrated.
- naics-search's provider-loading change (V47-V54) = breaking change (network-by-default, zero bundled data, `loadNaics()` can now reject) — acceptable. release ! bump `@cajuncodemonkey/naics-search` MAJOR version (semver), ⊥ patch/minor.

## §R RESEARCH

id|fact|source
R1|2022 NAICS Structure xlsx = flat depth-first outline, cols Change Indicator\|2022 NAICS Code\|2022 NAICS Title. levels by code digit-len: 2=sector,3=subsector,4=industry group,5=NAICS industry,6=national industry. 3 merged-sector range codes (31-33,44-45,48-49) match BeaconModel's `__get_sector()` merge exactly. title has trailing "T" (trilateral-agreement marker) appended directly, no separator — strip when preceded by lowercase. 1012 six-digit codes for 2022 vintage, matches `beacon/create_example_data_output.txt` reported count.|https://www.census.gov/naics/2022NAICS/2022_NAICS_Structure.xlsx
R2|2022 NAICS Descriptions xlsx confirmed (T15): cols Code\|Title\|Description, 2125 rows, entries at every hierarchy level not just 6-digit (sectors down to national industries). one Description cell per code jams definition + "Illustrative Examples:" list + "Cross-References." into free text, no separate columns — split on those literal markers. 5-digit codes that alias a single 6-digit industry are stubs ("See industry description for XXXXXX.", 522 of 2125 rows) with no real content, skip them. 1603/2125 codes carry a real definition.|https://www.census.gov/naics/2022NAICS/2022_NAICS_Descriptions.xlsx
R3|BEACON (submodule, source of ported logic) licensed CC0 1.0 Universal — public domain dedication, ⊥ attribution/copyleft req. US Census Bureau notes gov-employee code ⊥ subject to US copyright anyway. no conflict w/ this project's MIT license (T22,T36).|https://github.com/uscensusbureau/BEACON/blob/133ae64c177e863bf1149872720cad01b0699346/LICENSE.md
R4|synonym-expansion hook already exists: `beacon.py` `__map_dict`/`__map()` (beacon/beacon.py:790-800) runs post-stem, pre-dictionary-build inside `clean_text()`. filling it w/ WordNet synonym→canonical-stem pairs needs zero new mechanism, zero runtime/bundle change — fit-time-only edit to scripts/build-model.py + beacon.py, output JSON schema unchanged. confirms README claim (untouched runtime/bundle size).|beacon/beacon.py:790-800 (local)
R5|NLTK WordNet corpus = 10.7MB via `nltk.download("wordnet")`, Princeton license free research+commercial use w/ citation. pulled once @ build time only, ⊥ ships to browser — doesn't touch 5.9MB-gzip model artifact budget.|https://www.nltk.org/nltk_data/, https://wordnet.princeton.edu/license-and-commercial-use
R6|WordNet polysemy = real risk: synsets conflate senses (bank=river vs finance), naive whole-word auto-merge into `__map_dict` → false-positive n-gram matches across unrelated NAICS sectors. known query-expansion pitfall, ⊥ solved by lookup alone — needs manual curation or per-domain sense filter. current `__map_dict` = 3 entries, all hand-picked, no bulk-mapping infra exists.|https://aclanthology.org/2016.gwc-1.17.pdf, https://arxiv.org/pdf/1108.4052
R7|effort sizing (measured 2026-08-16): baseline dict = 542588 n-gram keys + 39348 exact-match keys / 20 sectors, 47MB raw / 5.9MB gzip model artifact. R4 shows infra cost trivial (<1 day script/dep change); real cost = curation+eval loop (pull synsets, hand-filter per R6, re-fit, re-run `beacon-model.parity.test.ts`), unbounded by vocab coverage chosen. ∴ start w/ narrow hand-vetted batch (10-50 pairs, same pattern as existing auto/automobil→car), not full WordNet dump.|synthesis of R4-R6, ⊥ independently sourced
R8|evaluated `fetch()` as replacement for dynamic-`import()` data loading (simplify + perf). Node's native `fetch()` (undici) ! support `file://` URLs — `fetch("file:///etc/hosts")` throws "fetch failed" (verified empirically, Node v24.14.1). Pkg ships data bundled w/in itself (no HTTP host, §C:33/T59), so Node consumers would need a `file://`→`fs.readFile` fallback anyway = same env-branching complexity as current `importJson()` (V32), ⊥ simpler. Perf: browser/Vite `import()` of a real .json asset already does network-fetch+native `JSON.parse` internally (no gain over explicit `fetch()`) — B6-B8's actual perf/compat fix was `deps.neverBundle` (unbundled asset) + the import-attribute Node fallback, both orthogonal to fetch vs import. ∴ ⊥ pursue — regresses Node support, no perf/simplicity win.|verified locally, Node v24.14.1, 2026-08-20
R9|evaluated splitting data (naics-model.json/naics-hierarchy.json) into a separate `@cajuncodemonkey/naics-data` pkg (simplify + perf). Doesn't touch B6-B8 — same loading mechanism (`import()`/`file://`/attribute quirks) just moves to whichever pkg does it. No byte savings — every `search()` consumer needs the data, `naics-search` would just depend on `naics-data`, npm installs both, identical total download. Real cost: 2 pkgs to version, cross-pkg compat, 2nd publish workflow, same bug class recurring at a pkg boundary instead of a relative path. Only pays off w/ a 2nd consumer pkg wanting the same dataset w/o search logic — doesn't exist, speculative. `new BeaconModel(customParams)` already lets anyone bypass `loadNaics()`/bundled data entirely if they want their own source. ∴ ⊥ pursue.|synthesis, ⊥ independently sourced, 2026-08-20
R10|Playwright-measured (T70 spike): `vp dev`'s cold `loadNaics()` submit->result = 4856ms; equivalent under `vp preview` (prod build) = 795ms, vs 529ms for a bare `fetch()`+`JSON.parse` of the same file — prod gap (~270ms) is normal import-graph overhead, not a real perf problem. `vp dev`'s ~4.5-6s cold-load (playwright.config.ts comment, V27/V28) = dev-server-only tax: `.json` dynamic `import()` gets routed through Vite dev's JS-module transform pipeline instead of a raw `JSON.parse`. e2e currently targets `vp dev` (`webServer.command`) ∴ tests today measure dev-only slowness, ⊥ real prod UX. CAVEAT (found running T71): the 795ms number was measured w/ OS page cache already warm from earlier build/curl runs in the same session — genuinely first request against a freshly-started `vp preview` (page cache cold) measured ~6s, same order as `vp dev`. Only the suite's first test pays this; `expect.timeout` kept @ 10s to cover it.|verified locally via Playwright + vp preview, 2026-08-20
R11|knip has native monorepo/workspace support (`Monorepos & Workspaces` + `Integrated Monorepos` docs). exclude paths (e.g. beacon submodule) via negated `project` glob patterns, ⊥ separate ignore mechanism needed. config file: `knip.json`/`knip.jsonc`/`knip.config.ts` or `"knip"` key in package.json.|https://knip.dev/overview/configuration
R12|publint = CLI/API linter checking npm pkg contents (exports map, main/module/types fields) for cross-bundler/runtime compat (Vite/Webpack/Rollup/Node) & common publish mistakes.|https://publint.dev/docs/, https://www.npmjs.com/package/publint
R13|@arethetypeswrong/cli (attw) analyzes published pkg's TS types for ESM/CJS module-resolution mismatches — exact bug class behind B6-B8 (import-attribute/resolution breakage only caught by real external install, not local workspace). tsdown (pkg's build tool, §C.34) has built-in opt-in integration: `publint: true`/`attw: true` in tsdown config or `--publint`/`--attw` CLI flags, `'ci-only'` mode to gate only in CI. both are optional peer deps (`publint`, `@arethetypeswrong/core`) — no new build tooling, just enabling existing tsdown flags.|https://tsdown.dev/options/lint, https://npmjs.com/@arethetypeswrong/cli
R14|decision (grill session, 2026-08-21): R8 (rejected `fetch()`, Node `file://` limitation) & R9 (rejected data-split pkg, no byte savings) both concluded ⊥ pursue network-based loading — neither blocks this change. R8's objection moot: CDN URLs are always `https://`, never `file://`. R9's objection ⊥ apply: this isn't a 2nd npm sub-package, it's GitHub Release assets + pluggable provider — goal here = zero data bytes in npm tarball, ⊥ total-transfer parity (which R9 was measuring). superseded by V47-V54/T78-T88.|synthesis, ⊥ independently sourced, 2026-08-21

## §I INTERFACES

- ui: single page. text input (auto-grow textarea, Enter submits/Shift+Enter newline) + secondary "Clear" button (next to submit, clears input AND result/Q&A) → submit → result (code + confidence, per §C band) shown always; medium/low band → Q&A offered to refine shown result → updated result. result panel & Q&A candidate picks show definition + illustrative examples when present for that code (§V10).
- file: `public/naics-model.json` — fitted BeaconModel artifact, sparse format: `sector_naics: {sector:[naicsCode,...]}` (replaces dense `naics_indices`), `dict_ncombs_props`/`dict_ems_props`: `{sector:{ngram:{naicsCode:proportion}}}` (nonzero only), weights unchanged (`{sector:{ngram:weight}}`).
- file: `public/naics-hierarchy.json` — code→node tree, node = `{title, definition?, examples?[], children}`. `definition`/`examples` optional — only codes with a Census descriptions-file entry carry them (§R2).
- script: `scripts/build-model.*` — fits BeaconModel via BEACON submodule, exports params → `naics-model.json`. manual invoke, ⊥ CI.
- submodule: `beacon` — BEACON census repo (sklearn pipeline + training data + possible NAICS structure data).
- ui: page, below search form → "💡 How does it work?" link → README section on GitHub (external, ⊥ in-page anchor/diagram).
- workflow: `.github/workflows/deploy.yml` — build + publish `dist/` to GitHub Pages on push to `main`.
- deployed URL: https://krcourville.github.io/naics-code-resolver/
- ui: page header bar (title, links row below: Cajun Code Monkey logo + "A Cajun Code Monkey project" → https://cajuncodemonkey.com/, GitHub octocat icon + repo name text "naics-code-resolver (MIT)" → https://github.com/krcourville/naics-code-resolver)
- file: `public/cajun-code-monkey.png` — Cajun Code Monkey symbol logo, tightly-cropped/transparent bg (favicon-source variant, ⊥ padded "PNG Logo Files" variant — that one has near-white non-transparent margin, visually undersized vs GitHub icon at matched box size), used in header link.
- ui: gear/settings icon → settings panel: detailsMode select (list|tree), floor numeric input [0,1]. alwaysShowDefinition ⊥ in gear panel — lives as an inline "Show definitions" toggle atop the list view itself (§V17), same underlying setting/persistence.
- url query param: `term` = search text.
- url query param: `details` = `tree`|`list`.
- url query param: `showDef` = `0`|`1`.
- url query param: `floor` = `0`–`1` number string.
- localStorage key `naics-settings` — JSON `{details, showDef, floor}`.
- ui: plain list result view (detailsMode=list) — rows: code, title, confidence (§V8 format). row click → expand → definition (§V10 fallback applies).
- asset src: `~/devp/cajun-code-monkey/assets/PDF Guideline.pdf` — brand colors + font spec (external ref, ⊥ copied into repo).
- font: Google Font "M PLUS Rounded 1C" weight 900, used for h1 + heading text.
- pkg: `@cajuncodemonkey/naics-search` — exports `search(text: string): Promise<{naicsCode, title, description, censusUrl, score}[]>` + drilldown fns (exact names TBD @ build).
- ui: dev-only spike toggle (`import.meta.env.DEV` gated, ⊥ prod build), 2 modes via `?spike=` query param, both bypass `loadNaics()` (`src/naics/spike.ts`):
  - `?spike=1` → `new BeaconModel(tinyFixtureParams)` (params duplicated from `packages/naics-search/.../__fixtures__/tiny-model.json` since pkg `exports` only expose `dist/`) + hand-built 4-code `SPIKE_HIERARCHY` stub (⊥ real 892KB hierarchy — pkg has no standalone hierarchy-loader export). skips 33MB model fetch entirely, fast iteration.
  - `?spike=real` → `fetch()`s pkg's real `naics-model.json`/`naics-hierarchy.json` off disk (`vp dev` serves any file under project root once base-prefixed — verified via curl) → `new BeaconModel(params)` manually, README's documented escape hatch. ⊥ works under `vp build`/prod — only `public/` copies verbatim there.
- pkg exports `censusUrl(naicsCode: string): string` standalone (already used internally by `search()`) — app's result/candidate views (which bypass `search()`, using `loadNaics()`+`predictTopN` directly for Q&A) reuse it, ⊥ duplicate the URL template (§C:35 single source of truth).
- workflow: `.github/workflows/publish-naics-search.yml` — tag-triggered (`naics-search-v*`) build+publish to npm.
- file: `packages/naics-search/README.md` — published w/ pkg (npm listing). sections: exported API docs, caveats, usage example, link back to repo. ⊥ release instructions.
- file: `CONTRIBUTING.md` (repo root) — maintainer release steps for `@cajuncodemonkey/naics-search`.
- dir: `apps/naics-resolver/` — app code post-reorg (was repo root): `src/`, `index.html`, `public/`, app-level `vite.config.ts`/`tsconfig.json`.
- file: `knip.json` (or `"knip"` key in root `package.json`) — entry/project patterns scoped to `apps/*`,`packages/naics-search/src/**`, excludes `beacon/**` (R11).
- config: `packages/naics-search`'s tsdown config — `publint: true`, `attw: true` flags (R13), wired into `vp check`/CI as gate.

## §V INVARIANTS

V1: ∀ inference → runs client-side, ⊥ network call to backend/API.
V2: confidence <.70 | top-2 scores within .10 → clarifying Q&A offered. result (code+confidence) ! render first, regardless of band — Q&A refines it, ⊥ hides/replaces it pre-answer.
V3: final displayed code ! valid 6-digit NAICS code.
V4: model/hierarchy load ! block text input.
V5: submit before load done → await load, then infer — ⊥ error/drop request.
V6: TS-ported inference ! match Python BeaconModel output (top-N codes + scores, within tolerance) for oracle test set.
V7: `naics-model.json` gzip size ! exceed 10MB (static-hosting budget).
V8: result display ! show confidence numeric[0,1] & text label (high|medium|low) together, ? emoji indicator (🟢/🟡/🔴) per band.
V9: Q&A offered (§V2) → present model's own top-N candidates via a decision tree, ⊥ full hierarchy root browse, ⊥ flat wall-of-text list when candidates >1. tree built from where candidate hierarchy paths first diverge (§V14) — branch choice per divergence point, recursing until ≤1 candidate per branch, then flat card (code+title+confidence w/ emoji+full definition, ⊥ truncated/snippet text). no candidates match (user rejects "None of these") → fall back to full hierarchy root browse.
V14: decision-tree branch choices ! derive from static NAICS hierarchy structure only (candidates' shared ancestor paths), ⊥ LLM/model-generated question text (§C).
V12: hierarchy drill-down UI = directory-style nav: breadcrumb trail (root → current, each ancestor clickable) + "Up" control, ⊥ dead-end w/ no way back. options list ! show emoji icon per row (📁 branch, 🏷️ leaf/resolvable code).
V13: any resolved result (candidate pick or hierarchy leaf) ! offer a way back — "See other matches" reopens Q&A from the original search's model candidates, ⊥ dead end regardless of path taken to reach the result.
V10: code missing definition/examples in hierarchy data → UI ! error/crash/blank — falls back to title-only display.
V11: `vp build` output (`dist/index.html` + asset refs) ! resolve correctly under `/naics-code-resolver/` base path — no root-relative asset breaks under GitHub Pages project-site subpath.
V15: settings load order ! query param > localStorage > default. any setting change → write-through to both query param & localStorage.
V16: `term` query param present on load → prefills input, auto-runs search once model/hierarchy load done (§V5). successful submit → writes `term` via `history.replaceState` (⊥ pushState/history spam), ⊥ per-keystroke updates.
V17: detailsMode=list (default) → Q&A/candidate presentation ! flat list (confidence+code+title), ⊥ decision tree (opt-in via detailsMode=tree). single-line row (confidence, code, title in order; title may wrap to further lines, ⊥ truncated) — entire row/card ! be the click target to select that code (⊥ separate "Select" button). ⊥ per-row expand control — one "Show definitions" checkbox above the whole list toggles every row's definition at once (= alwaysShowDefinition setting, write-through persisted same as gear-panel settings, §V15).
V18: floor filters candidates w/ confidence < floor from Q&A/candidate pool (list & tree modes), applied AFTER §V2's band/offerQA decision (which always uses raw unfiltered top-2 scores) — floor narrows what's shown, ⊥ what triggers Q&A. floor ∈[0,1], default 0. out-of-range clamped. ⊥ affects primary result (§V2 still renders best guess). floor emptying the whole pool → Q&A falls back to full hierarchy browse (§V9), ⊥ blank list.
V19: --accent/--accent-bg/--accent-border (light+dark) ! derive from Cajun Code Monkey palette (§C) — ⊥ prior arbitrary purple (#aa3bff removed).
V20: h1 + heading text ! use "M PLUS Rounded 1C" 900, fallback → --sans stack if font fails load.
V21: malformed/corrupt `naics-settings` localStorage JSON ! crash app — falls back to defaults, same as absent.
V22: `search()` results ! include `censusUrl` built from template (`{code}`=naicsCode) & `score`[0,1] confidence, both per result (§C).
V23: importing `@cajuncodemonkey/naics-search` ! ⊥ trigger data load — model/hierarchy JSON loads via dynamic import only on first `search()`/drilldown call.
V24: pkg ! depend on DOM/browser-only globals beyond dynamic import — usable in any modern JS/bundler runtime.
V25: publish workflow ! run only on tag push matching `naics-search-v*`, ⊥ on plain `main` push.
V26: `scripts/build-model.py` & `build-hierarchy.py` `--out` default ! diverge from path pkg loader actually reads — single declared data path, ⊥ manual dual-location sync (guards T59).
V27: React rewrite (T61) ! regress `e2e/resolver.spec.ts`|`e2e/settings.spec.ts` — DOM/selectors preserved or e2e updated same commit, `vp test:e2e` green required before T61 flips `x`.
V28: user ! left w/o feedback while model/hierarchy loading (§V4/§V5) or a submit in-flight — visible busy/loading indicator shown both cases, ⊥ blank/static UI during multi-second cold load (measured ~4.5-6s, T59 caveat).
V29: result panel & Q&A candidate views (tree/list/card) ! show a census.gov link (pkg `censusUrl()`) for the displayed code, opens new tab (`target="_blank" rel="noopener"`, matching existing header/footer link pattern). link text ! include the naics code (⊥ bare "View on census.gov" — ambiguous when multiple candidates/rows on screen at once).
V30: `packages/naics-search/src/data/*.json` ! stay compact (no pretty-print whitespace) — `vite.config.ts` `fmt.ignorePatterns` ! exclude that dir, so `vp check --fix`/staged-file formatting never re-inflates generated data (guards T59/B4).
V31: `.github/workflows/publish-naics-search.yml` ! build `packages/naics-search` (produces `dist/`, which app imports resolve to) BEFORE `vp check`/`vp test` run — CI starts from a clean checkout w/ no pre-existing `dist/`, ⊥ rely on a locally-built one (guards B5).
V32: pkg's `naics-model.json`/`naics-hierarchy.json` dynamic import ! work unmodified in plain Node (no bundler) AND in Vite dev AND in a Vite production build — verified via throwaway `npm install <tarball>` + real predict call, ⊥ trust local-workspace-only testing (guards B6/B7).
V33: app's production build (`vp build`/`pnpm build`) ! resolve `naics-model.json`/`naics-hierarchy.json` at the exact path its runtime import expects — verified via `vp preview` (real static server) + a real predict call, ⊥ `vp dev` alone (masks missing-asset bugs by serving any on-disk file per-request) (guards B9).
V34: any build step that copies a generated directory (`packages/naics-search/data`, `dist/data`) ! clean the destination first — re-running the build ⊥ accumulate a nested duplicate (guards B10).
V35: `importJson()`'s import-attribute fallback ! trigger on any failure of the primary (no-attribute) import attempt, ⊥ gated on a specific error code/message — Node and browsers hitting the same real-JSON-response case fail w/ different error shapes (guards B11).
V36: external asset URLs (Google Fonts, CDN) ! shipped unverified — confirm w/ a direct request (`curl -I`) that the exact URL used returns 200 before considering the task done, case-sensitive family/param names included (guards B12).
V37: monorepo reorg (app → `apps/naics-resolver/`) ! break `vp build`/`vp dev`/`vp preview`/GH Pages deploy/`publish-naics-search.yml`/e2e (`playwright.config.ts` paths) — all verified green post-move, same commit.
V38: knip (dedicated CI step, ⊥ folded into `vp check` — V44) ! report 0 unused files/exports/deps across `apps/*`,`packages/naics-search/src/**`, ⊥ `beacon/**` (R11) — violations fail CI (§C).
V39: publint (tsdown `publint: true`, R13) ! pass @ 0 errors on `packages/naics-search` build — failures fail CI.
V40: attw (tsdown `attw: true`, R13) ! pass @ 0 errors, profile `esm-only` (pkg's exports map = `types`+`import` only, no `require`/CJS — §C:34 ESM-only) on `packages/naics-search` build — failures fail CI, guards B6-B8 class bugs (ESM resolution mismatches only caught by real external install).
V41: knip/publint/attw config ! exclude `beacon/**` (submodule, ⊥ this project's maintained code). knip's default `project` glob (`**/*.{js,ts}`) already skips it (0 .js/.ts files in submodule) — explicit exclude kept as defense-in-depth/documentation, ⊥ load-bearing today.
V42: root `vite.config.ts` stays @ repo root post-reorg, hosts shared `lint`/`fmt`/`staged` config w/ `overrides` scoped per `apps/naics-resolver/**`/`packages/naics-search/**` (existing `beacon/**` ignores + knip/attw wiring live here or in files it composes, per vite-plus monorepo pattern) — T72 ⊥ delete/move it wholesale. only per-app framework/build config (React plugin, base path, `pack` config) moves into `apps/naics-resolver/vite.config.ts`, matching existing `packages/naics-search/vite.config.ts` precedent (pack-only, inherits root's shared config).
V43: GH Pages deploy build-output path ! match actual `vp build apps/naics-resolver` output dir (`apps/naics-resolver/dist` by default, ⊥ assumed repo-root `dist/`) — `deploy.yml`'s `upload-pages-artifact` `path:` input updated same commit as T72, verified by T73.
V44: knip (§V38) & tsdown publint/attw (§V39/V40) CI gates ! implemented as dedicated `vp run` task(s)/workflow step(s) — ⊥ folded into `vp check` (scope = fmt+lint+typecheck only, node_modules/vite-plus/docs/guide/check.md).
V45: `SPEC.md` ! reformatted by oxfmt (`vp check --fix`/`vp fmt`/staged pre-commit) — root `vite.config.ts` `fmt.ignorePatterns` ! include `SPEC.md`, same pattern as V30 (guards B13: oxfmt's markdown formatter doubles bare `~` into `~~`, corrupting both prose & §T status-cell literals).
V46: V23/V24/V32/V35 (bundled-JSON dynamic-import era) superseded by provider-based loading (T78+) — kept as historical record, ⊥ current mechanism. see V47-V54.
V47: pkg ships ⊥ data bytes — `naics-model.json`/`naics-hierarchy.json` absent from published tarball (`package.json` `files` ⊥ list `data`; `npm pack --dry-run` verifies).
V48: `loadNaics()` lazy-singleton guarantee (old V23's intent) holds under new mechanism — import alone ⊥ trigger data fetch, only first `search()`/drilldown call does, fires once regardless of concurrent callers.
V49: default data provider = unpkg URL (`unpkg.com/@cajuncodemonkey/naics-search-data@{version}/{path}`, version = `naics-search`'s own version, kept lockstep w/ the tiny never-installed `naics-search-data` pkg) tried first; failure → auto-fallback → raw GitHub Release asset URL, same tag; both fail → `loadNaics()` promise rejects (new failure path, ⊥ possible pre-change).
V50: consumer overrides data source via one-time global config setter (e.g. `configureDataProvider(fn)`), called before first `search()`/`loadNaics()` — ⊥ per-call provider param threaded through `search()`/drilldown fns.
V51: pkg ships fs-based provider (local file path → async read, returns `{params, hierarchy}`), usable directly by consumers/tests — ⊥ only default remote provider available.
V52: `apps/naics-resolver` production build ! use pkg's default remote (CDN) provider, ⊥ configure a local/bundled override — dogfoods same path external consumers get (§C).
V53: default provider fn ! use only runtime-agnostic `fetch` (⊥ DOM/browser-only globals) — keeps pkg usable Node 18+ & browser both, per old V24 intent.
V54: data availability (GitHub Release assets for `naics-model.json`/`naics-hierarchy.json`, AND `@cajuncodemonkey/naics-search-data` npm publish) all happen in same `publish-naics-search.yml` run, same tag (`naics-search-v*`), that publishes `naics-search` itself — one tag push ! produce all three, version-locked (guards drift between npm version & CDN-fetchable data version).
V55: `useNaicsSearch()` return ! discriminated union on `status` (`loading`\|`error`\|`ready`) — `search`/drilldown fns only present @ `status==='ready'`, TS narrows, ⊥ runtime guard.
V56: `useNaicsSearch()`'s effect ! setState after unmount — mounted-flag guard in cleanup fn, regardless of `loadNaics()` resolve/reject timing.
V57: `packages/naics-search-react` ! bundle `react` — `peerDependency` only, `@cajuncodemonkey/naics-search` = real dep.
V58: `apps/naics-resolver`'s load/error state (T67/T84) ! single-sourced from `useNaicsSearch()` — ⊥ separate hand-rolled `loadNaics()` effect duplicated alongside it.
V59: naics-search release containing V47-V54 (provider-based loading) ! publish as new MAJOR version (semver) — signals breaking change to existing consumers, ⊥ minor/patch.
V60: default provider's unpkg→GitHub-Release fallback ! trigger on ANY failure of the primary attempt (network error, non-2xx status, JSON-parse failure) — ⊥ gated on a specific status code/error shape (same discipline as V35, guards recurrence of B8/B11-class bug in the new fetch-based provider).
V61: app/e2e's default-CDN-provider path (V52/T88) ! assumed runnable against an unpublished/untagged version — pre-release dev & e2e use the fs provider (V51) pointed @ local `src/data/*.json` instead; T88's CDN-path coverage only runs post-publish or against a mocked host.
V62: knip (V38) & publint/attw (V39/V40) scope ! extend to `packages/naics-search-react/src/**` and its `tsdown` build — same CI gate discipline as `naics-search`, ⊥ a newer pkg silently excluded.
V63: `publish-naics-search.yml`'s GitHub-Release-asset step (T85) ! run w/ `permissions: contents: write` and explicitly create/target a GitHub Release for the pushed tag (`gh release create`/equivalent) before uploading assets — a tag push alone ⊥ create a Release object.
V64: `@cajuncodemonkey/naics-search-data`'s version ! ever drift from `@cajuncodemonkey/naics-search`'s version — both publish from the same workflow run/tag (V54), guards the default provider's URL (V49) from pointing @ a version w/ no matching data.
V65: `packages/naics-search-data` ! carry no code/exports (data files only, no TS/JS) — knip/publint/attw config excludes it same as `beacon/**` (R11/V41 pattern), ⊥ load-bearing given it's data-only, kept as documentation.

## §T TASKS

id|status|task|cites
T1|x|add BEACON repo as git submodule|-
T2|x|write model export script: fit BeaconModel, export fitted dictionaries/weights/sector params → naics-model.json|I.submodule
T3|x|source/verify NAICS hierarchy structure data → naics-hierarchy.json|-
T4|x|port BeaconModel clean_text/stem/n-gram/scoring logic to TS → predict_proba equivalent, top-N codes+scores|V1
T5|x|verify TS port parity vs Python BeaconModel — same inputs → same top-N codes/scores (tolerance). oracle = beacon/beacon_example.py + beacon_example_output.txt (22 example descriptions, restaurant probs, dealer top10)|T4,T12,T13,V6
T6|x|build async model+hierarchy loader, non-blocking|V4,V5
T7|x|impl confidence banding + text label + top-2 margin check|V2
T8|x|impl NAICS hierarchy drill-down clarifying-question UI|V2
T9|x|impl main page: input → submit → result/Q&A flow|I.ui
T10|x|curate business-description test-case list|-
T11|x|Playwright test suite over test-case list, tune confidence bands|T10,V2
T12|x|rework naics-model.json export to sparse format (drop dense naics_indices arrays)|T2,B2,V7
T13|x|update TS BeaconModel port to read sparse naics-model.json format|T4,B2,T12
T14|x|fix Q&A entry point: seed picks from model top-N candidates instead of hierarchy root|T8,T9,V9
T15|x|source/fetch Census 2022 NAICS Descriptions (definition + illustrative examples), verify §R2, merge into naics-hierarchy.json|R2
T16|x|surface definition + examples in result panel & Q&A candidate picks, graceful fallback when absent|T15,T9,T14,V10
T17|x|set Vite `base: '/naics-code-resolver/'` for GitHub Pages project site|V11
T18|x|add `.github/workflows/deploy.yml` — build + deploy to GitHub Pages on push to main|V11
T19|x|write "How does it work?" section (diagram + text) on main page, linked via anchor|I.ui
T20|x|README: link deployed GitHub Pages URL|-
T21|x|add title header bar w/ GitHub octocat icon link to repo|I.ui
T22|x|add MIT LICENSE file + package.json license field|-
T23|x|expand README: fuller project description + mermaid diagram of flow, add "How does it work?" section|-
T24|x|remove diagram + "How does it work?" section from deployed page, point link → README section instead|I.ui,T19
T25|x|add "Product by Cajun Code Monkey" link next to GitHub icon in header|I.ui,T21
T26|x|add Cajun Code Monkey symbol logo image to that link|I.ui,T25
T27|x|header: title stacks above links row (was crowding/wrapping title), bump logo/icon size|I.ui,T21
T28|x|reword CCM link text → "A Cajun Code Monkey project", add repo name text next to GitHub icon|I.ui,T25
T29|x|swap logo asset for tightly-cropped transparent variant (padded PNG made icon look undersized/mismatched gap vs GitHub icon)|I.ui,T26
T30|x|split intro line: description standalone, "How does it work?" moved below search form as own link w/ emoji|I.ui,T24
T31|x|global `a` styling: no underline, no default `:visited` purple, consistent accent/text color per context|-
T44|x|drop hover/focus underline on all links (base `a`, try-again, breadcrumb crumbs) → color-shift (`filter: brightness(0.85)`) instead|-
T45|x|replace flat candidate list w/ decision tree: branch on where candidate hierarchy paths diverge, breadcrumb+Up nav, one question at a time instead of N full-text cards|V9,V14
T46|x|clear button: didn't clear result/Q&A (stale answer stayed onscreen), overlaid textarea → now resets result+Q&A too, moved to secondary button next to "Find code"|I.ui
T47|x|clear button was hidden/pop-in when input empty → always visible, `disabled` (no-op) instead|I.ui
T32|x|reword intro line, playful tone: "What does your business do? Type it below — we'll figure out the code."|I.ui
T33|x|whitespace: widen gap header→intro text, tighten gap search form→"How does it work?" link|I.ui
T34|x|add emoji indicator (🟢/🟡/🔴) to confidence display, banded on label|V8
T35|x|hierarchy drill-down: directory-style breadcrumb + Up nav, emoji icons per row (📁/🏷️)|V12
T36|x|append "(MIT)" to GitHub repo link text. verified BEACON (submodule source) = CC0 1.0 public domain, no attribution/copyleft req → no conflict w/ MIT relicense|I.ui
T37|x|Q&A candidate cards: add code + confidence badge (emoji+score), drop 160-char definition truncation → full text|V9
T38|x|swap single-line search input for auto-growing textarea (long descriptions were cramped/hard to review), Enter submits + Shift+Enter newline, custom ✕ clear button (textarea has no native type=search clear)|I.ui
T39|x|Q&A section headings ("Narrow it down:"/"Not quite right? Did you mean:") were plain text blending in → styled as bold h2 w/ spacing from result panel above|I.ui
T40|x|"Find code" button was stretched full-height matching 2-row textarea → moved below textarea, full-width, natural height|I.ui
T41|x|main content (#resolver) distinguished from page bg: tinted body bg + card (border/radius/shadow) around resolver section|I.ui
T42|x|Q&A section ("Not quite right?"/"Narrow it down") given own tinted card, distinct from result panel + candidate rows above|I.ui
T43|x|result panel was a dead end (selected candidate/leaf → stuck) → added "🔄 Not this one? Try again" reopening Q&A from original search candidates|V13
T48|x|bind search term to `term` query param — load-time prefill+autosearch, typing→param sync|V16
T49|x|settings module: schema + load order (query>localStorage>default) + write-through persist|V15
T50|x|settings UI: gear icon + panel (detailsMode select, alwaysShowDefinition checkbox, floor input)|T49
T51|x|plain list result view (code/title/confidence, click-to-expand definition), gated by detailsMode|V17,T50
T52|x|wire alwaysShowDefinition to list/result default-expand behavior|V17,T50
T53|x|floor filtering across candidate pool (list + decision tree)|V18,T50
T54|x|Playwright: shareable URL (term+settings round-trip), floor filtering, tree vs list mode|T48,T51,T53
T55|x|swap --accent/--accent-bg/--accent-border tokens (light+dark) → Cajun Code Monkey palette (#F27B57/#D65C37/#FFAA02/#DC8503)|V19
T56|x|load "M PLUS Rounded 1C" 900 (Google Fonts) for --heading, apply to h1 + qa-heading|V20
T57|x|scaffold `packages/naics-search/` workspace pkg, add to `pnpm-workspace.yaml`|-
T58|x|move/adapt `src/naics/*` resolver logic into pkg src, export `search()`+drilldown fns|T57,V22,V23
T59|x|bundle naics-model.json+naics-hierarchy.json into pkg, dynamic-import loader|T58,V23
T60|x|configure `tsdown` build for pkg (ESM output)|T57
T61|x|rewrite app as React (`src/main.tsx`+components), consuming pkg instead of local `src/naics/*` copy — dogfood + serve as React usage example. ! keep e2e green (V27)|T58,T65
T62|x|write `packages/naics-search/README.md`: exported API docs, caveats, simple usage example, link back to repo, release steps|T57,I
T63|x|add `.github/workflows/publish-naics-search.yml` — tag-triggered build+publish to npm|V25
T64|x|manual: configure npm Trusted Publisher (OIDC) for `@cajuncodemonkey/naics-search`|-
T65|x|add React + react-dom deps, `@vitejs/plugin-react`, `.tsx` build config — root `package.json` only, ⊥ `packages/naics-search` (keeps §C.30 pkg minimal-deps)|-
T66|x|add TSDoc to every `packages/naics-search/src/index.ts` export lacking one (fns, `BeaconModel` ctor+methods, `SearchResult`/`BeaconParams`/`NaicsScore`/`DrillOption`/`HierarchyNode` fields) — verify via `dist/index.d.mts` after build|T58,I
T67|x|loading/busy indicator in app: shown while model/hierarchy loading on mount, & while a submit awaits that load — replaces silent wait|V28,I.ui
T68|x|export `censusUrl()` standalone from pkg index.ts (extract from `search()`'s internal helper); wire census.gov link (new tab) into app's ResultPanel + CandidateCard + ListQA row|V29,I
T69|x|move "Release (maintainers)" section out of `packages/naics-search/README.md` into new repo-root `CONTRIBUTING.md`|I
T70|x|dev-only spike: `?spike=1` (DEV-gated) skips `loadNaics()`, constructs `BeaconModel` directly w/ tiny fixture params — fast manual UX loop, ⊥ 33MB model load|I.ui
T71|x|switch `playwright.config.ts` `webServer` from `vp dev` to prod build + `vp preview` — real UX timing (R10), ⊥ dev-transform-inflated cold-load numbers. update/remove now-stale "~4.5-6s cold load" comment & `expect.timeout` headroom accordingly|R10,V27,V33
T72|x|reorg: move app (`src/`,`index.html`,`public/`) → `apps/naics-resolver/`, w/ own new `vite.config.ts` (React plugin, base path) + `tsconfig.json` — root `vite.config.ts` stays, keeps shared lint/fmt/staged config, add `overrides` for `apps/naics-resolver/**`/`packages/naics-search/**` (V42). update `pnpm-workspace.yaml` (drop bare `.`, add `apps/*`), root `package.json` scripts + root `tsconfig.json` include list (drop `src`), `playwright.config.ts` paths, `.github/workflows/deploy.yml` `path:` input → `apps/naics-resolver/dist` (V43) + `publish-naics-search.yml` paths|V37,V42,V43
T73|x|verify `vp build apps/naics-resolver`/`vp dev`/`vp preview`/GH Pages deploy (incl. corrected artifact path)/e2e all green post-reorg|T72,V37,V42,V43,V27
T74|x|add `knip.json` (or package.json `knip` key), scope `apps/*`+`packages/naics-search/src/**`, exclude `beacon/**`; wire as dedicated `vp run` task + CI step, ⊥ folded into `vp check` (V44)|V38,V41,V44,R11
T75|x|fix knip findings (unused files/exports/deps) surfaced by T74|T74,V38
T76|x|enable tsdown `publint: true`+`attw: {profile: 'esm-only'}` on `packages/naics-search` build (`vp pack`), wire failures into CI as dedicated step, ⊥ folded into `vp check` (V44)|V39,V40,V44,R13
T77|x|fix publint/attw findings surfaced by T76|T76,V39,V40
T78|x|define data-provider contract type (e.g. `DataProvider`) in pkg src — async fn returning `{params: BeaconParams, hierarchy: HierarchyTree}`|V48
T79|x|implement default provider: unpkg URL fetch (`@cajuncodemonkey/naics-search-data`) w/ auto-fallback → raw GitHub Release asset URL, using pkg's own version|V49,V53,V60
T80|x|implement fs provider (local path → async read)|V51
T81|x|implement one-time global `configureDataProvider()` setter, wire into `loadNaics()` in place of old `importJson()` dynamic-import calls|V50,V48
T82|x|strip bundled data from pkg: drop `data` from `package.json` `files`, remove `cp -r src/data data` build step — `src/data/*.json` stays in-repo (release-asset publish + app's own build still need it)|V47
T83|.|`apps/naics-resolver` — no provider config, dogfoods default CDN provider|V52
T84|.|add error UI state to loading indicator (T67) for `loadNaics()` rejection (both default hosts failed) — built directly on `useNaicsSearch()`'s `status:'error'` branch|V49,V58,I.ui,T90,T94
T85|.|extend `publish-naics-search.yml`: add `permissions: contents: write`, explicitly create/target the GitHub Release for the pushed tag, attach `naics-model.json`+`naics-hierarchy.json` as its assets, AND publish `@cajuncodemonkey/naics-search-data` to npm — all in same tag-triggered run|V54,V63,V64
T86|.|update `packages/naics-search/README.md` caveats: network-by-default data load, provider override, fs provider example, CDN fallback behavior|V49,V50,V51
T87|.|verify via throwaway `npm install <tarball>` + real `search()` call: zero data files in installed pkg, real network fetch succeeds against published release — same external-install discipline as V32|V47,V49
T88|.|Playwright: cover `loadNaics()` failure path (mock/block network) → app shows error state (T84), ⊥ blank/stuck-loading forever|T84,V49
T89|.|scaffold `packages/naics-search-react/` workspace pkg, add to `pnpm-workspace.yaml`|-
T90|.|implement `useNaicsSearch()` hook: loading/error/ready states, mounted-flag guard, re-export `search()`+drilldown fns @ ready|V55,V56,T89
T91|.|configure `tsdown` build for pkg (ESM output), `react` as peerDependency|V57,T89
T92|.|write `packages/naics-search-react/README.md`: API docs, usage example, link back to repo|T90
T93|.|add `.github/workflows/publish-naics-search-react.yml` — tag-triggered (`naics-search-react-v*`) build+publish to npm, mirrors `publish-naics-search.yml`|T91
T94|.|refactor `apps/naics-resolver` to consume `useNaicsSearch()` — replaces T67's manual load-effect|V58,T90
T95|.|scaffold `packages/naics-search-data` workspace pkg (data files only, copied from `packages/naics-search/src/data/*.json` @ publish time), add to `pnpm-workspace.yaml`|V64,T82
T96|.|extend knip/publint/attw config: cover `packages/naics-search-react/src/**` (V62), exclude `packages/naics-search-data` (V65)|V62,V65

## §B BUGS

id|date|cause|fix
B1|2026-08-14|BeaconModel = custom sklearn BaseEstimator (hand-rolled clean_text/stem/n-gram dict/purity scoring), ⊥ standard Pipeline → skl2onnx ⊥ converter, ONNX export infeasible|ported BEACON fit/predict logic to TS, artifact = naics-model.json not naics.onnx (§C,§I,T2,T5)
B2|2026-08-14|naics-model.json dense per-sector float arrays ~98.8% zero → 391MB real-data artifact, unshippable|sparse {naicsCode:prop} encoding + rounding + compact JSON → 35.5MB/5.5MB gzip (§C,§I,V7,T12,T13)
B3|2026-08-14|Q&A hardcoded to start hierarchy drill-down at root (src/main.ts renderQA call), discarding model's own top-N candidates → ambiguous input ("hvac": 238220 .65, 423730 .35) forces full 20-sector browse instead of showing the 2 codes already found|V9,T14
B4|2026-08-19|`vite.config.ts` `staged: {"*": "vp check --fix"}` glob + `fmt.ignorePatterns` missing pkg data dir → oxfmt pretty-printed `naics-model.json`/`naics-hierarchy.json` on every commit since T58/T59 move, silently inflating them 26-29% (build-model.py/build-hierarchy.py already export compact) despite §C's "compact JSON" claim|V30
B5|2026-08-19|`publish-naics-search.yml` ran `vp check`/`vp test` before building `packages/naics-search` → fresh CI checkout has ⊥ `dist/`, app's `@cajuncodemonkey/naics-search` import unresolvable, first real workflow run failed at `vp check` (only worked locally because `dist/` was already built from earlier manual runs)|V31
B6|2026-08-19|plain Node requires `with {type:"json"}` on a real (unbundled) .json dynamic import (⊥ present → `ERR_IMPORT_ATTRIBUTE_MISSING`, crashes on first `search()`/`loadNaics()` call) — 1.0.1 published w/o it, discovered via throwaway `npm install` + real call, never tested outside the monorepo workspace|V24,V32
B7|2026-08-19|import-attribute object arg (`{with:{type:"json"}}`) stopped rolldown's relative-path rewriting for the external json import → `dist/index.mjs` shipped `../data/...` (correct relative to _source_ `loader.ts`) instead of the rewritten `./data/...`, one dir off from where `dist/data/` actually was|V32,I
B8|2026-08-19|adding the import attribute (fix for B6) broke Vite dev — Vite serves `.json?import` as `text/javascript`, conflicting w/ the native JSON-module MIME check the attribute triggers → app silently failed to load in dev. Fixed w/ `importJson()`: try plain import first (Vite/bundlers), retry w/ the attribute only on Node's `ERR_IMPORT_ATTRIBUTE_MISSING` (works in both)|V32
B9|2026-08-20|app's `vp build` (production) never copies `packages/naics-search/data/*.json` into its own `dist/` — the pkg's `@vite-ignore`'d runtime-string import isn't statically tracked by the app's bundler, so nothing knew to bring the data along. `vp dev` masked this (serves any on-disk file by request path). Deployed GH Pages site 404'd on both data files, reported by user via live-site console. Fixed: root `build` script copies `packages/naics-search/data` → `dist/data` after `vp build`|V33
B10|2026-08-20|`cp -r src/data data` (pkg build) and the new app-level copy (B9 fix) don't clean the destination first — rerunning either accumulates a nested `data/data/` (macOS `cp -r` merges into an existing dir instead of replacing it). Found while verifying B9's fix. Fixed: both copy steps now `rm -rf <dest> &&` first|V34
B11|2026-08-20|`importJson()`'s B8 fix only retried w/ the import attribute on Node's exact `ERR_IMPORT_ATTRIBUTE_MISSING` code — real browsers hitting a genuine `application/json` response (real static hosting: `vp preview`, GH Pages) fail the same way Node does but w/ a generic "Failed to fetch dynamically imported module" error carrying no matching `.code`, so the fallback never fired there. `vp dev` alone can't catch this (Vite dev serves JSON as JS, sidestepping the whole assertion requirement) — only found by testing a real `vp preview` production build. Fixed: retry on ANY first-attempt failure, not a specific error shape|V35
B12|2026-08-20|Google Fonts family name shipped as `M+PLUS+Rounded+1C` (uppercase C) — real catalog name is case-sensitive `M PLUS Rounded 1c` (lowercase c). Wrong case → Google's `css2` endpoint returns 400, stylesheet never loads, heading silently falls back to `--sans` (§V20 already covers the fallback, but the primary font never should've failed). Reported by user from live-site network tab|V36
B13|2026-08-20|`SPEC.md` ! in `fmt.ignorePatterns` → oxfmt's markdown formatter treats bare `~` as strikethrough syntax, doubles it to `~~` on any `vp check --fix`/`vp fmt`/staged-commit run — corrupts prose ("~4.5-6s"→"~~4.5-6s") AND the §T status-cell literal `~` (wip marker) itself. Found running `vp fmt SPEC.md` during T73 verification, reverted before commit, no history corruption. Fixed: `SPEC.md` added to `fmt.ignorePatterns`|V45
