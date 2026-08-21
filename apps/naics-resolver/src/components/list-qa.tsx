import {
  censusUrl,
  getNode,
  type HierarchyTree,
  type NaicsScore,
} from "@cajuncodemonkey/naics-search";
import { CONFIDENCE_EMOJI, classifyConfidence } from "../naics/confidence.ts";

// §V17: plain-list alternative to the decision tree — fixed 2-line rows (never reflow across
// breakpoints): line 1 = code + title, line 2 = confidence + "Select" button. Definitions are
// governed by one "Show definitions" toggle above the whole list (§C alwaysShowDefinition),
// not per row.
export function ListQA({
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
                    {CONFIDENCE_EMOJI[label]} {c.score.toFixed(2)}
                  </span>
                  <span className="qa-cand-code">{c.naics}</span>
                  <span className="qa-cand-title">{title}</span>
                </div>
                {showDef && node?.definition && <p className="definition">{node.definition}</p>}
              </button>
              <a className="census-link" href={censusUrl(c.naics)} target="_blank" rel="noopener">
                View {c.naics} on census.gov
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
