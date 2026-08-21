import {
  getNode,
  isResolved,
  loadNaics,
  type DrillOption,
  type LoadedNaics,
  type NaicsScore,
} from "@cajuncodemonkey/naics-search";
import { useNaicsSearch } from "@cajuncodemonkey/naics-search-react";
import { useEffect, useRef, useState, type KeyboardEvent, type SubmitEvent } from "react";
import { HierarchyQA } from "./components/hierarchy-qa.tsx";
import { ListQA } from "./components/list-qa.tsx";
import { ResultPanel } from "./components/result-panel.tsx";
import { TreeQA } from "./components/tree-qa.tsx";
import { classifyConfidence } from "./naics/confidence.ts";
import { filterByFloor } from "./naics/floor.ts";
import {
  clampFloor,
  loadSettings,
  saveSettings,
  type DetailsMode,
  type Settings,
} from "./naics/settings.ts";
import { clearTermUrl, syncTermUrl } from "./term-url.ts";

// public/ assets need import.meta.env.BASE_URL prefix (§V11) — index.html-only rewrite doesn't reach JS-injected HTML.
const base = import.meta.env.BASE_URL;

interface ResultState {
  code: string;
  score: number;
  label: "high" | "medium" | "low";
}

interface LastSearch {
  candidates: NaicsScore[];
  offerQA: boolean;
}

type QAState =
  | { type: "hierarchy"; path: DrillOption[] }
  | { type: "tree"; stack: { candidates: NaicsScore[]; label: string | null }[] }
  | { type: "list"; pool: NaicsScore[] };

export default function App() {
  const [initialTerm] = useState(() => new URLSearchParams(location.search).get("term") ?? "");
  const [settings, setSettingsState] = useState<Settings>(() =>
    loadSettings(new URLSearchParams(location.search)),
  );
  const [term, setTerm] = useState(initialTerm);
  const [result, setResult] = useState<ResultState | null>(null);
  const [noMatch, setNoMatch] = useState(false);
  const [pending, setPending] = useState(false);
  const [qa, setQa] = useState<QAState | null>(null);
  const [lastSearch, setLastSearch] = useState<LastSearch | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // §V4/§V5: kicked off on mount (main.tsx wires spike mode in first, T70), never
  // awaited by input handling — submit before load done just awaits it (below).
  const naics = useNaicsSearch();
  const autoRanRef = useRef(false);
  const [showLoadingText, setShowLoadingText] = useState(false);

  // §V28: don't flash "Loading…" text on fast (<2s) loads — distracting when the
  // action resolves near-instantly. status itself still updates immediately.
  useEffect(() => {
    if (naics.status !== "loading") {
      setShowLoadingText(false);
      return;
    }
    const timer = setTimeout(() => setShowLoadingText(true), 2000);
    return () => clearTimeout(timer);
  }, [naics.status]);

  useEffect(() => {
    saveSettings(settings); // §V15: URL/localStorage always reflect the effective (merged) settings.
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
    if (initialTerm && naics.status === "ready" && !autoRanRef.current) {
      autoRanRef.current = true;
      void handleSubmit(initialTerm, naics);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naics.status]);

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

  function pickResult(code: string, score: number, label: "high" | "medium" | "low") {
    setResult({ code, score, label });
    setQa(null);
  }

  async function handleSubmit(text: string, resources?: LoadedNaics) {
    setPending(true); // §V28: visible feedback while a submit is in-flight (mostly the §V5 load-wait case)
    try {
      const { model } = resources ?? (await loadNaics()); // §V5: await in-flight load, never drop/error
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
    } finally {
      setPending(false);
    }
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
        {naics.status === "loading" && showLoadingText && (
          <p id="naics-loading" role="status">
            ⏳ Loading NAICS model…
          </p>
        )}
        {naics.status === "error" && (
          <p id="naics-error" role="alert">
            ⚠️ Couldn't load NAICS data. Check your connection and reload the page to try again.
          </p>
        )}
        {pending && naics.status === "ready" && (
          <p id="naics-pending" role="status">
            ⏳ Finding code…
          </p>
        )}
        {result && naics.status === "ready" && (
          <ResultPanel
            code={result.code}
            score={result.score}
            label={result.label}
            hierarchy={naics.hierarchy}
            titles={naics.titles}
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
        {qa && naics.status === "ready" && qa.type === "hierarchy" && (
          <HierarchyQA
            hierarchy={naics.hierarchy}
            path={qa.path}
            onNavigate={(path) => setQa({ type: "hierarchy", path })}
            onOptionClick={(code) => {
              if (isResolved(naics.hierarchy, code)) {
                pickResult(code, 1, "high"); // §V3: confirmed leaf is a valid 6-digit code
              } else {
                const title = getNode(naics.hierarchy, code)!.title;
                setQa({ type: "hierarchy", path: [...qa.path, { code, title }] });
              }
            }}
          />
        )}
        {qa && naics.status === "ready" && qa.type === "tree" && (
          <TreeQA
            hierarchy={naics.hierarchy}
            titles={naics.titles}
            stack={qa.stack}
            onNavigate={(stack) => setQa({ type: "tree", stack })}
            onPick={(code, score) =>
              pickResult(code, score, classifyConfidence(score, undefined).label)
            }
            onBrowseFull={() => setQa({ type: "hierarchy", path: [] })}
          />
        )}
        {qa && naics.status === "ready" && qa.type === "list" && (
          <ListQA
            candidates={qa.pool}
            hierarchy={naics.hierarchy}
            titles={naics.titles}
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
