import {
  censusUrl,
  getAncestorPath,
  getNode,
  type HierarchyTree,
  type NaicsScore,
} from "@cajuncodemonkey/naics-search";
import { Fragment } from "react";
import { CONFIDENCE_EMOJI, classifyConfidence } from "../naics/confidence.ts";

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
            {CONFIDENCE_EMOJI[label]} {candidate.score.toFixed(2)}
          </span>
        </div>
        {node?.definition && <p className="definition">{node.definition}</p>}
      </button>
      <a className="census-link" href={censusUrl(candidate.naics)} target="_blank" rel="noopener">
        View {candidate.naics} on census.gov
      </a>
    </li>
  );
}

// §V9/§C: Q&A = model's own top-N candidates, narrowed via a decision tree built from where
// their hierarchy paths diverge, one branching question at a time instead of a flat wall of
// text, ⊥ LLM-generated questions. Falls back to a flat candidate list once ≤1 candidate or no
// further divergence remains. `stack` = decision history for breadcrumb + Up nav.
export function TreeQA({
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
