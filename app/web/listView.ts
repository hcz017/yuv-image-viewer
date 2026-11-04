import type { AppState } from "../../common/appState";
import { formatBytes, formatLabel, formatTime, specText } from "../../common/listMeta";
import type { PathPolicy } from "../../common/pathPolicy";
import { applySelection, type SelectMode } from "../../common/selectionModel";
import type { FileRow, SortKey } from "../../common/types";
import { showContextMenu, type ContextMenuEntry } from "./contextMenu";

export interface ListViewApi {
  render(state: AppState, rows: readonly FileRow[]): void;
}

export interface ListDeps {
  policy: PathPolicy;
  onOpen: (path: string) => void;
  onCompare: (paths: readonly string[]) => void;
  onExport: (path: string) => void;
  onSelect: (order: readonly string[], anchor: string | null) => void;
  onSort: (key: SortKey) => void;
  onReveal: (path: string) => void;
  onRename: (path: string) => void;
  revealLabel: string;
}

const SORTABLE_COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: "name", label: "文件名" },
  { key: "size", label: "尺寸" },
  { key: "format", label: "格式" },
  { key: "size", label: "stride/scanline" },
  { key: "size", label: "大小" },
  { key: "modified", label: "修改时间" },
];

export function createListView(container: HTMLElement, deps: ListDeps): ListViewApi {
  const table = document.createElement("table");
  table.className = "file-table";
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const column of SORTABLE_COLUMNS) {
    const th = document.createElement("th");
    th.textContent = column.label;
    th.dataset.key = column.key;
    if (column.key !== "name" && column.key !== "format") {
      th.classList.add("numeric");
    }
    th.onclick = () => deps.onSort(column.key);
    headRow.append(th);
  }
  head.append(headRow);
  const body = document.createElement("tbody");
  table.append(head, body);
  container.append(table);

  let currentState: AppState | null = null;
  let currentRows: readonly FileRow[] = [];

  const select = (path: string, mode: SelectMode) => {
    if (!currentState) {
      return;
    }
    const next = applySelection(
      currentRows,
      { order: [...currentState.selectionOrder], anchor: currentState.selectionAnchor },
      path,
      mode,
      deps.policy
    );
    deps.onSelect(next.order, next.anchor);
  };

  return {
    render(state, rows) {
      const needle = state.filter.trim().toLowerCase();
      const visibleRows = needle
        ? rows.filter((row) => row.name.toLowerCase().includes(needle))
        : rows;
      currentState = state;
      currentRows = visibleRows;
      body.textContent = "";

      const selection = new Set(state.selectionOrder.map((path) => deps.policy.key(path)));

      for (const row of visibleRows) {
        const tr = document.createElement("tr");
        tr.dataset.path = row.path;
        const selected = selection.has(deps.policy.key(row.path));
        if (selected) {
          tr.classList.add("selected");
        }
        if (state.displayedFile && deps.policy.key(state.displayedFile) === deps.policy.key(row.path)) {
          tr.classList.add("displayed");
        }

        const cells = [
          row.name,
          row.width && row.height ? `${row.width}x${row.height}` : "—",
          formatLabel(row.format),
          specText(row).includes("/") ? specText(row).split("/ ")[1] : "—",
          formatBytes(row.size),
          formatTime(row.modifiedMs),
        ];
        for (const [index, value] of cells.entries()) {
          const td = document.createElement("td");
          td.textContent = value;
          if (index >= 1) {
            td.classList.add("numeric");
          }
          tr.append(td);
        }

        tr.onclick = (event) => {
          const mode: SelectMode = event.shiftKey
            ? "range"
            : event.metaKey || event.ctrlKey
              ? "toggle"
              : "single";
          select(row.path, mode);
        };
        tr.ondblclick = () => deps.onOpen(row.path);
        tr.oncontextmenu = (event) => {
          event.preventDefault();
          const rowKey = deps.policy.key(row.path);
          const wasSelected = selection.has(rowKey);
          if (!wasSelected) {
            select(row.path, "single");
          }
          const order = wasSelected ? state.selectionOrder : [row.path];
          const entries: ContextMenuEntry[] = [];
          if (wasSelected && order.length === 2) {
            entries.push({ label: "YUV 对比", onClick: () => deps.onCompare(order) });
          }
          entries.push({
            label: "导出为 JPG",
            onClick: () => deps.onExport(row.path),
            disabled: wasSelected && order.length > 1,
          });
          entries.push({ label: "重命名", onClick: () => deps.onRename(row.path) });
          entries.push({ label: deps.revealLabel, onClick: () => deps.onReveal(row.path) });
          showContextMenu(event.clientX, event.clientY, entries);
        };
        body.append(tr);
      }

      if (visibleRows.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 6;
        td.className = "list-empty";
        td.textContent = !state.dir
          ? "选择一个目录开始"
          : needle
            ? "没有匹配的文件"
            : "此目录没有受支持的 YUV 文件";
        tr.append(td);
        body.append(tr);
      }
    },
  };
}
