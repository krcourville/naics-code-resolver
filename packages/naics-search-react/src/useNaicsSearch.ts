import { useEffect, useState } from "react";
import {
  censusUrl,
  drilldownOptions,
  getAncestorPath,
  getNode,
  isResolved,
  loadNaics,
  search,
  type LoadedNaics,
} from "@cajuncodemonkey/naics-search";

type Status =
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | ({ status: "ready" } & Ready);

interface Ready extends LoadedNaics {
  search: typeof search;
  drilldownOptions: typeof drilldownOptions;
  getNode: typeof getNode;
  isResolved: typeof isResolved;
  getAncestorPath: typeof getAncestorPath;
  censusUrl: typeof censusUrl;
}

function toReady(loaded: LoadedNaics): Ready {
  return { ...loaded, search, drilldownOptions, getNode, isResolved, getAncestorPath, censusUrl };
}

/**
 * Thin React wrapper over `@cajuncodemonkey/naics-search`'s `loadNaics()`
 * load-state — `status` starts `'loading'`, moves to `'error'` (network/data
 * fetch failed, §V49) or `'ready'` (the resolved `LoadedNaics` — model,
 * hierarchy, titles — plus `search()`/drilldown fns available). Owns no app
 * policy (confidence bands, settings, Q&A UI) — that stays in the consuming
 * app.
 */
export function useNaicsSearch(): Status {
  const [state, setState] = useState<Status>({ status: "loading" });

  useEffect(() => {
    let cancelled = false; // §V56: never setState after unmount
    loadNaics().then(
      (loaded) => {
        if (!cancelled) setState({ status: "ready", ...toReady(loaded) });
      },
      (error: unknown) => {
        if (!cancelled) setState({ status: "error", error });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
