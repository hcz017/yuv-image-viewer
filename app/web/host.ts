import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { AppConfigWire } from "../../common/config";
import type { SpecCacheWire } from "../../common/specCache";
import type { EntryInfoWire, PlatformInfoWire } from "../../common/types";

export interface VolumeWire {
  path: string;
  label: string;
}

export interface WindowGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HostApi {
  platformInfo(): Promise<PlatformInfoWire>;
  listVolumes(): Promise<VolumeWire[]>;
  listDirEntries(path: string): Promise<EntryInfoWire[]>;
  statPath(path: string): Promise<EntryInfoWire>;
  revealPath(path: string): Promise<void>;
  renamePath(path: string, newName: string): Promise<string>;
  trashPaths(paths: readonly string[]): Promise<{ removed: string[]; failed: string[] }>;
  readFileBytes(path: string): Promise<Uint8Array>;
  pickFiles(): Promise<string[]>;
  pickDirectory(): Promise<string | null>;
  pickExportPath(name: string, format: string, directory: string): Promise<string | null>;
  writeImage(path: string, data: string, format: string): Promise<void>;
  loadConfig(): Promise<AppConfigWire>;
  saveConfig(config: AppConfigWire): Promise<void>;
  loadSpecCache(): Promise<SpecCacheWire>;
  saveSpecCache(cache: SpecCacheWire): Promise<void>;
  takePendingPaths(): Promise<string[][]>;
  signalReady(): Promise<boolean>;
  windowGeometry(): Promise<WindowGeometry | null>;
  setWindowTitle(title: string): Promise<void>;
  onOpenPaths(handler: () => void): Promise<UnlistenFn>;
  onDragDrop(handler: (paths: string[]) => void): Promise<UnlistenFn>;
  onWindowGeometry(handler: () => void): Promise<UnlistenFn>;
  onCloseRequested(handler: () => Promise<void>): Promise<UnlistenFn>;
}

export function createHost(): HostApi {
  return {
    platformInfo: () => invoke("platform_info"),
    listVolumes: () => invoke("list_volumes"),
    listDirEntries: (path) => invoke("list_dir_entries", { path }),
    statPath: (path) => invoke("stat_path", { path }),
    revealPath: (path) => invoke("reveal_path", { path }),
    renamePath: (path, newName) => invoke("rename_path", { path, newName }),
    trashPaths: (paths) => invoke("trash_paths", { paths }),
    readFileBytes: async (path) => {
      const result = await invoke<Uint8Array | ArrayBuffer>("read_file_bytes", { path });
      return result instanceof Uint8Array ? result : new Uint8Array(result);
    },
    pickFiles: () => invoke("pick_files"),
    pickDirectory: () => invoke("pick_directory"),
    pickExportPath: (name, format, directory) =>
      invoke("pick_export_path", { name, format, directory }),
    writeImage: (path, data, format) => invoke("write_image", { path, data, format }),
    loadConfig: () => invoke("load_config"),
    saveConfig: (cfg) => invoke("save_config", { cfg }),
    loadSpecCache: () => invoke("load_spec_cache"),
    saveSpecCache: (cache) => invoke("save_spec_cache", { cache }),
    takePendingPaths: () => invoke("take_pending_paths"),
    signalReady: () => invoke("signal_ready"),
    setWindowTitle: (title) => getCurrentWindow().setTitle(title),
    windowGeometry: async () => {
      const window = getCurrentWindow();
      if (await window.isMinimized()) {
        return null;
      }
      const [position, size, scale] = await Promise.all([
        window.outerPosition(),
        window.outerSize(),
        window.scaleFactor(),
      ]);
      const factor = scale || 1;
      return {
        x: Math.round(position.x / factor),
        y: Math.round(position.y / factor),
        width: Math.round(size.width / factor),
        height: Math.round(size.height / factor),
      };
    },
    onOpenPaths: (handler) => listen("open-paths", () => handler()),
    onDragDrop: async (handler) => {
      const webview = getCurrentWebview();
      return webview.onDragDropEvent((event) => {
        if (event.payload.type === "drop") {
          handler(event.payload.paths);
        }
      });
    },
    onWindowGeometry: async (handler) => {
      const window = getCurrentWindow();
      const unlistenMoved = await window.onMoved(() => handler());
      const unlistenResized = await window.onResized(() => handler());
      return () => {
        unlistenMoved();
        unlistenResized();
      };
    },
    onCloseRequested: async (handler) => {
      const window = getCurrentWindow();
      return window.onCloseRequested(async (event) => {
        event.preventDefault();
        try {
          await handler();
        } finally {
          await window.destroy();
        }
      });
    },
  };
}
