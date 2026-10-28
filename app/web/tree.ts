import { fromWireEntry } from "../../common/types";
import type { PathPolicy } from "../../common/pathPolicy";
import { showContextMenu } from "./contextMenu";
import type { HostApi, VolumeWire } from "./host";
import { dirNode, rootNode, type TreeNode } from "./treeModel";

export interface TreeApi {
  setVolumes(volumes: readonly VolumeWire[]): void;
  expandTo(path: string): Promise<void>;
  render(): void;
}

export interface TreeDeps {
  host: HostApi;
  policy: PathPolicy;
  onNavigate: (path: string) => void;
  onReveal: (path: string) => void;
  revealLabel: string;
}

export function createTree(container: HTMLElement, deps: TreeDeps): TreeApi {
  const root = rootNode(deps.policy.rootLabel);

  const ensureChildren = async (node: TreeNode): Promise<void> => {
    if (node.children !== null || node.loading) {
      return;
    }
    node.loading = true;
    render();
    try {
      const entries = await deps.host.listDirEntries(node.path);
      node.children = entries
        .map(fromWireEntry)
        .filter((entry) => entry.isDir && !entry.name.startsWith("."))
        .map(dirNode);
      node.expanded = true;
    } catch (error) {
      node.children = [];
      console.error("目录枚举失败", error);
    } finally {
      node.loading = false;
      render();
    }
  };

  const renderNode = (node: TreeNode, depth: number): HTMLElement => {
    const wrapper = document.createElement("div");
    wrapper.className = "tree-node";

    const row = document.createElement("div");
    row.className = "tree-row";
    if (node.isVolume) {
      row.classList.add("volume");
    }
    row.style.paddingLeft = `${8 + depth * 14}px`;

    const caret = document.createElement("span");
    caret.className = "caret";
    caret.textContent = node.loading ? "…" : node.expanded ? "▾" : "▸";

    const label = document.createElement("span");
    label.className = "tree-label";
    label.textContent = node.label;
    label.title = node.path;

    row.append(caret, label);
    row.onclick = async () => {
      if (node.path) {
        deps.onNavigate(node.path);
      }
      if (node.expanded && node.children !== null) {
        node.expanded = false;
        render();
        return;
      }
      await ensureChildren(node);
    };
    row.oncontextmenu = (event) => {
      event.preventDefault();
      if (!node.path) {
        return;
      }
      showContextMenu(event.clientX, event.clientY, [
        { label: deps.revealLabel, onClick: () => deps.onReveal(node.path) },
      ]);
    };

    wrapper.append(row);

    if (node.expanded && node.children) {
      for (const child of node.children) {
        wrapper.append(renderNode(child, depth + 1));
      }
      if (node.children.length === 0) {
        const empty = document.createElement("div");
        empty.className = "tree-empty";
        empty.style.paddingLeft = `${22 + depth * 14}px`;
        empty.textContent = node.isVolume ? "没有可访问的子目录" : "空目录";
        wrapper.append(empty);
      }
    }

    return wrapper;
  };

  function render() {
    container.textContent = "";
    container.append(renderNode(root, 0));
  }

  const findVolume = (path: string): TreeNode | null => {
    const key = deps.policy.key(path);
    for (const volume of root.children ?? []) {
      if (key === deps.policy.key(volume.path) || key.startsWith(deps.policy.key(volume.path))) {
        return volume;
      }
    }
    return null;
  };

  const expandTo = async (path: string): Promise<void> => {
    const volume = findVolume(path);
    if (!volume) {
      return;
    }
    await ensureChildren(volume);

    const targetKey = deps.policy.key(path);
    let current: TreeNode = volume;
    const rest = path.slice(volume.path.length);
    const parts = rest.split(deps.policy.separator).filter(Boolean);

    for (const part of parts) {
      await ensureChildren(current);
      const nextKey = deps.policy.key(deps.policy.join(current.path, part));
      const child = (current.children ?? []).find(
        (node) => deps.policy.key(node.path) === nextKey
      );
      if (!child) {
        break;
      }
      child.expanded = true;
      current = child;
      if (deps.policy.key(current.path) === targetKey) {
        break;
      }
    }
    render();
  };

  render();

  return {
    setVolumes(volumes) {
      root.children = volumes.map((volume) => volumeNodeFrom(volume));
      render();
    },
    expandTo,
    render,
  };
}

function volumeNodeFrom(volume: VolumeWire): TreeNode {
  return {
    path: volume.path,
    label: volume.label || volume.path,
    isVolume: true,
    children: null,
    expanded: false,
    loading: false,
  };
}
