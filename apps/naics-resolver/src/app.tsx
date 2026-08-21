import { loadNaics, type LoadedNaics, type NaicsScore } from "@cajuncodemonkey/naics-search";
import { useNaicsSearch } from "@cajuncodemonkey/naics-search-react";
import { useEffect, useRef, useState, type KeyboardEvent, type SubmitEvent } from "react";
import { ResultsList } from "./components/results-list.tsx";
import { SettingsSheet } from "./components/settings-sheet.tsx";
import { Button } from "./components/ui/button.tsx";
import { Skeleton } from "./components/ui/skeleton.tsx";
import { Textarea } from "./components/ui/textarea.tsx";
import { filterByFloor } from "./naics/floor.ts";
import { loadSettings, saveSettings, type Settings } from "./naics/settings.ts";
import { clearTermUrl, syncTermUrl } from "./term-url.ts";

// public/ assets need import.meta.env.BASE_URL prefix (§V11) — index.html-only rewrite doesn't reach JS-injected HTML.
const base = import.meta.env.BASE_URL;

export default function App() {
  const [initialTerm] = useState(() => new URLSearchParams(location.search).get("term") ?? "");
  const [settings, setSettingsState] = useState<Settings>(() =>
    loadSettings(new URLSearchParams(location.search)),
  );
  const [term, setTerm] = useState(initialTerm);
  const [candidates, setCandidates] = useState<NaicsScore[] | null>(null);
  const [noMatch, setNoMatch] = useState(false);
  const [pending, setPending] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // §V4/§V5: kicked off on mount (main.tsx wires spike mode in first, T70), never
  // awaited by input handling — submit before load done just awaits it (below).
  const naics = useNaicsSearch();
  const autoRanRef = useRef(false);
  const [showSkeleton, setShowSkeleton] = useState(false);

  // §V8: no loading/pending text — a Skeleton appears only once an in-flight submit
  // (model fetch + predict) has run past 2s, i.e. the model wasn't already cached.
  useEffect(() => {
    if (!pending) {
      setShowSkeleton(false);
      return;
    }
    const timer = setTimeout(() => setShowSkeleton(true), 2000);
    return () => clearTimeout(timer);
  }, [pending]);

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

  function applySettings(next: Settings) {
    setSettingsState(next);
    saveSettings(next); // §V15: write-through
  }

  async function handleSubmit(text: string, resources?: LoadedNaics) {
    setPending(true); // §V8: visible feedback (Skeleton, past 2s) while a submit is in-flight
    try {
      const { model } = resources ?? (await loadNaics()); // §V5: await in-flight load, never drop/error
      const top = model.predictTopN(text, 5);
      if (top.length === 0) {
        setCandidates(null);
        setNoMatch(true);
        return;
      }
      setNoMatch(false);
      syncTermUrl(text); // §V16: successful submit -> URL reflects the searched term.
      setCandidates(top); // §V5/§V14: always the full candidate list, ⊥ confidence-gated hero/list split
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
  // results so a cleared search doesn't leave a stale answer on screen.
  function onClear() {
    setTerm("");
    setCandidates(null);
    setNoMatch(false);
    clearTermUrl();
    textareaRef.current?.focus();
  }

  const displayed = candidates ? filterByFloor(candidates, settings.floor) : null;

  return (
    <>
      <header id="site-header">
        <h1>NAICS Code Resolver</h1>
        <SettingsSheet settings={settings} onChange={applySettings} />
      </header>
      <section id="resolver">
        <p>What does your business do? Type it below — we'll figure out the code.</p>
        <form id="naics-form" onSubmit={onFormSubmit}>
          <Textarea
            id="naics-input"
            rows={2}
            className="max-h-[200px] resize-none overflow-y-auto"
            placeholder="e.g. retail bakery"
            ref={textareaRef}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={onInputKeyDown}
          />
          <div id="naics-form-actions" className="flex flex-col gap-2 sm:flex-row">
            <Button id="naics-submit" type="submit" className="w-full sm:w-auto">
              Search
            </Button>
            <Button
              id="naics-clear"
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              disabled={term.length === 0}
              onClick={onClear}
            >
              Clear
            </Button>
          </div>
        </form>
        {naics.status === "error" && (
          <p id="naics-error" role="alert">
            ⚠️ Couldn't load NAICS data. Check your connection and reload the page to try again.
          </p>
        )}
        {pending && showSkeleton && (
          <div
            id="naics-skeleton"
            className="flex flex-col gap-4"
            role="status"
            aria-label="Finding code…"
          >
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}
        {!pending && displayed && naics.status === "ready" && displayed.length > 0 && (
          <ResultsList
            candidates={displayed}
            hierarchy={naics.hierarchy}
            titles={naics.titles}
            showDef={settings.showDef}
          />
        )}
        {!pending && noMatch && (
          <div id="naics-empty">
            <p>No match found. Try a different description.</p>
          </div>
        )}
        {!pending && displayed && displayed.length === 0 && (
          <div id="naics-empty">
            <p>No matches at your current confidence floor. Try lowering it in settings.</p>
          </div>
        )}
      </section>
      <footer id="site-footer">
        <a href="https://cajuncodemonkey.com/" target="_blank" rel="noopener" id="ccm-link">
          <img src={`${base}cajun-code-monkey.png`} alt="" width={25} height={28} /> A Cajun Code
          Monkey project
        </a>
        <a href="https://github.com/krcourville/naics-code-resolver" target="_blank" rel="noopener">
          <svg height="28" width="28" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
          </svg>
          naics-code-resolver (MIT)
        </a>
        <a
          id="how-it-works-link"
          href="https://github.com/krcourville/naics-code-resolver#how-does-it-work"
          target="_blank"
          rel="noopener"
        >
          💡 How does it work?
        </a>
      </footer>
    </>
  );
}
