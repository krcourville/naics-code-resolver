import { censusUrl, getNode, type HierarchyTree } from "@cajuncodemonkey/naics-search";
import { CONFIDENCE_EMOJI } from "../naics/confidence.ts";
import { Button } from "./ui/button.tsx";
import { Card, CardContent } from "./ui/card.tsx";

export function ResultPanel({
  code,
  score,
  label,
  hierarchy,
  titles,
  onTryAgain,
}: {
  code: string;
  score: number;
  label: "high" | "medium" | "low";
  hierarchy: HierarchyTree;
  titles: Map<string, string>;
  onTryAgain: () => void;
}) {
  const node = getNode(hierarchy, code);
  const title = node?.title ?? titles.get(code) ?? "";
  return (
    <Card id="naics-result">
      <CardContent>
        <p className="code">{code}</p>
        <p className="title">{title}</p>
        <p className="confidence">
          {CONFIDENCE_EMOJI[label]} confidence: {score.toFixed(2)} ({label})
        </p>
        {node?.definition && <p className="definition">{node.definition}</p>}
        {node?.examples?.length ? (
          <ul className="examples">
            {node.examples.map((ex, i) => (
              <li key={i}>{ex}</li>
            ))}
          </ul>
        ) : null}
        <a className="census-link" href={censusUrl(code)} target="_blank" rel="noopener">
          View {code} on census.gov
        </a>
        <Button
          type="button"
          id="naics-try-again"
          variant="link"
          className="mt-4 block h-auto p-0"
          onClick={onTryAgain}
        >
          🔄 See other matches
        </Button>
      </CardContent>
    </Card>
  );
}
