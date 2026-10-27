import { formatFromName, parseSizeCandidates } from "./filenameParser";
import type { EntryInfo, FileRow, SortKey } from "./types";

export function naturalCompare(a: string, b: string): number {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  const pattern = /(\d+)|(\D+)/g;
  const leftParts = left.match(pattern) ?? [left];
  const rightParts = right.match(pattern) ?? [right];
  const length = Math.min(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index++) {
    const l = leftParts[index];
    const r = rightParts[index];
    const ln = Number(l);
    const rn = Number(r);
    if (!Number.isNaN(ln) && !Number.isNaN(rn)) {
      if (ln !== rn) {
        return ln - rn;
      }
    } else if (l !== r) {
      return l < r ? -1 : 1;
    }
  }
  return leftParts.length - rightParts.length;
}

export function rowsFromEntries(entries: readonly EntryInfo[]): FileRow[] {
  return entries
    .filter((entry) => !entry.isDir)
    .map((entry) => {
      const format = formatFromName(entry.name) ?? "yuv";
      const candidate = parseSizeCandidates(entry.name)[0];
      return {
        name: entry.name,
        path: entry.path,
        size: entry.size,
        modifiedMs: entry.modifiedMs,
        width: candidate?.width ?? null,
        height: candidate?.height ?? null,
        stride: candidate?.stride ?? null,
        scanline: candidate?.scanline ?? null,
        format,
      };
    });
}

export function sortRows(rows: readonly FileRow[], key: SortKey, desc: boolean): FileRow[] {
  const sorted = [...rows].sort((a, b) => {
    switch (key) {
      case "size":
        return a.size - b.size;
      case "format":
        return a.format.localeCompare(b.format);
      case "modified":
        return a.modifiedMs - b.modifiedMs;
      default:
        return naturalCompare(a.name, b.name);
    }
  });
  return desc ? sorted.reverse() : sorted;
}

export function neighborPath(
  rows: readonly FileRow[],
  currentPath: string,
  delta: -1 | 1
): string | null {
  const index = rows.findIndex((row) => row.path === currentPath);
  if (index < 0) {
    return null;
  }
  const target = index + delta;
  if (target < 0 || target >= rows.length) {
    return null;
  }
  return rows[target].path;
}
