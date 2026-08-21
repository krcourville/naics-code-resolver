import type { NaicsScore } from "@cajuncodemonkey/naics-search";

/** §V18: drop candidates below `floor` for display. */
export function filterByFloor(candidates: NaicsScore[], floor: number): NaicsScore[] {
  if (floor <= 0) return candidates;
  return candidates.filter((c) => c.score >= floor);
}
