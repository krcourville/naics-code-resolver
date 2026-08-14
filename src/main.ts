import "./style.css";
import { loadNaics } from "./naics/loader.ts";
import { classifyConfidence } from "./naics/confidence.ts";
import {
  drilldownOptions,
  getAncestorPath,
  getNode,
  isResolved,
  type DrillOption,
} from "./naics/drilldown.ts";
import type { HierarchyTree } from "./naics/hierarchy.ts";
import type { NaicsScore } from "./naics/beacon-model.ts";

// public/ assets need import.meta.env.BASE_URL prefix (§V11) — index.html-only rewrite doesn't reach JS-injected HTML.
const base = import.meta.env.BASE_URL;

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
<header id="site-header">
  <h1>NAICS Code Resolver</h1>
  <div id="header-links">
    <a href="https://cajuncodemonkey.com/" target="_blank" rel="noopener" id="ccm-link">
      <img src="${base}cajun-code-monkey.png" alt="" width="25" height="28" />
      A Cajun Code Monkey project
    </a>
    <a href="https://github.com/krcourville/naics-code-resolver" target="_blank" rel="noopener">
      <svg height="28" width="28" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"></path></svg>
      naics-code-resolver (MIT)
    </a>
  </div>
</header>
<section id="resolver">
  <p>What does your business do? Type it below — we'll figure out the code.</p>
  <form id="naics-form">
    <textarea id="naics-input" rows="2" placeholder="e.g. retail bakery"></textarea>
    <div id="naics-form-actions">
      <button id="naics-submit" type="submit">Find code</button>
      <button id="naics-clear" type="button" disabled>Clear</button>
    </div>
  </form>
  <a id="how-it-works-link" href="https://github.com/krcourville/naics-code-resolver#how-does-it-work" target="_blank" rel="noopener">💡 How does it work?</a>
  <div id="naics-result" hidden></div>
  <div id="naics-qa" hidden></div>
