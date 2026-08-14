export interface HierarchyNode {
  code: string;
  title: string;
  definition?: string;
  examples?: string[];
  children: Record<string, HierarchyNode>;
}

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
