import type { FileRow } from "./types";

export function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatTime(ms: number): string {
  if (!ms) {
    return "—";
  }
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatLabel(format: string): string {
  return format.toUpperCase();
}

export function specText(row: FileRow): string {
  if (!row.width || !row.height) {
    return "—";
  }
  const size = `${row.width}x${row.height}`;
  if (row.stride && row.scanline) {
    return `${size} / ${row.stride}x${row.scanline}`;
  }
  return size;
}