</section>
`;

const form = document.querySelector<HTMLFormElement>("#naics-form")!;
const input = document.querySelector<HTMLTextAreaElement>("#naics-input")!;
const clearBtn = document.querySelector<HTMLButtonElement>("#naics-clear")!;
const resultEl = document.querySelector<HTMLDivElement>("#naics-result")!;
const qaEl = document.querySelector<HTMLDivElement>("#naics-qa")!;

// Kicked off on mount, never awaited by input handling (§V4) — submit awaits
// this same in-flight promise if it lands early (§V5, loader dedupes it).
const loaded = loadNaics();

const CONFIDENCE_EMOJI: Record<string, string> = { high: "🟢", medium: "🟡", low: "🔴" };

// Last submitted search's model candidates, kept so a picked/resolved result is never a
// dead end — "Not this one?" reopens Q&A from the same candidates, whatever the path taken.
let lastSearch: {
  candidates: NaicsScore[];
  hierarchy: HierarchyTree;
  titles: Map<string, string>;
} | null = null;

function renderResult(
  code: string,
  hierarchy: HierarchyTree,
  titles: Map<string, string>,
  score: number,
  label: string,
) {
  const node = getNode(hierarchy, code);
  const title = node?.title ?? titles.get(code) ?? "";
  resultEl.hidden = false;
  resultEl.innerHTML = `
    <p class="code">${code}</p>
    <p class="title">${title}</p>
    <p class="confidence">${CONFIDENCE_EMOJI[label] ?? ""} confidence: ${score.toFixed(2)} (${label})</p>
    ${node?.definition ? `<p class="definition">${node.definition}</p>` : ""}
    ${node?.examples?.length ? `<ul class="examples">${node.examples.map((e) => `<li>${e}</li>`).join("")}</ul>` : ""}
    <button type="button" id="naics-try-again">🔄 See other matches</button>
  `;
  resultEl.querySelector<HTMLButtonElement>("#naics-try-again")!.addEventListener("click", () => {
    if (lastSearch) renderQA(lastSearch.candidates, lastSearch.hierarchy, lastSearch.titles);
  });
}

// §C: clarifying Q&A = static hierarchy drill-down only, ⊥ model/LLM-generated questions.
// `path` = breadcrumb from root to current level (empty = root/all sectors), directory-style
// nav: breadcrumb segments jump back to any ancestor, "Up" pops one level (§V9 backprop: no way back).
function renderHierarchyQA(
  hierarchy: HierarchyTree,
  titles: Map<string, string>,
  path: DrillOption[],
) {
  const code = path.length ? path[path.length - 1].code : null;
  const options = drilldownOptions(hierarchy, code);
  const crumbs = [
    `<button type="button" class="crumb" data-idx="-1">🏠 All sectors</button>`,
    ...path.map(
      (p, i) => `<button type="button" class="crumb" data-idx="${i}">📁 ${p.title}</button>`,
    ),
  ].join(" › ");
  qaEl.innerHTML = `
    <nav class="qa-breadcrumb">${crumbs}</nav>
    ${path.length ? `<button type="button" id="naics-qa-up">⬆️ Up</button>` : ""}
    <h2 class="qa-heading">Narrow it down:</h2>
    <ul>${options
      .map((o) => {
        const icon = isResolved(hierarchy, o.code) ? "🏷️" : "📁";
        return `<li><button type="button" data-code="${o.code}">${icon} ${o.title}</button></li>`;
      })
      .join("")}</ul>
  `;
  qaEl.querySelector<HTMLButtonElement>("#naics-qa-up")?.addEventListener("click", () => {
    renderHierarchyQA(hierarchy, titles, path.slice(0, -1));
  });
  for (const btn of qaEl.querySelectorAll<HTMLButtonElement>("button.crumb")) {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      renderHierarchyQA(hierarchy, titles, idx < 0 ? [] : path.slice(0, idx + 1));
    });
  }
  for (const btn of qaEl.querySelectorAll<HTMLButtonElement>("button[data-code]")) {
    btn.addEventListener("click", () => {
      const nextCode = btn.dataset.code!;
      if (isResolved(hierarchy, nextCode)) {
        renderResult(nextCode, hierarchy, titles, 1, "high"); // §V3: confirmed leaf is a valid 6-digit code
        qaEl.hidden = true;
      } else {
        const nextTitle = getNode(hierarchy, nextCode)!.title;
        renderHierarchyQA(hierarchy, titles, [...path, { code: nextCode, title: nextTitle }]);
      }
    });
  }
}

interface CandidateGroup {
  code: string;
  title: string;
  candidates: NaicsScore[];
}

// Where do these candidates' hierarchy paths first disagree? Everything up to that depth is
// shared context (skip it — it's not a useful question); the groups AT that depth are the
// real fork. All model candidates are leaf codes, so paths are directly comparable by depth.
function divergeCandidates(candidates: NaicsScore[], hierarchy: HierarchyTree): CandidateGroup[] {
  const paths = candidates.map((c) => ({ c, path: getAncestorPath(hierarchy, c.naics) }));
  let depth = 0;
  while (!paths.some((p) => p.path.length <= depth + 1)) {
    const codesHere = new Set(paths.map((p) => p.path[depth].code));
    if (codesHere.size > 1) break;
    depth++;
  }
  const groups = new Map<string, CandidateGroup>();
  for (const { c, path } of paths) {
    const seg = path[depth];
    const code = seg?.code ?? c.naics;
    const title = seg?.title ?? getNode(hierarchy, c.naics)?.title ?? c.naics;
    if (!groups.has(code)) groups.set(code, { code, title, candidates: [] });
    groups.get(code)!.candidates.push(c);
  }
  return [...groups.values()];
}

function candidateCardHtml(
  c: NaicsScore,
  hierarchy: HierarchyTree,
  titles: Map<string, string>,
): string {
  const node = getNode(hierarchy, c.naics);
  const title = node?.title ?? titles.get(c.naics) ?? c.naics;
  const { label } = classifyConfidence(c.score, undefined);
  const def = node?.definition ? `<p class="definition">${node.definition}</p>` : "";
  return `<li><button type="button" data-code="${c.naics}">
    <div class="qa-cand-head">
      <span class="qa-cand-code">${c.naics}</span>
      <span class="qa-cand-title">${title}</span>
      <span class="qa-cand-conf">${CONFIDENCE_EMOJI[label] ?? ""} ${c.score.toFixed(2)}</span>
    </div>
    ${def}
  </button></li>`;
}

// §V9/§C: Q&A = model's own top-N candidates, narrowed via a decision tree built from where
// their hierarchy paths diverge — one branching question at a time instead of a flat wall of
// text, ⊥ LLM-generated questions. Falls back to a flat candidate list once ≤1 candidate or no
// further divergence remains. `stack` = decision history for breadcrumb + Up nav.
function renderQAStep(
  hierarchy: HierarchyTree,
  titles: Map<string, string>,
  stack: { candidates: NaicsScore[]; label: string | null }[],
) {
  qaEl.hidden = false;
  const { candidates } = stack[stack.length - 1];
  const groups = candidates.length > 1 ? divergeCandidates(candidates, hierarchy) : [];
  const crumbs = stack
    .map(
      (s, i) =>
        `<button type="button" class="crumb" data-idx="${i}">${i === 0 ? "🎯" : "📁"} ${s.label ?? "Top matches"}</button>`,
    )
    .join(" › ");
  const up = stack.length > 1 ? `<button type="button" id="naics-qa-up">⬆️ Up</button>` : "";

  if (groups.length > 1) {
    qaEl.innerHTML = `
      <nav class="qa-breadcrumb">${crumbs}</nav>
      ${up}
      <h2 class="qa-heading">Which is closer?</h2>
      <ul>${groups
        .map(
          (g) =>
            `<li><button type="button" data-group="${g.code}">📁 ${g.title} <span class="qa-cand-conf">(${g.candidates.length} match${g.candidates.length > 1 ? "es" : ""})</span></button></li>`,
        )
        .join("")}</ul>
      <button type="button" id="naics-qa-browse">None of these — browse full hierarchy</button>
    `;
    for (const btn of qaEl.querySelectorAll<HTMLButtonElement>("button[data-group]")) {
      btn.addEventListener("click", () => {
        const group = groups.find((g) => g.code === btn.dataset.group)!;
        renderQAStep(hierarchy, titles, [
          ...stack,
          { candidates: group.candidates, label: group.title },
        ]);
      });
    }
  } else {
    qaEl.innerHTML = `
      <nav class="qa-breadcrumb">${crumbs}</nav>
      ${up}
      <h2 class="qa-heading">${candidates.length > 1 ? "Not quite right? Did you mean:" : "Did you mean:"}</h2>
      <ul>${candidates.map((c) => candidateCardHtml(c, hierarchy, titles)).join("")}</ul>
      <button type="button" id="naics-qa-browse">None of these — browse full hierarchy</button>
    `;
    for (const btn of qaEl.querySelectorAll<HTMLButtonElement>("button[data-code]")) {
      btn.addEventListener("click", () => {
        const code = btn.dataset.code!;
        const candidate = candidates.find((c) => c.naics === code)!;
        renderResult(
          code,
          hierarchy,
          titles,
          candidate.score,
          classifyConfidence(candidate.score, undefined).label,
        );
        qaEl.hidden = true;
      });
    }
  }
  qaEl.querySelector<HTMLButtonElement>("#naics-qa-up")?.addEventListener("click", () => {
    renderQAStep(hierarchy, titles, stack.slice(0, -1));
  });
  for (const btn of qaEl.querySelectorAll<HTMLButtonElement>("button.crumb")) {
    btn.addEventListener("click", () => {
      renderQAStep(hierarchy, titles, stack.slice(0, Number(btn.dataset.idx) + 1));
    });
  }
  qaEl.querySelector<HTMLButtonElement>("#naics-qa-browse")!.addEventListener("click", () => {
    renderHierarchyQA(hierarchy, titles, []);
  });
}

function renderQA(candidates: NaicsScore[], hierarchy: HierarchyTree, titles: Map<string, string>) {
  renderQAStep(hierarchy, titles, [{ candidates, label: null }]);
}

async function handleSubmit(text: string) {
  const { model, titles, hierarchy } = await loaded; // §V5: await in-flight load, never drop/error
  qaEl.hidden = true;
  const top = model.predictTopN(text, 5);
  if (top.length === 0) {
    lastSearch = null;
    resultEl.hidden = false;
    resultEl.innerHTML = `<p>No match found. Try a different description.</p>`;
    return;
  }
  lastSearch = { candidates: top, hierarchy, titles };
  const { label, offerQA } = classifyConfidence(top[0].score, top[1]?.score);
  renderResult(top[0].naics, hierarchy, titles, top[0].score, label); // §V2/§V8: result always shown first
  if (offerQA) renderQA(top, hierarchy, titles);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (text) void handleSubmit(text);
});

// Enter submits (Shift+Enter for a newline), matching single-line input expectations.
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

// Auto-grow with content so longer descriptions stay fully visible while typing.
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = `${input.scrollHeight}px`;
  clearBtn.disabled = input.value.length === 0;
});

// textarea has no native type="search" clear-✕ — replicate it, and also reset
// results/Q&A so a cleared search doesn't leave a stale answer on screen.
clearBtn.addEventListener("click", () => {
  input.value = "";
  input.style.height = "auto";
  clearBtn.disabled = true;
  resultEl.hidden = true;
  resultEl.innerHTML = "";
  qaEl.hidden = true;
  qaEl.innerHTML = "";
  lastSearch = null;
  input.focus();
});
