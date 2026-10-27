export interface AppConfigWire {
  last_dir: string | null;
  recent_dirs: string[];
  window: { x: number; y: number; width: number; height: number };
  sidebar_width: number;
  sort_key: string;
  sort_desc: boolean;
  color_standard: string;
  store_location: string;
}

export interface AppConfig {
  lastDir: string | null;
  recentDirs: string[];
  window: { x: number; y: number; width: number; height: number };
  sidebarWidth: number;
  sortKey: string;
  sortDesc: boolean;
  colorStandard: string;
  storeLocation: string;
}

export const defaultConfig: AppConfig = {
  lastDir: null,
  recentDirs: [],
  window: { x: 100, y: 100, width: 1280, height: 800 },
  sidebarWidth: 260,
  sortKey: "name",
  sortDesc: false,
  colorStandard: "bt601",
  storeLocation: "default",
};

export function decodeConfig(wire: Partial<AppConfigWire> | null): AppConfig {
  if (!wire) {
    return { ...defaultConfig };
  }
  const sortKey = ["name", "size", "format", "modified"].includes(wire.sort_key ?? "")
    ? (wire.sort_key as string)
    : "name";
  const colorStandard = wire.color_standard === "bt709" ? "bt709" : "bt601";
  return {
    lastDir: typeof wire.last_dir === "string" ? wire.last_dir : null,
    recentDirs: Array.isArray(wire.recent_dirs)
      ? wire.recent_dirs.filter((item): item is string => typeof item === "string")
      : [],
    window: wire.window ?? { ...defaultConfig.window },
    sidebarWidth:
      typeof wire.sidebar_width === "number" ? wire.sidebar_width : defaultConfig.sidebarWidth,
    sortKey,
    sortDesc: Boolean(wire.sort_desc),
    colorStandard,
    storeLocation: wire.store_location ?? defaultConfig.storeLocation,
  };
}

export function encodeConfig(config: AppConfig): AppConfigWire {
  return {
    last_dir: config.lastDir,
    recent_dirs: config.recentDirs,
    window: config.window,
    sidebar_width: config.sidebarWidth,
    sort_key: config.sortKey,
    sort_desc: config.sortDesc,
    color_standard: config.colorStandard,
    store_location: config.storeLocation,
  };
}
