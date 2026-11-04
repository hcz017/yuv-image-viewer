import { makeSpec } from "./spec";
import type { Spec, YuvFormat } from "./types";

export const SPEC_CACHE_VERSION = 1;

const FORMATS: readonly YuvFormat[] = ["nv12", "nv21", "i420", "yv12", "p010"];

export interface SpecCacheEntryWire {
  path: string;
  size: number;
  modified_ms: number;
  width: number;
  height: number;
  stride: number;
  scanline: number;
  format: string;
  updated_ms: number;
}

export interface SpecCacheWire {
  version: number;
  entries: SpecCacheEntryWire[];
}

export interface SpecCacheEntry {
  path: string;
  size: number;
  modifiedMs: number;
  spec: Spec;
  updatedMs: number;
}

function isFormat(value: unknown): value is YuvFormat {
  return typeof value === "string" && FORMATS.includes(value as YuvFormat);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function decodeSpecCache(wire: unknown): SpecCacheEntry[] {
  if (!wire || typeof wire !== "object") {
    return [];
  }
  const parsed = wire as Partial<SpecCacheWire>;
  if (parsed.version !== SPEC_CACHE_VERSION || !Array.isArray(parsed.entries)) {
    return [];
  }

  const result: SpecCacheEntry[] = [];
  for (const raw of parsed.entries) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const entry = raw as Partial<SpecCacheEntryWire>;
    if (typeof entry.path !== "string" || entry.path.length === 0) {
      continue;
    }
    if (!isTimestamp(entry.size) || !isTimestamp(entry.modified_ms)) {
      continue;
    }
    if (!isCount(entry.width) || !isCount(entry.height)) {
      continue;
    }
    if (!isCount(entry.stride) || !isCount(entry.scanline)) {
      continue;
    }
    if (!isFormat(entry.format)) {
      continue;
    }
    result.push({
      path: entry.path,
      size: entry.size,
      modifiedMs: entry.modified_ms,
      spec: makeSpec(entry.width, entry.height, entry.stride, entry.scanline, entry.format),
      updatedMs: isTimestamp(entry.updated_ms) ? entry.updated_ms : 0,
    });
  }
  return result;
}

export function encodeSpecCache(entries: readonly SpecCacheEntry[]): SpecCacheWire {
  return {
    version: SPEC_CACHE_VERSION,
    entries: entries.map((entry) => ({
      path: entry.path,
      size: entry.size,
      modified_ms: entry.modifiedMs,
      width: entry.spec.width,
      height: entry.spec.height,
      stride: entry.spec.stride,
      scanline: entry.spec.scanline,
      format: entry.spec.format,
      updated_ms: entry.updatedMs,
    })),
  };
}

/** 缓存的路径键必须同时匹配文件大小与修改时间，避免文件被修改后继续使用旧配置。 */
export function entryMatches(
  entry: SpecCacheEntry,
  size: number,
  modifiedMs: number
): boolean {
  return entry.size === size && entry.modifiedMs === modifiedMs;
}
