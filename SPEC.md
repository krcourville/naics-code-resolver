# SPEC

## §G GOAL
redesign naics-resolver UI onto shadcn best-practice components (Sheet, Skeleton, Item) — wider desktop layout, settings in right Sheet, tree/hierarchy views ⊥, single always-visible ranked-list results, no picked-item state, Skeleton (>2s) replaces loading/pending text.

## §C CONSTRAINTS
- `#app` max-width 768px (was fixed 640px), 1 padding layer (`px-6` desktop / `px-4` mobile), ⊥ redundant `#resolver` 32px inner pad.
- "Find code" button: content-width, right-aligned next to textarea @ desktop; full-width @ mobile. `Clear` = smaller ghost/icon button beside it.
- settings trigger: gear icon (lucide `Settings`, ghost icon `Button`) top-right header → shadcn `Sheet` from right.
- settings Sheet fields: Confidence floor (`Input`), Show definitions (`Checkbox`, moved off results view). "Result view" (list/tree) setting ⊥ — deleted, no replacement.
- results: `TreeQA` & `HierarchyQA` ⊥ entirely (incl. empty-pool hierarchy-browse fallback). shadcn `Item` per candidate (code, title, confidence inline; definition expands per-item when global showDef on; census link per item). ⊥ hero/"best match" card, ⊥ `pickResult`/picked-state, ⊥ `ResultPanel` swap-in.
- empty/no-match state (no search hits, or floor filters all out): plain empty-state msg + recommendations (rephrase, lower floor). ⊥ drill-down fallback.
- pending feedback: 1 rule — submit in-flight → `Skeleton` (shaped like result list) only once pending > 2s. `naics-loading` & `naics-pending` text ⊥. `naics-error` unchanged.
- header: external links (Cajun Code Monkey, GitHub) → footer, out of header row.
- new primitives via `pnpm dlx shadcn@4 add sheet skeleton item` (existing `radix-nova`/`neutral` config in `components.json`). ⊥ hand-rolled lookalikes.
- README(s) mentioning hierarchy/tree view updated to match list-only UX.
- dead code tied to hierarchy view (`DrillOption`, `isResolved`, orphaned `getNode` hierarchy-walk usage) + its tests removed.

## §I INTERFACES
UI-only change, no new external API/CLI. Persisted surface:
- localStorage/URL settings shape (`naics/settings.ts`) loses `details`/`DetailsMode` field — must not break parsing old saved settings missing/holding stale value.

## §V INVARIANTS
V1: `#app` max-width ≤ 768px, 1 padding layer, ⊥ nested 32px `#resolver` pad.
V2: "Find code" button content-width @ desktop, full-width @ mobile.
V3: settings trigger = gear icon top-right header, opens Sheet from right.
V4: settings Sheet ! contain only floor `Input` + showDef `Checkbox` — ⊥ result-view setting.
V5: results render only as `Item` list — ⊥ picked/selected state, ⊥ `ResultPanel` swap.
V6: `TreeQA` & `HierarchyQA` ⊥ ∈ codebase — ⊥ hierarchy browse fallback anywhere.
V7: empty-pool | no-match → empty-state msg w/ recommendations, ⊥ drill-down.
V8: pending feedback = `Skeleton` only after 2s in-flight; `naics-loading` & `naics-pending` text ⊥; `naics-error` unchanged.
V9: header external links ∈ footer, ⊥ header row.
V10: sheet/skeleton/item components added via shadcn CLI, ⊥ hand-rolled.
V11: README(s) ⊥ mention hierarchy/tree view post-change.
V12: `DrillOption`/`isResolved`/orphaned hierarchy-walk code + tests ⊥ ∈ codebase.
V13: old persisted settings (w/ stale `details` field) load ⊥ error.
V14: results Item-list renders ∀ confidence tier (high|medium|low) — ⊥ confidence-gated hide/show. offerQA/confidence-gating logic ⊥ used for display decisions.
V15: `Confidence.offerQA` field + its call sites ⊥ ∈ codebase post-build; `classifyConfidence` returns `label` only. `confidence.test.ts` updated to match.
V16: `settings.test.ts` ⊥ reference `details`/`DetailsMode` post-build.

## §T TASKS
id|status|task|cites
T1|x|add shadcn Sheet/Skeleton/Item via CLI|V10
T2|x|layout rework: `#app`/`#resolver` width+padding, responsive|V1
T3|x|restyle Find code/Clear buttons|V2
T4|x|header restructure: gear trigger top-right, links → footer|V3,V9
T5|x|build Settings Sheet: floor + showDef fields only|V4
T6|x|rebuild results as `Item`-based list ∀ confidence tier, drop `ResultPanel`/pickResult/offerQA-gating|V5,V14,V15
T7|x|delete `TreeQA`+`HierarchyQA`+tree/list branching; empty-state msg|V6,V7
T8|x|unify pending/loading → single 2s-gated `Skeleton`, rm old text blocks|V8
T9|x|`settings.ts`: rm `DetailsMode`/`details`, tolerate stale persisted field; update `settings.test.ts`|V4,V13,V16
T10|x|dead code+test cleanup: `DrillOption`,`isResolved`,hierarchy-walk, `offerQA` field+`confidence.test.ts`, old component tests|V6,V12,V15
T11|x|update README(s): rm hierarchy/tree mentions|V11
T12|x|verify: `vp check` && `vp test` + manual browser pass (desktop+mobile)|V1,V2,V3,V4,V5,V6,V7,V8,V9

## §B BUGS
id|date|cause|fix
