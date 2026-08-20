/** One node in the official NAICS hierarchy (sector down to 6-digit code). */
export interface HierarchyNode {
  code: string;
  title: string;
  /** Official Census definition, when the source data carries one for this code. */
  definition?: string;
  /** Illustrative examples from the Census description, when present. */
  examples?: string[];
  /** Child nodes, keyed by code. Empty for a resolved 6-digit (leaf) code. */
  children: Record<string, HierarchyNode>;
}

/** Root-level map of the NAICS hierarchy: sector code -> node. */
export type HierarchyTree = Record<string, HierarchyNode>;

/** Flatten the naics-hierarchy.json tree into code -> title, all levels. */
export function flattenHierarchy(tree: HierarchyTree): Map<string, string> {
  const index = new Map<string, string>();
  const visit = (node: HierarchyNode) => {
    index.set(node.code, node.title);
    for (const child of Object.values(node.children)) visit(child);
  };
  for (const node of Object.values(tree)) visit(node);
  return index;
}
