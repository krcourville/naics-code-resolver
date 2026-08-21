import {
  drilldownOptions,
  isResolved,
  type DrillOption,
  type HierarchyTree,
} from "@cajuncodemonkey/naics-search";
import { Fragment } from "react";

// §C: clarifying Q&A = static hierarchy drill-down only, ⊥ model/LLM-generated questions.
// `path` = breadcrumb from root to current level (empty = root/all sectors), directory-style
// nav: breadcrumb segments jump back to any ancestor, "Up" pops one level (§V9 backprop: no way back).
export function HierarchyQA({
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
