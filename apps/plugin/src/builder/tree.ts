import type { FigmaNodeChange } from "@figit/dom-to-figma/internal";

export type TreeNode = {
  change: FigmaNodeChange;
  children: Array<TreeNode>;
};

export function buildTree(
  changes: Array<FigmaNodeChange>,
  rootParentLocalId: number
): Array<TreeNode> {
  const nodes = new Map<number, TreeNode>();
  for (const change of changes) {
    nodes.set(change.guid.localID, { change, children: [] });
  }

  const roots: Array<{ node: TreeNode; position: string }> = [];
  const childBuckets = new Map<
    number,
    Array<{ node: TreeNode; position: string }>
  >();

  for (const change of changes) {
    // biome-ignore lint/style/noNonNullAssertion: node was just inserted above
    const node = nodes.get(change.guid.localID)!;
    const parentId = change.parentIndex?.guid.localID;
    const position = change.parentIndex?.position ?? "";
    if (parentId === undefined || parentId === rootParentLocalId) {
      roots.push({ node, position });
      continue;
    }
    const bucket = childBuckets.get(parentId) ?? [];
    bucket.push({ node, position });
    childBuckets.set(parentId, bucket);
  }

  const byPosition = (a: { position: string }, b: { position: string }) => {
    if (a.position < b.position) {
      return -1;
    }
    if (a.position > b.position) {
      return 1;
    }
    return 0;
  };

  for (const [parentId, bucket] of childBuckets) {
    const parent = nodes.get(parentId);
    if (!parent) {
      continue;
    }
    parent.children = bucket.sort(byPosition).map((e) => e.node);
  }

  return roots.sort(byPosition).map((e) => e.node);
}
