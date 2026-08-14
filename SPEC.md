# SPEC

## §G GOAL

static page: free-text business description → client-side ONNX inference → 6-digit NAICS code; ambiguous/low-confidence → drill-down clarifying Q&A vs official NAICS hierarchy till single code confirmed.

## §C CONSTRAINTS

- Vite+ static build (`vp build`), vanilla TS, single page. ⊥ backend, ⊥ API routes, ⊥ server-side inference.
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

## §R RESEARCH

id|fact|source
R1|2022 NAICS Structure xlsx = flat depth-first outline, cols Change Indicator\|2022 NAICS Code\|2022 NAICS Title. levels by code digit-len: 2=sector,3=subsector,4=industry group,5=NAICS industry,6=national industry. 3 merged-sector range codes (31-33,44-45,48-49) match BeaconModel's `__get_sector()` merge exactly. title has trailing "T" (trilateral-agreement marker) appended directly, no separator — strip when preceded by lowercase. 1012 six-digit codes for 2022 vintage, matches `beacon/create_example_data_output.txt` reported count.|https://www.census.gov/naics/2022NAICS/2022_NAICS_Structure.xlsx
R2|2022 NAICS Descriptions xlsx confirmed (T15): cols Code\|Title\|Description, 2125 rows, entries at every hierarchy level not just 6-digit (sectors down to national industries). one Description cell per code jams definition + "Illustrative Examples:" list + "Cross-References." into free text, no separate columns — split on those literal markers. 5-digit codes that alias a single 6-digit industry are stubs ("See industry description for XXXXXX.", 522 of 2125 rows) with no real content, skip them. 1603/2125 codes carry a real definition.|https://www.census.gov/naics/2022NAICS/2022_NAICS_Descriptions.xlsx
R3|BEACON (submodule, source of ported logic) licensed CC0 1.0 Universal — public domain dedication, ⊥ attribution/copyleft req. US Census Bureau notes gov-employee code ⊥ subject to US copyright anyway. no conflict w/ this project's MIT license (T22,T36).|https://github.com/uscensusbureau/BEACON/blob/133ae64c177e863bf1149872720cad01b0699346/LICENSE.md

## §I INTERFACES

- ui: single page. text input (auto-grow textarea, Enter submits/Shift+Enter newline, custom ✕ clear) → submit → result (code + confidence, per §C band) shown always; medium/low band → Q&A offered to refine shown result → updated result. result panel & Q&A candidate picks show definition + illustrative examples when present for that code (§V10).
- file: `public/naics-model.json` — fitted BeaconModel artifact, sparse format: `sector_naics: {sector:[naicsCode,...]}` (replaces dense `naics_indices`), `dict_ncombs_props`/`dict_ems_props`: `{sector:{ngram:{naicsCode:proportion}}}` (nonzero only), weights unchanged (`{sector:{ngram:weight}}`).
- file: `public/naics-hierarchy.json` — code→node tree, node = `{title, definition?, examples?[], children}`. `definition`/`examples` optional — only codes with a Census descriptions-file entry carry them (§R2).
- script: `scripts/build-model.*` — fits BeaconModel via BEACON submodule, exports params → `naics-model.json`. manual invoke, ⊥ CI.
- submodule: `beacon` — BEACON census repo (sklearn pipeline + training data + possible NAICS structure data).
- ui: page, below search form → "💡 How does it work?" link → README section on GitHub (external, ⊥ in-page anchor/diagram).
- workflow: `.github/workflows/deploy.yml` — build + publish `dist/` to GitHub Pages on push to `main`.
- deployed URL: https://krcourville.github.io/naics-code-resolver/
- ui: page header bar (title, links row below: Cajun Code Monkey logo + "A Cajun Code Monkey project" → https://cajuncodemonkey.com/, GitHub octocat icon + repo name text "naics-code-resolver (MIT)" → https://github.com/krcourville/naics-code-resolver)
- file: `public/cajun-code-monkey.png` — Cajun Code Monkey symbol logo, tightly-cropped/transparent bg (favicon-source variant, ⊥ padded "PNG Logo Files" variant — that one has near-white non-transparent margin, visually undersized vs GitHub icon at matched box size), used in header link.

## §V INVARIANTS

V1: ∀ inference → runs client-side, ⊥ network call to backend/API.
V2: confidence <.70 | top-2 scores within .10 → clarifying Q&A offered. result (code+confidence) ! render first, regardless of band — Q&A refines it, ⊥ hides/replaces it pre-answer.
V3: final displayed code ! valid 6-digit NAICS code.
V4: model/hierarchy load ! block text input.
V5: submit before load done → await load, then infer — ⊥ error/drop request.
V6: TS-ported inference ! match Python BeaconModel output (top-N codes + scores, within tolerance) for oracle test set.
V7: `naics-model.json` gzip size ! exceed 10MB (static-hosting budget).
V8: result display ! show confidence numeric[0,1] & text label (high|medium|low) together, ? emoji indicator (🟢/🟡/🔴) per band.
V9: Q&A offered (§V2) → first present model's own top-N candidates (code+title+confidence w/ emoji+full definition, score>0) as picks, ⊥ full hierarchy root browse, ⊥ truncated/snippet text. picking a candidate → resolved (§V3) if leaf, else hierarchy drill-down continues from that candidate's branch. no candidates match (user rejects) → fall back to full hierarchy root browse.
V12: hierarchy drill-down UI = directory-style nav: breadcrumb trail (root → current, each ancestor clickable) + "Up" control, ⊥ dead-end w/ no way back. options list ! show emoji icon per row (📁 branch, 🏷️ leaf/resolvable code).
V13: any resolved result (candidate pick or hierarchy leaf) ! offer a way back — "See other matches" reopens Q&A from the original search's model candidates, ⊥ dead end regardless of path taken to reach the result.
V10: code missing definition/examples in hierarchy data → UI ! error/crash/blank — falls back to title-only display.
V11: `vp build` output (`dist/index.html` + asset refs) ! resolve correctly under `/naics-code-resolver/` base path — no root-relative asset breaks under GitHub Pages project-site subpath.

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

## §B BUGS

id|date|cause|fix
B1|2026-08-14|BeaconModel = custom sklearn BaseEstimator (hand-rolled clean_text/stem/n-gram dict/purity scoring), ⊥ standard Pipeline → skl2onnx ⊥ converter, ONNX export infeasible|ported BEACON fit/predict logic to TS, artifact = naics-model.json not naics.onnx (§C,§I,T2,T5)
B2|2026-08-14|naics-model.json dense per-sector float arrays ~98.8% zero → 391MB real-data artifact, unshippable|sparse {naicsCode:prop} encoding + rounding + compact JSON → 35.5MB/5.5MB gzip (§C,§I,V7,T12,T13)
B3|2026-08-14|Q&A hardcoded to start hierarchy drill-down at root (src/main.ts renderQA call), discarding model's own top-N candidates → ambiguous input ("hvac": 238220 .65, 423730 .35) forces full 20-sector browse instead of showing the 2 codes already found|V9,T14
