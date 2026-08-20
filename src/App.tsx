import { Fragment, useEffect, useRef, useState, type KeyboardEvent, type SubmitEvent } from "react";
import {
  drilldownOptions,
  getAncestorPath,
  getNode,
  isResolved,
  loadNaics,
  type DrillOption,
  type HierarchyTree,
  type LoadedNaics,
  type NaicsScore,
} from "@cajuncodemonkey/naics-search";
import { classifyConfidence } from "./naics/confidence.ts";
import { filterByFloor } from "./naics/floor.ts";
import {
  clampFloor,
  loadSettings,
  saveSettings,
  type DetailsMode,
  type Settings,
} from "./naics/settings.ts";

// public/ assets need import.meta.env.BASE_URL prefix (§V11) — index.html-only rewrite doesn't reach JS-injected HTML.
const base = import.meta.env.BASE_URL;

const CONFIDENCE_EMOJI: Record<string, string> = { high: "🟢", medium: "🟡", low: "🔴" };

interface ResultState {
  code: string;
  score: number;
  label: string;
}

interface LastSearch {
  candidates: NaicsScore[];
  offerQA: boolean;
}

type QAState =
  | { type: "hierarchy"; path: DrillOption[] }
  | { type: "tree"; stack: { candidates: NaicsScore[]; label: string | null }[] }
  | { type: "list"; pool: NaicsScore[] };

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

function syncTermUrl(term: string) {
  const params = new URLSearchParams(location.search);
  params.set("term", term);
  history.replaceState(null, "", `${location.pathname}?${params}`); // §V16: replaceState, ⊥ history spam
}

function clearTermUrl() {
  const params = new URLSearchParams(location.search);
  params.delete("term");
  history.replaceState(null, "", `${location.pathname}?${params}`);
}

function ResultPanel({
  code,
  score,
  label,
  hierarchy,
  titles,
  onTryAgain,
}: {
  code: string;
  score: number;
  label: string;
  hierarchy: HierarchyTree;
  titles: Map<string, string>;
  onTryAgain: () => void;
}) {
  const node = getNode(hierarchy, code);
  const title = node?.title ?? titles.get(code) ?? "";
  return (
    <div id="naics-result">
      <p className="code">{code}</p>
      <p className="title">{title}</p>
      <p className="confidence">
        {CONFIDENCE_EMOJI[label] ?? ""} confidence: {score.toFixed(2)} ({label})
      </p>
      {node?.definition && <p className="definition">{node.definition}</p>}
      {node?.examples?.length ? (
        <ul className="examples">
          {node.examples.map((ex, i) => (
            <li key={i}>{ex}</li>
          ))}
        </ul>
      ) : null}
      <button type="button" id="naics-try-again" onClick={onTryAgain}>
        🔄 See other matches
      </button>
    </div>
  );
}

