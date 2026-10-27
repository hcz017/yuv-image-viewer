export interface EntryInfoWire {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified_ms: number;
}

export interface EntryInfo {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modifiedMs: number;
}

export type YuvFormat = "nv12" | "nv21" | "i420" | "yv12" | "p010" | "yuv";

export type ColorStandard = "bt601" | "bt709";

export interface Spec {
  width: number;
  height: number;
  stride: number;
  scanline: number;
  format: YuvFormat;
  bytesPerSample: 1 | 2;
}

export interface FileRow {
  name: string;
  path: string;
  size: number;
  modifiedMs: number;
  width: number | null;
  height: number | null;
  stride: number | null;
  scanline: number | null;
  format: string;
}

export type SortKey = "name" | "size" | "format" | "modified";

export interface PlatformInfoWire {
  os: string;
  path_separator: string;
  case_insensitive_paths: boolean;
  volume_root_label: string;
  modifier_label: string;
  config_location: string;
  app_data_dir: string;
}

export interface PlatformInfo {
  os: string;
  pathSeparator: string;
  caseInsensitivePaths: boolean;
  volumeRootLabel: string;
  modifierLabel: string;
  configLocation: string;
  appDataDir: string;
}

export function fromWireEntry(entry: EntryInfoWire): EntryInfo {
  return {
    name: entry.name,
    path: entry.path,
    isDir: entry.is_dir,
    size: entry.size,
    modifiedMs: entry.modified_ms,
  };
}
