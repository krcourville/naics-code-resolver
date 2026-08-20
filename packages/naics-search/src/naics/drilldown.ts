import type { HierarchyNode, HierarchyTree } from "./hierarchy.ts";

/** A selectable drill-down step: one hierarchy node, code + title only. */
export interface DrillOption {
  code: string;
  title: string;
}

/** Full node (title, definition/examples if §R2 has them) for a given code. */
export function getNode(tree: HierarchyTree, code: string): HierarchyNode | undefined {
  for (const node of Object.values(tree)) {
    if (node.code === code) return node;
    const found = getNode(node.children, code);
    if (found) return found;
  }
  return undefined;
}

function toOptions(nodes: Iterable<HierarchyNode>): DrillOption[] {
  return [...nodes]
    .map((n) => ({ code: n.code, title: n.title }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

/** Options for the current drill-down step: children of `code`, or top-level sectors if `code` is null (root). */
export function drilldownOptions(tree: HierarchyTree, code: string | null): DrillOption[] {
  if (code === null) return toOptions(Object.values(tree));
  const node = getNode(tree, code);
  return node ? toOptions(Object.values(node.children)) : [];
}

/** True once a node has no further children — a confirmed 6-digit NAICS code (§V3). */
export function isResolved(tree: HierarchyTree, code: string): boolean {
  const node = getNode(tree, code);
  return node !== undefined && Object.keys(node.children).length === 0;
}

/** Root-to-node chain of {code,title} for breadcrumb/up-navigation. Empty if code not found. */
export function getAncestorPath(tree: HierarchyTree, code: string): DrillOption[] {
  function walk(nodes: HierarchyTree, path: DrillOption[]): DrillOption[] | null {
    for (const node of Object.values(nodes)) {
      const next = [...path, { code: node.code, title: node.title }];
      if (node.code === code) return next;
      const found = walk(node.children, next);
      if (found) return found;
    }
    return null;
  }
  return walk(tree, []) ?? [];
}
