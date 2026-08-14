import "./style.css";
import { loadNaics } from "./naics/loader.ts";
import { classifyConfidence } from "./naics/confidence.ts";
import { drilldownOptions, isResolved } from "./naics/drilldown.ts";
import type { HierarchyTree } from "./naics/hierarchy.ts";
import type { NaicsScore } from "./naics/beacon-model.ts";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
<section id="resolver">
  <h1>NAICS Code Resolver</h1>
  <p>Describe your business. We'll match it to a 6-digit NAICS code.</p>
  <form id="naics-form">
    <input id="naics-input" type="text" placeholder="e.g. retail bakery" autocomplete="off" />
    <button id="naics-submit" type="submit">Find code</button>
  </form>
  <div id="naics-result" hidden></div>
  <div id="naics-qa" hidden></div>
</section>
`;

const form = document.querySelector<HTMLFormElement>("#naics-form")!;
const input = document.querySelector<HTMLInputElement>("#naics-input")!;
const resultEl = document.querySelector<HTMLDivElement>("#naics-result")!;
const qaEl = document.querySelector<HTMLDivElement>("#naics-qa")!;

// Kicked off on mount, never awaited by input handling (§V4) — submit awaits
// this same in-flight promise if it lands early (§V5, loader dedupes it).
const loaded = loadNaics();

function renderResult(code: string, titles: Map<string, string>, score: number, label: string) {
  const title = titles.get(code) ?? "";
  resultEl.hidden = false;
  resultEl.innerHTML = `
    <p class="code">${code}</p>
    <p class="title">${title}</p>
    <p class="confidence">confidence: ${score.toFixed(2)} (${label})</p>
  `;
}

// §C: clarifying Q&A = static hierarchy drill-down only, ⊥ model/LLM-generated questions.
function renderHierarchyQA(
  hierarchy: HierarchyTree,
  titles: Map<string, string>,
  code: string | null,
) {
  const options = drilldownOptions(hierarchy, code);
  qaEl.innerHTML = `
    <p>Narrow it down:</p>
    <ul>${options.map((o) => `<li><button type="button" data-code="${o.code}">${o.title}</button></li>`).join("")}</ul>
  `;
  for (const btn of qaEl.querySelectorAll<HTMLButtonElement>("button[data-code]")) {
    btn.addEventListener("click", () => {
      const nextCode = btn.dataset.code!;
      if (isResolved(hierarchy, nextCode)) {
        renderResult(nextCode, titles, 1, "high"); // §V3: confirmed leaf is a valid 6-digit code
        qaEl.hidden = true;
      } else {
        renderHierarchyQA(hierarchy, titles, nextCode);
      }
    });
  }
}

// §V9: Q&A first offers the model's own top-N candidates, not the full hierarchy.
function renderQA(candidates: NaicsScore[], hierarchy: HierarchyTree, titles: Map<string, string>) {
  qaEl.hidden = false;
  qaEl.innerHTML = `
    <p>Not quite right? Did you mean:</p>
    <ul>${candidates
      .map(
        (c) =>
          `<li><button type="button" data-code="${c.naics}">${titles.get(c.naics) ?? c.naics}</button></li>`,
      )
      .join("")}</ul>
    <button type="button" id="naics-qa-browse">None of these — browse full hierarchy</button>
  `;
  for (const btn of qaEl.querySelectorAll<HTMLButtonElement>("button[data-code]")) {
    btn.addEventListener("click", () => {
      const code = btn.dataset.code!;
      if (isResolved(hierarchy, code)) {
        const candidate = candidates.find((c) => c.naics === code)!;
        renderResult(
          code,
          titles,
          candidate.score,
          classifyConfidence(candidate.score, undefined).label,
        );
        qaEl.hidden = true;
      } else {
        renderHierarchyQA(hierarchy, titles, code);
      }
    });
  }
  qaEl.querySelector<HTMLButtonElement>("#naics-qa-browse")!.addEventListener("click", () => {
    renderHierarchyQA(hierarchy, titles, null);
  });
}

async function handleSubmit(text: string) {
  const { model, titles, hierarchy } = await loaded; // §V5: await in-flight load, never drop/error
  qaEl.hidden = true;
  const top = model.predictTopN(text, 5);
  if (top.length === 0) {
    resultEl.hidden = false;
    resultEl.innerHTML = `<p>No match found. Try a different description.</p>`;
    return;
  }
  const { label, offerQA } = classifyConfidence(top[0].score, top[1]?.score);
  renderResult(top[0].naics, titles, top[0].score, label); // §V2/§V8: result always shown first
  if (offerQA) renderQA(top, hierarchy, titles);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (text) void handleSubmit(text);
});
