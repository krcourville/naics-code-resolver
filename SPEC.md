# SPEC

## §G GOAL

static page: free-text business description → client-side ONNX inference → 6-digit NAICS code; ambiguous/low-confidence → drill-down clarifying Q&A vs official NAICS hierarchy till single code confirmed. core resolver logic also shipped as standalone npm pkg `@cajuncodemonkey/naics-search` (search+drilldown fns) for reuse outside this app.

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
- model+hierarchy JSON bundled inside pkg, loaded via dynamic import — importing module ⊥ pay data cost upfront, loads async on first `search()`/drilldown call.
- pkg built w/ `tsdown`, ESM output.
- app (`src/main.ts`/`src/naics/*`) consumes this pkg internally — single source of truth, ⊥ duplicated logic.
- published public npm registry as `@cajuncodemonkey/naics-search` (scope owned).
- publish = CI, tag-triggered: push tag `naics-search-v*` → GH Actions: `vp install` → `vp check`/`vp test` → `tsdown` build → `npm publish --access public --provenance` via npm trusted publishing (OIDC, `id-token: write`) — ⊥ long-lived `NPM_TOKEN` secret. ⊥ publish on plain `main` push.
- `packages/naics-search/README.md` published w/ pkg (npm listing) — ! cover: exported API docs (`search()`+drilldown fns, param/return shapes), caveats (browser-DOM-free but dynamic-import data load, bundle size, sparse-model tradeoffs per §C model constraints), simple usage example, link back to this repo (https://github.com/krcourville/naics-code-resolver). ⊥ release steps — those live in repo-root `CONTRIBUTING.md` instead (npm listing = end-user docs, ⊥ maintainer process).
- repo-root `CONTRIBUTING.md` — maintainer release steps for `@cajuncodemonkey/naics-search`: bump version → commit → tag `naics-search-vX.Y.Z` → push tag → CI publishes via npm Trusted Publisher (OIDC, T64).
- npm registry Trusted Publisher configured on `@cajuncodemonkey/naics-search` (GitHub Actions, `krcourville/naics-code-resolver`, workflow `publish-naics-search.yml`, "Allow npm publish") — outside spec/build scope, user action, done via npmjs.com package settings.
- every `packages/naics-search/src/index.ts` export (fns, classes, methods, exported types/interfaces incl. fields) ! carry a TSDoc comment (`/** ... */`) — params/return documented where non-obvious. `vp pack --dts` ships these into `dist/index.d.mts`, consumer IDE hover = only API doc surface beyond README.

## §R RESEARCH

id|fact|source
R1|2022 NAICS Structure xlsx = flat depth-first outline, cols Change Indicator\|2022 NAICS Code\|2022 NAICS Title. levels by code digit-len: 2=sector,3=subsector,4=industry group,5=NAICS industry,6=national industry. 3 merged-sector range codes (31-33,44-45,48-49) match BeaconModel's `__get_sector()` merge exactly. title has trailing "T" (trilateral-agreement marker) appended directly, no separator — strip when preceded by lowercase. 1012 six-digit codes for 2022 vintage, matches `beacon/create_example_data_output.txt` reported count.|https://www.census.gov/naics/2022NAICS/2022_NAICS_Structure.xlsx
R2|2022 NAICS Descriptions xlsx confirmed (T15): cols Code\|Title\|Description, 2125 rows, entries at every hierarchy level not just 6-digit (sectors down to national industries). one Description cell per code jams definition + "Illustrative Examples:" list + "Cross-References." into free text, no separate columns — split on those literal markers. 5-digit codes that alias a single 6-digit industry are stubs ("See industry description for XXXXXX.", 522 of 2125 rows) with no real content, skip them. 1603/2125 codes carry a real definition.|https://www.census.gov/naics/2022NAICS/2022_NAICS_Descriptions.xlsx
R3|BEACON (submodule, source of ported logic) licensed CC0 1.0 Universal — public domain dedication, ⊥ attribution/copyleft req. US Census Bureau notes gov-employee code ⊥ subject to US copyright anyway. no conflict w/ this project's MIT license (T22,T36).|https://github.com/uscensusbureau/BEACON/blob/133ae64c177e863bf1149872720cad01b0699346/LICENSE.md
R4|synonym-expansion hook already exists: `beacon.py` `__map_dict`/`__map()` (beacon/beacon.py:790-800) runs post-stem, pre-dictionary-build inside `clean_text()`. filling it w/ WordNet synonym→canonical-stem pairs needs zero new mechanism, zero runtime/bundle change — fit-time-only edit to scripts/build-model.py + beacon.py, output JSON schema unchanged. confirms README claim (untouched runtime/bundle size).|beacon/beacon.py:790-800 (local)
R5|NLTK WordNet corpus = 10.7MB via `nltk.download("wordnet")`, Princeton license free research+commercial use w/ citation. pulled once @ build time only, ⊥ ships to browser — doesn't touch 5.9MB-gzip model artifact budget.|https://www.nltk.org/nltk_data/, https://wordnet.princeton.edu/license-and-commercial-use
R6|WordNet polysemy = real risk: synsets conflate senses (bank=river vs finance), naive whole-word auto-merge into `__map_dict` → false-positive n-gram matches across unrelated NAICS sectors. known query-expansion pitfall, ⊥ solved by lookup alone — needs manual curation or per-domain sense filter. current `__map_dict` = 3 entries, all hand-picked, no bulk-mapping infra exists.|https://aclanthology.org/2016.gwc-1.17.pdf, https://arxiv.org/pdf/1108.4052
R7|effort sizing (measured 2026-08-16): baseline dict = 542588 n-gram keys + 39348 exact-match keys / 20 sectors, 47MB raw / 5.9MB gzip model artifact. R4 shows infra cost trivial (<1 day script/dep change); real cost = curation+eval loop (pull synsets, hand-filter per R6, re-fit, re-run `beacon-model.parity.test.ts`), unbounded by vocab coverage chosen. ∴ start w/ narrow hand-vetted batch (10-50 pairs, same pattern as existing auto/automobil→car), not full WordNet dump.|synthesis of R4-R6, ⊥ independently sourced

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
- pkg exports `censusUrl(naicsCode: string): string` standalone (already used internally by `search()`) — app's result/candidate views (which bypass `search()`, using `loadNaics()`+`predictTopN` directly for Q&A) reuse it, ⊥ duplicate the URL template (§C:35 single source of truth).
- workflow: `.github/workflows/publish-naics-search.yml` — tag-triggered (`naics-search-v*`) build+publish to npm.
- file: `packages/naics-search/README.md` — published w/ pkg (npm listing). sections: exported API docs, caveats, usage example, link back to repo. ⊥ release instructions.
- file: `CONTRIBUTING.md` (repo root) — maintainer release steps for `@cajuncodemonkey/naics-search`.

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

## §B BUGS

id|date|cause|fix
B1|2026-08-14|BeaconModel = custom sklearn BaseEstimator (hand-rolled clean_text/stem/n-gram dict/purity scoring), ⊥ standard Pipeline → skl2onnx ⊥ converter, ONNX export infeasible|ported BEACON fit/predict logic to TS, artifact = naics-model.json not naics.onnx (§C,§I,T2,T5)
B2|2026-08-14|naics-model.json dense per-sector float arrays ~98.8% zero → 391MB real-data artifact, unshippable|sparse {naicsCode:prop} encoding + rounding + compact JSON → 35.5MB/5.5MB gzip (§C,§I,V7,T12,T13)
B3|2026-08-14|Q&A hardcoded to start hierarchy drill-down at root (src/main.ts renderQA call), discarding model's own top-N candidates → ambiguous input ("hvac": 238220 .65, 423730 .35) forces full 20-sector browse instead of showing the 2 codes already found|V9,T14
