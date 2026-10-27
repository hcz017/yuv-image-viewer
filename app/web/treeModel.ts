import type { EntryInfo } from "../../common/types";

export interface TreeNode {
  path: string;
  label: string;
  isVolume: boolean;
  children: TreeNode[] | null;
  expanded: boolean;
  loading: boolean;
}

export function rootNode(label: string): TreeNode {
  return { path: "", label, isVolume: true, children: [], expanded: true, loading: false };
}

export function volumeNode(path: string, label: string): TreeNode {
  return { path, label, isVolume: true, children: null, expanded: false, loading: false };
}

export function dirNode(entry: EntryInfo): TreeNode {
  return {
    path: entry.path,
    label: entry.name,
    isVolume: false,
    children: null,
    expanded: false,
    loading: false,
  };
}

export function findChild(node: TreeNode, policyKey: string, policy: { key: (path: string) => string }): TreeNode | null {
  for (const child of node.children ?? []) {
    if (policy.key(child.path) === policyKey) {
      return child;
    }
  }
  return null;
}

export function parentNodeKey(path: string, policy: { parent: (path: string) => string }): string {
  return policy.parent(path);
}
