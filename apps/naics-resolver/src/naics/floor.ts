import type { NaicsScore } from "@cajuncodemonkey/naics-search";

/** §V18: drop candidates below `floor`. Runs AFTER the §V2 band/offerQA decision — callers
 * must classify confidence off the raw (unfiltered) top-2 scores first, then filter for display. */
export function filterByFloor(candidates: NaicsScore[], floor: number): NaicsScore[] {
  if (floor <= 0) return candidates;
  return candidates.filter((c) => c.score >= floor);
}