// §C: clarifying Q&A = static hierarchy drill-down only, ⊥ model/LLM-generated questions.
// `path` = breadcrumb from root to current level (empty = root/all sectors), directory-style
// nav: breadcrumb segments jump back to any ancestor, "Up" pops one level (§V9 backprop: no way back).
function HierarchyQA({
  hierarchy,
  path,
  onNavigate,
  onOptionClick,
}: {
  hierarchy: HierarchyTree;
  path: DrillOption[];
  onNavigate: (path: DrillOption[]) => void;
  onOptionClick: (code: string) => void;
}) {
  const code = path.length ? path[path.length - 1].code : null;
  const options = drilldownOptions(hierarchy, code);
  return (
    <div id="naics-qa">
      <nav className="qa-breadcrumb">
        <button type="button" className="crumb" data-idx={-1} onClick={() => onNavigate([])}>
          🏠 All sectors
        </button>
        {path.map((p, i) => (
          <Fragment key={p.code}>
            {" › "}
            <button
              type="button"
              className="crumb"
              data-idx={i}
              onClick={() => onNavigate(path.slice(0, i + 1))}
            >
              📁 {p.title}
            </button>
          </Fragment>
        ))}
      </nav>
      {path.length > 0 && (
        <button type="button" id="naics-qa-up" onClick={() => onNavigate(path.slice(0, -1))}>
          ⬆️ Up
        </button>
      )}
      <h2 className="qa-heading">Narrow it down:</h2>
      <ul>
        {options.map((o) => {
          const icon = isResolved(hierarchy, o.code) ? "🏷️" : "📁";
          return (
            <li key={o.code}>
              <button type="button" data-code={o.code} onClick={() => onOptionClick(o.code)}>
                {icon} {o.title}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CandidateCard({
  candidate,
  hierarchy,
  titles,
  onPick,
}: {
  candidate: NaicsScore;
  hierarchy: HierarchyTree;
  titles: Map<string, string>;
  onPick: (code: string, score: number) => void;
}) {
  const node = getNode(hierarchy, candidate.naics);
  const title = node?.title ?? titles.get(candidate.naics) ?? candidate.naics;
  const { label } = classifyConfidence(candidate.score, undefined);
  return (
    <li>
      <button
        type="button"
        data-code={candidate.naics}
        onClick={() => onPick(candidate.naics, candidate.score)}
      >
        <div className="qa-cand-head">
          <span className="qa-cand-code">{candidate.naics}</span>
          <span className="qa-cand-title">{title}</span>
          <span className="qa-cand-conf">
            {CONFIDENCE_EMOJI[label] ?? ""} {candidate.score.toFixed(2)}
          </span>
        </div>
        {node?.definition && <p className="definition">{node.definition}</p>}
      </button>
    </li>
  );
}

// §V9/§C: Q&A = model's own top-N candidates, narrowed via a decision tree built from where
// their hierarchy paths diverge, one branching question at a time instead of a flat wall of
// text, ⊥ LLM-generated questions. Falls back to a flat candidate list once ≤1 candidate or no
// further divergence remains. `stack` = decision history for breadcrumb + Up nav.
function TreeQA({
  hierarchy,
  titles,
  stack,
  onNavigate,
  onPick,
  onBrowseFull,
}: {
  hierarchy: HierarchyTree;
  titles: Map<string, string>;
  stack: { candidates: NaicsScore[]; label: string | null }[];
  onNavigate: (stack: { candidates: NaicsScore[]; label: string | null }[]) => void;
  onPick: (code: string, score: number) => void;
  onBrowseFull: () => void;
}) {
  const { candidates } = stack[stack.length - 1];
  const groups = candidates.length > 1 ? divergeCandidates(candidates, hierarchy) : [];
  return (
    <div id="naics-qa">
      <nav className="qa-breadcrumb">
        {stack.map((s, i) => (
          <Fragment key={i}>
            {i > 0 && " › "}
            <button
              type="button"
              className="crumb"
              data-idx={i}
              onClick={() => onNavigate(stack.slice(0, i + 1))}
            >
              {i === 0 ? "🎯" : "📁"} {s.label ?? "Top matches"}
            </button>
          </Fragment>
        ))}
      </nav>
      {stack.length > 1 && (
        <button type="button" id="naics-qa-up" onClick={() => onNavigate(stack.slice(0, -1))}>
          ⬆️ Up
        </button>
      )}
      {groups.length > 1 ? (
        <>
          <h2 className="qa-heading">Which is closer?</h2>
          <ul>
            {groups.map((g) => (
              <li key={g.code}>
                <button
                  type="button"
                  data-group={g.code}
                  onClick={() =>
                    onNavigate([...stack, { candidates: g.candidates, label: g.title }])
                  }
                >
                  📁 {g.title}{" "}
                  <span className="qa-cand-conf">
                    ({g.candidates.length} match{g.candidates.length > 1 ? "es" : ""})
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" id="naics-qa-browse" onClick={onBrowseFull}>
            None of these — browse full hierarchy
          </button>
        </>
      ) : (
        <>
          <h2 className="qa-heading">
            {candidates.length > 1 ? "Not quite right? Did you mean:" : "Did you mean:"}
          </h2>
          <ul>
            {candidates.map((c) => (
              <CandidateCard
                key={c.naics}
                candidate={c}
                hierarchy={hierarchy}
                titles={titles}
                onPick={onPick}
              />
            ))}
          </ul>
          <button type="button" id="naics-qa-browse" onClick={onBrowseFull}>
            None of these — browse full hierarchy
          </button>
        </>
      )}
    </div>
  );
}

// §V17: plain-list alternative to the decision tree — fixed 2-line rows (never reflow across
// breakpoints): line 1 = code + title, line 2 = confidence + "Select" button. Definitions are
// governed by one "Show definitions" toggle above the whole list (§C alwaysShowDefinition),
// not per row.
function ListQA({
  candidates,
  hierarchy,
  titles,
  showDef,
  onToggleShowDef,
  onPick,
}: {
  candidates: NaicsScore[];
  hierarchy: HierarchyTree;
  titles: Map<string, string>;
  showDef: boolean;
  onToggleShowDef: (checked: boolean) => void;
  onPick: (code: string, score: number) => void;
}) {
  return (
    <div id="naics-qa">
      <h2 className="qa-heading">Top matches</h2>
      <label className="qa-list-showdef">
        <input
          type="checkbox"
          id="qa-list-showdef"
          checked={showDef}
          onChange={(e) => onToggleShowDef(e.target.checked)}
        />{" "}
        Show definitions
      </label>
      <ul className="qa-list">
        {candidates.map((c) => {
          const node = getNode(hierarchy, c.naics);
          const title = node?.title ?? titles.get(c.naics) ?? c.naics;
          const { label } = classifyConfidence(c.score, undefined);
          return (
            <li key={c.naics}>
              <button
                type="button"
                className="qa-list-row"
                data-code={c.naics}
                onClick={() => onPick(c.naics, c.score)}
              >
                <div className="qa-list-line1">
                  <span className="qa-cand-conf">
                    {CONFIDENCE_EMOJI[label] ?? ""} {c.score.toFixed(2)}
                  </span>
                  <span className="qa-cand-code">{c.naics}</span>
                  <span className="qa-cand-title">{title}</span>
                </div>
                {showDef && node?.definition && <p className="definition">{node.definition}</p>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function App() {
  const [initialTerm] = useState(() => new URLSearchParams(location.search).get("term") ?? "");
  const [settings, setSettingsState] = useState<Settings>(() =>
    loadSettings(new URLSearchParams(location.search)),
  );
  const [term, setTerm] = useState(initialTerm);
  const [loaded, setLoaded] = useState<LoadedNaics | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);
  const [noMatch, setNoMatch] = useState(false);
  const [qa, setQa] = useState<QAState | null>(null);
  const [lastSearch, setLastSearch] = useState<LastSearch | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const loadedRef = useRef<Promise<LoadedNaics>>(loadNaics()); // kicked off on mount, never awaited by input handling (§V4)
  const autoRanRef = useRef(false);

  useEffect(() => {
    saveSettings(settings); // §V15: URL/localStorage always reflect the effective (merged) settings.
  }, []);

  useEffect(() => {
    void loadedRef.current.then(setLoaded);
  }, []);

  // Auto-grow with content so longer descriptions stay fully visible while typing.
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [term]);

  // §V16: `term` query param on load prefills the input and auto-runs the search
  // once model/hierarchy load finishes (§V5), so a shared URL reproduces its result.
  useEffect(() => {
    if (initialTerm && loaded && !autoRanRef.current) {
      autoRanRef.current = true;
      void handleSubmit(initialTerm, loaded);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  function startQA(candidates: NaicsScore[], s: Settings) {
    const pool = filterByFloor(candidates, s.floor); // §V18: raw scores already classified; floor only narrows display
    if (pool.length === 0) {
      setQa({ type: "hierarchy", path: [] }); // empty pool -> full hierarchy browse, ⊥ blank list
    } else if (s.details === "list") {
      setQa({ type: "list", pool });
    } else {
      setQa({ type: "tree", stack: [{ candidates: pool, label: null }] });
    }
  }

  function applySettings(next: Settings) {
    setSettingsState(next);
    saveSettings(next); // §V15: write-through
    if (lastSearch?.offerQA) startQA(lastSearch.candidates, next);
  }

  function pickResult(code: string, score: number, label: string) {
    setResult({ code, score, label });
    setQa(null);
  }

  async function handleSubmit(text: string, resources?: LoadedNaics) {
    const { model } = resources ?? (await loadedRef.current); // §V5: await in-flight load, never drop/error
    setQa(null);
    const top = model.predictTopN(text, 5);
    if (top.length === 0) {
      setLastSearch(null);
      setResult(null);
      setNoMatch(true);
      return;
    }
    setNoMatch(false);
    syncTermUrl(text); // §V16: successful submit -> URL reflects the searched term.
    const { label, offerQA } = classifyConfidence(top[0].score, top[1]?.score); // §V18: raw, pre-floor scores
    setLastSearch({ candidates: top, offerQA });
    setResult({ code: top[0].naics, score: top[0].score, label }); // §V2/§V8: result always shown first
    if (offerQA) startQA(top, settings);
  }

  function onFormSubmit(event: SubmitEvent) {
    event.preventDefault();
    const text = term.trim();
    if (text) void handleSubmit(text);
  }

  // Enter submits (Shift+Enter for a newline), matching single-line input expectations.
  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  // textarea has no native type="search" clear-✕ — replicate it, and also reset
  // results/Q&A so a cleared search doesn't leave a stale answer on screen.
  function onClear() {
    setTerm("");
    setResult(null);
    setNoMatch(false);
    setQa(null);
    setLastSearch(null);
    clearTermUrl();
    textareaRef.current?.focus();
  }

  return (
    <>
      <header id="site-header">
        <h1>NAICS Code Resolver</h1>
        <div id="header-links">
          <a href="https://cajuncodemonkey.com/" target="_blank" rel="noopener" id="ccm-link">
            <img src={`${base}cajun-code-monkey.png`} alt="" width={25} height={28} /> A Cajun Code
            Monkey project
          </a>
          <a
            href="https://github.com/krcourville/naics-code-resolver"
            target="_blank"
            rel="noopener"
          >
            <svg height="28" width="28" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
            naics-code-resolver (MIT)
          </a>
        </div>
        <details id="settings-panel">
          <summary>⚙️ Settings</summary>
          <div className="settings-fields">
            <label htmlFor="setting-details">Result view</label>
            <select
              id="setting-details"
              value={settings.details}
              onChange={(e) =>
                applySettings({ ...settings, details: e.target.value as DetailsMode })
              }
            >
              <option value="list">Plain list</option>
              <option value="tree">Decision tree</option>
            </select>
            <label htmlFor="setting-floor">Confidence floor (0–1)</label>
            <input
              type="number"
              id="setting-floor"
              min={0}
              max={1}
              step={0.05}
              value={settings.floor}
              onChange={(e) =>
                applySettings({ ...settings, floor: clampFloor(Number(e.target.value) || 0) })
              }
            />
          </div>
        </details>
      </header>
      <section id="resolver">
        <p>What does your business do? Type it below — we'll figure out the code.</p>
        <form id="naics-form" onSubmit={onFormSubmit}>
          <textarea
            id="naics-input"
            rows={2}
            placeholder="e.g. retail bakery"
            ref={textareaRef}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={onInputKeyDown}
          />
          <div id="naics-form-actions">
            <button id="naics-submit" type="submit">
              Find code
            </button>
            <button id="naics-clear" type="button" disabled={term.length === 0} onClick={onClear}>
              Clear
            </button>
          </div>
        </form>
        <a
          id="how-it-works-link"
          href="https://github.com/krcourville/naics-code-resolver#how-does-it-work"
          target="_blank"
          rel="noopener"
        >
          💡 How does it work?
        </a>
        {result && loaded && (
          <ResultPanel
            code={result.code}
            score={result.score}
            label={result.label}
            hierarchy={loaded.hierarchy}
            titles={loaded.titles}
            onTryAgain={() => {
              if (lastSearch) startQA(lastSearch.candidates, settings);
            }}
          />
        )}
        {noMatch && (
          <div id="naics-result">
            <p>No match found. Try a different description.</p>
          </div>
        )}
        {qa && loaded && qa.type === "hierarchy" && (
          <HierarchyQA
            hierarchy={loaded.hierarchy}
            path={qa.path}
            onNavigate={(path) => setQa({ type: "hierarchy", path })}
            onOptionClick={(code) => {
              if (isResolved(loaded.hierarchy, code)) {
                pickResult(code, 1, "high"); // §V3: confirmed leaf is a valid 6-digit code
              } else {
                const title = getNode(loaded.hierarchy, code)!.title;
                setQa({ type: "hierarchy", path: [...qa.path, { code, title }] });
              }
            }}
          />
        )}
        {qa && loaded && qa.type === "tree" && (
          <TreeQA
            hierarchy={loaded.hierarchy}
            titles={loaded.titles}
            stack={qa.stack}
            onNavigate={(stack) => setQa({ type: "tree", stack })}
            onPick={(code, score) =>
              pickResult(code, score, classifyConfidence(score, undefined).label)
            }
            onBrowseFull={() => setQa({ type: "hierarchy", path: [] })}
          />
        )}
        {qa && loaded && qa.type === "list" && (
          <ListQA
            candidates={qa.pool}
            hierarchy={loaded.hierarchy}
            titles={loaded.titles}
            showDef={settings.showDef}
            onToggleShowDef={(checked) => applySettings({ ...settings, showDef: checked })}
            onPick={(code, score) =>
              pickResult(code, score, classifyConfidence(score, undefined).label)
            }
          />
        )}
      </section>
    </>
  );
}
