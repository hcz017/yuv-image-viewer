import type { PathPolicy } from "./pathPolicy";
import type { FileRow } from "./types";

export type SelectMode = "single" | "toggle" | "range";

export interface Selection {
  order: string[];
  anchor: string | null;
}

export function applySelection(
  rows: readonly FileRow[],
  current: Selection,
  path: string,
  mode: SelectMode,
  policy: PathPolicy
): Selection {
  const key = policy.key(path);
  const index = rows.findIndex((row) => policy.key(row.path) === key);
  if (index < 0) {
    return current;
  }

  if (mode === "single") {
    return { order: [rows[index].path], anchor: rows[index].path };
  }

  if (mode === "toggle") {
    const exists = current.order.some((item) => policy.key(item) === key);
    const order = exists
      ? current.order.filter((item) => policy.key(item) !== key)
      : [...current.order, rows[index].path];
    return { order, anchor: rows[index].path };
  }

  const anchorKey = current.anchor ? policy.key(current.anchor) : key;
  const anchorIndex = rows.findIndex((row) => policy.key(row.path) === anchorKey);
  const start = anchorIndex < 0 ? index : Math.min(anchorIndex, index);
  const end = anchorIndex < 0 ? index : Math.max(anchorIndex, index);
  return {
    order: rows.slice(start, end + 1).map((row) => row.path),
    anchor: rows[start].path,
  };
}
