import {
  censusUrl,
  getNode,
  type HierarchyTree,
  type NaicsScore,
} from "@cajuncodemonkey/naics-search";
import { CONFIDENCE_EMOJI, classifyConfidence } from "../naics/confidence.ts";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "./ui/item.tsx";

// §V5/§V14: every candidate renders as an Item, ∀ confidence tier — no hero card,
// no picked/selected state, no confidence-gated hide/show.
export function ResultsList({
  candidates,
  hierarchy,
  titles,
  showDef,
}: {
  candidates: NaicsScore[];
  hierarchy: HierarchyTree;
  titles: Map<string, string>;
  showDef: boolean;
}) {
  return (
    <ItemGroup id="naics-result">
      {candidates.map((c) => {
        const node = getNode(hierarchy, c.naics);
        const title = node?.title ?? titles.get(c.naics) ?? c.naics;
        const { label } = classifyConfidence(c.score);
        return (
          <Item
            key={c.naics}
            variant="outline"
            role="listitem"
            className="items-start"
            data-code={c.naics}
          >
            <ItemContent>
              <ItemTitle className="line-clamp-none block w-full whitespace-normal">
                {c.naics} {title}
              </ItemTitle>
              {showDef && node?.definition && (
                <ItemDescription className="line-clamp-none">{node.definition}</ItemDescription>
              )}
              {showDef && node?.examples?.length ? (
                <ul className="list-disc pl-5 text-xs text-muted-foreground">
                  {node.examples.map((ex, i) => (
                    <li key={i}>{ex}</li>
                  ))}
                </ul>
              ) : null}
              <a
                className="census-link text-xs"
                href={censusUrl(c.naics)}
                target="_blank"
                rel="noopener"
              >
                View {c.naics} on census.gov
              </a>
            </ItemContent>
            <ItemActions>
              <span className="text-xs whitespace-nowrap text-muted-foreground">
                {CONFIDENCE_EMOJI[label]} {c.score.toFixed(2)}
              </span>
            </ItemActions>
          </Item>
        );
      })}
    </ItemGroup>
  );
}
