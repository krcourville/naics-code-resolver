# SPEC

## §G GOAL

static page: free-text business description → client-side ONNX inference → 6-digit NAICS code; ambiguous/low-confidence → drill-down clarifying Q&A vs official NAICS hierarchy till single code confirmed.

## §C CONSTRAINTS

- Vite+ static build (`vp build`), vanilla TS, single page. ⊥ backend, ⊥ API routes, ⊥ server-side inference.
- BeaconModel logic ported to TS, runs client-side only. ⊥ ONNX/WASM runtime — BeaconModel = custom sklearn `BaseEstimator` (hand-rolled clean_text/stem/n-gram dict lookup/purity-weighted scoring), ⊥ standard sklearn Pipeline → skl2onnx has ⊥ registered converter, ONNX export infeasible.
- BEACON census repo added as git submodule — source of truth for fit/predict logic to port.
- standalone script fits BeaconModel, exports fitted dictionaries/weights/sector params → `naics-model.json` on demand. artifact committed to source control. ⊥ auto-run in CI — user updates manually.
- model + NAICS hierarchy JSON load async on mount. ⊥ block text input — user types immediately. submit before load done → await load, then infer.
- confidence bands (provisional, tune via Playwright testing): High ≥.70 → show code, no prompt | Medium .40–.69 → show code + confidence, offer narrow-down | Low <.40 → show best guess + confidence, push toward Q&A/manual browse. also trigger Q&A when top-2 scores within .10 regardless of band.
- confidence shown numeric (0–1) & text label (high/medium/low).
- clarifying Q&A = static NAICS hierarchy drill-down lookup. ⊥ model/LLM-generated questions.
- NAICS hierarchy data = official Census NAICS structure file. check BEACON submodule first before separate fetch.
- automated testing via Playwright, driven off curated business-description test-case list.
- ⊥ accounts, ⊥ history, ⊥ analytics, ⊥ multi-language, ⊥ offline/PWA, ⊥ server-side logging.
- ? exact confidence thresholds provisional — may shift after Playwright test runs.
- ? whether Census NAICS structure data ships inside BEACON submodule or needs separate fetch — confirm during T3.

## §I INTERFACES

- ui: single page. text input → submit → result (code + confidence) | clarifying-question flow → result.
- file: `public/naics-model.json` — fitted BeaconModel artifact (word/combo dictionaries, purity weights, sector params).
- file: `public/naics-hierarchy.json` — code→description tree.
- script: `scripts/build-model.*` — fits BeaconModel via BEACON submodule, exports params → `naics-model.json`. manual invoke, ⊥ CI.
- submodule: `beacon` — BEACON census repo (sklearn pipeline + training data + possible NAICS structure data).

## §V INVARIANTS

V1: ∀ inference → runs client-side, ⊥ network call to backend/API.
V2: confidence <.70 | top-2 scores within .10 → clarifying Q&A offered before final code shown.
V3: final displayed code ! valid 6-digit NAICS code.
V4: model/hierarchy load ! block text input.
V5: submit before load done → await load, then infer — ⊥ error/drop request.

## §T TASKS

id|status|task|cites
T1|x|add BEACON repo as git submodule|-
T2|x|write model export script: fit BeaconModel, export fitted dictionaries/weights/sector params → naics-model.json|I.submodule
T3|.|source/verify NAICS hierarchy structure data → naics-hierarchy.json|-
T4|.|build async model+hierarchy loader, non-blocking|V4,V5
T5|.|port BeaconModel predict_proba logic to TS → top-N codes + scores|V1
T6|.|impl confidence banding + text label + top-2 margin check|V2
T7|.|impl NAICS hierarchy drill-down clarifying-question UI|V2
T8|.|impl main page: input → submit → result/Q&A flow|I.ui
T9|.|curate business-description test-case list|-
T10|.|Playwright test suite over test-case list, tune confidence bands|T9,V2

## §B BUGS

id|date|cause|fix
B1|2026-08-14|BeaconModel = custom sklearn BaseEstimator (hand-rolled clean_text/stem/n-gram dict/purity scoring), ⊥ standard Pipeline → skl2onnx ⊥ converter, ONNX export infeasible|ported BEACON fit/predict logic to TS, artifact = naics-model.json not naics.onnx (§C,§I,T2,T5)
