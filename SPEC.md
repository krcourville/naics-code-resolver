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

## §R RESEARCH

id|fact|source
R1|2022 NAICS Structure xlsx = flat depth-first outline, cols Change Indicator\|2022 NAICS Code\|2022 NAICS Title. levels by code digit-len: 2=sector,3=subsector,4=industry group,5=NAICS industry,6=national industry. 3 merged-sector range codes (31-33,44-45,48-49) match BeaconModel's `__get_sector()` merge exactly. title has trailing "T" (trilateral-agreement marker) appended directly, no separator — strip when preceded by lowercase. 1012 six-digit codes for 2022 vintage, matches `beacon/create_example_data_output.txt` reported count.|https://www.census.gov/naics/2022NAICS/2022_NAICS_Structure.xlsx
R2|2022 NAICS Descriptions xlsx confirmed (T15): cols Code\|Title\|Description, 2125 rows, entries at every hierarchy level not just 6-digit (sectors down to national industries). one Description cell per code jams definition + "Illustrative Examples:" list + "Cross-References." into free text, no separate columns — split on those literal markers. 5-digit codes that alias a single 6-digit industry are stubs ("See industry description for XXXXXX.", 522 of 2125 rows) with no real content, skip them. 1603/2125 codes carry a real definition.|https://www.census.gov/naics/2022NAICS/2022_NAICS_Descriptions.xlsx

## §I INTERFACES

- ui: single page. text input → submit → result (code + confidence, per §C band) shown always; medium/low band → Q&A offered to refine shown result → updated result. result panel & Q&A candidate picks show definition + illustrative examples when present for that code (§V10).
- file: `public/naics-model.json` — fitted BeaconModel artifact, sparse format: `sector_naics: {sector:[naicsCode,...]}` (replaces dense `naics_indices`), `dict_ncombs_props`/`dict_ems_props`: `{sector:{ngram:{naicsCode:proportion}}}` (nonzero only), weights unchanged (`{sector:{ngram:weight}}`).
- file: `public/naics-hierarchy.json` — code→node tree, node = `{title, definition?, examples?[], children}`. `definition`/`examples` optional — only codes with a Census descriptions-file entry carry them (§R2).
- script: `scripts/build-model.*` — fits BeaconModel via BEACON submodule, exports params → `naics-model.json`. manual invoke, ⊥ CI.
- submodule: `beacon` — BEACON census repo (sklearn pipeline + training data + possible NAICS structure data).

## §V INVARIANTS

V1: ∀ inference → runs client-side, ⊥ network call to backend/API.
V2: confidence <.70 | top-2 scores within .10 → clarifying Q&A offered. result (code+confidence) ! render first, regardless of band — Q&A refines it, ⊥ hides/replaces it pre-answer.
V3: final displayed code ! valid 6-digit NAICS code.
V4: model/hierarchy load ! block text input.
V5: submit before load done → await load, then infer — ⊥ error/drop request.
V6: TS-ported inference ! match Python BeaconModel output (top-N codes + scores, within tolerance) for oracle test set.
V7: `naics-model.json` gzip size ! exceed 10MB (static-hosting budget).
V8: result display ! show confidence numeric[0,1] & text label (high|medium|low) together.
V9: Q&A offered (§V2) → first present model's own top-N candidates (title+code, score>0) as picks, ⊥ full hierarchy root browse. picking a candidate → resolved (§V3) if leaf, else hierarchy drill-down continues from that candidate's branch. no candidates match (user rejects) → fall back to full hierarchy root browse.
V10: code missing definition/examples in hierarchy data → UI ! error/crash/blank — falls back to title-only display.

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

## §B BUGS

id|date|cause|fix
B1|2026-08-14|BeaconModel = custom sklearn BaseEstimator (hand-rolled clean_text/stem/n-gram dict/purity scoring), ⊥ standard Pipeline → skl2onnx ⊥ converter, ONNX export infeasible|ported BEACON fit/predict logic to TS, artifact = naics-model.json not naics.onnx (§C,§I,T2,T5)
B2|2026-08-14|naics-model.json dense per-sector float arrays ~98.8% zero → 391MB real-data artifact, unshippable|sparse {naicsCode:prop} encoding + rounding + compact JSON → 35.5MB/5.5MB gzip (§C,§I,V7,T12,T13)
B3|2026-08-14|Q&A hardcoded to start hierarchy drill-down at root (src/main.ts renderQA call), discarding model's own top-N candidates → ambiguous input ("hvac": 238220 .65, 423730 .35) forces full 20-sector browse instead of showing the 2 codes already found|V9,T14
