import { initialState, type AppState } from "../../common/appState";
import { detectP010Alignment, type P010Alignment } from "../../common/bitdepth";
import { decodeConfig, encodeConfig, type AppConfig } from "../../common/config";
import { neighborPath, sortRows } from "../../common/fileEntry";
import { parseSizeCandidates } from "../../common/filenameParser";
import { formatBytes } from "../../common/listMeta";
import { createPathPolicy, type PathPolicy } from "../../common/pathPolicy";
import { pushRecentDir } from "../../common/recentDirs";
import { makeSpec, validateSpec } from "../../common/spec";
import type { FileRow, SortKey, YuvFormat } from "../../common/types";
import { createAboutModal } from "./aboutModal";
import { createCompareView } from "./compareView";
import { createDelayedNotice } from "./delayedNotice";
import { probeGl } from "./glProbe";
import { createHost, type HostApi } from "./host";
import { createListView } from "./listView";
import { loadFile, type LoadDeps, type LoadedFile } from "./loadFlow";
import { createMenuBar } from "./menuBar";
import { createOpenPathFlow } from "./openPathFlow";
import { createPrefetchCache } from "./prefetchCache";
import { createSingleView, type ImagePayload } from "./singleView";
import { createSpecModal } from "./specModal";
import { Store } from "./store";
import { createTree } from "./tree";

const APP_VERSION = "0.4.0";

function required(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`缺少页面元素 #${id}`);
  }
  return element;
}

async function main() {
  const host = createHost();
  const platform = await host.platformInfo();
  const policy = createPathPolicy(platform);
  const config = decodeConfig(await host.loadConfig());
  const gl = probeGl();

  const base = initialState(config.lastDir ?? "");
  const initial: AppState = {
    ...base,
    sortKey: config.sortKey as SortKey,
    sortDesc: config.sortDesc,
  };
  const store = new Store(initial);

  const menubarHost = required("menubar");
  const banner = required("banner");
  const treeHost = required("tree");
  const listHost = required("list");
  const stage = required("stage");
  const address = required("address") as HTMLInputElement;
  const readout = required("readout");
  const errorLine = required("error");
  const noticeElement = required("notice");
  const scaleLabel = required("scale");
  const sidebar = required("sidebar");
  const splitter = required("splitter");
  const formatControl = required("format-control");
  const formatSelect = required("format") as HTMLSelectElement;
  const backButton = required("back");
  const goButton = required("go");

  const gate = { paused: false };
  let colorStandard: "bt601" | "bt709" = config.colorStandard === "bt709" ? "bt709" : "bt601";
  let recentDirs: string[] = [...config.recentDirs];
  let sidebarWidth = config.sidebarWidth;
  let saveTimer: number | null = null;

  const notice = createDelayedNotice(noticeElement, 500);
  const specModal = createSpecModal(document.body);
  const maxTextureSize = gl.webgl2 && gl.maxTextureSize > 0 ? gl.maxTextureSize : 16384;

  const showBanner = (message: string) => {
    if (!message) {
      banner.textContent = "";
      banner.classList.add("hidden");
      return;
    }
    banner.textContent = message;
    banner.classList.remove("hidden");
  };

  const single = createSingleView({
    onReadout: (text) => {
      readout.textContent = text ?? "";
    },
    onScale: (scale) => {
      scaleLabel.textContent = `${Math.round(scale * 100)}%`;
    },
    onContextError: (message) => showBanner(message),
  });

  const compare = createCompareView({
    onReadout: (text) => {
      readout.textContent = text ?? "";
    },
    onSwap: () => {
      compare.swap();
      store.dispatch({ type: "swapCompare" });
    },
    onContextError: (message) => showBanner(message),
  });

  stage.append(single.element, compare.element);

  const FORMATS: YuvFormat[] = ["nv12", "nv21", "i420", "yv12", "p010"];
  for (const format of FORMATS) {
    const option = document.createElement("option");
    option.value = format;
    option.textContent = format.toUpperCase();
    formatSelect.append(option);
  }

  const syncFormatSelect = (format: YuvFormat) => {
    formatSelect.value = format;
  };

  const switchFormat = (next: YuvFormat) => {
    const image = single.currentImage();
    if (!image) {
      return;
    }
    const spec = makeSpec(
      image.spec.width,
      image.spec.height,
      image.spec.stride,
      image.spec.scanline,
      next
    );
    const check = validateSpec(spec, image.data.length, maxTextureSize);
    if (check.kind === "invalid") {
      showBanner(`无法切换为 ${next.toUpperCase()}：${check.reason ?? "规格不合法"}`);
      syncFormatSelect(image.spec.format);
      return;
    }
    const detected = next === "p010" ? detectP010Alignment(image.data) : image.alignment;
    const alignment: P010Alignment = detected === "unknown" ? "high" : detected;
    if (!single.updateSpec(spec, alignment)) {
      syncFormatSelect(image.spec.format);
      return;
    }
    if (banner.textContent.startsWith("无法切换为")) {
      showBanner("");
    }
    syncFormatSelect(next);
  };

  formatSelect.onchange = () => switchFormat(formatSelect.value as YuvFormat);

  const setStandard = (value: "bt601" | "bt709") => {
    colorStandard = value;
    single.setStandard(value);
    compare.setStandard(value);
    menu.setColorStandard(value);
    persistSoon();
  };

  const menu = createMenuBar(menubarHost, {
    openFiles: () => {
      void openFiles();
    },
    openFolder: () => {
      void openFolder();
    },
    openRecent: (dir) => {
      void openFlow.open([dir]);
    },
    backToList: () => {
      store.dispatch({ type: "backToList" });
    },
    showAbout: () => {
      about.show({
        version: APP_VERSION,
        platform: platform.os,
        configLocation: platform.config_location,
      });
    },
    setColorStandard: setStandard,
  });
  const about = createAboutModal();
  menu.setRecent(recentDirs);
  menu.setColorStandard(colorStandard);

  const list = createListView(listHost, {
    policy,
    onOpen: (path) => {
      void openFlow.open([path]);
    },
    onCompare: (paths) => {
      void openFlow.open(paths);
    },
    onSelect: (order, anchor) => {
      store.dispatch({ type: "select", order, anchor });
    },
    onSort: (key) => {
      store.dispatch({ type: "setSort", key });
      const state = store.get();
      const rows = sortRows(state.rows, state.sortKey, state.sortDesc);
      store.dispatch({ type: "openDir", token: state.generation, dir: state.dir, rows });
      persistSoon();
    },
  });

  const tree = createTree(treeHost, {
    host,
    policy,
    onNavigate: (path) => {
      void openFlow.open([path]);
    },
  });

  const cache = createPrefetchCache(host);
  const cachedHost: HostApi = {
    ...host,
    readFileBytes: (path) => cache.read(path),
  };

  const withModal = async <T>(run: () => Promise<T>): Promise<T> => {
    gate.paused = true;
    store.dispatch({ type: "setModal", open: true });
    try {
      return await run();
    } finally {
      store.dispatch({ type: "setModal", open: false });
      gate.paused = false;
    }
  };

  const loadDeps: LoadDeps = {
    host: cachedHost,
    maxTextureSize,
    chooseFormat: (name) =>
      withModal(() => specModal.chooseFormat(name)),
    chooseAlignment: (name) =>
      withModal(() => specModal.chooseAlignment(name)),
    askManual: (name, fileSize, format, reason) => {
      const candidate = parseSizeCandidates(name)[0];
      const width = candidate?.width ?? 1920;
      const height = candidate?.height ?? 1080;
      return withModal(() =>
        specModal.openManual({
          name,
          fileSize,
          maxTextureSize,
          format,
          width,
          height,
          stride: candidate?.stride ?? width,
          scanline: candidate?.scanline ?? height,
          reason,
        })
      );
    },
    confirmLarge: (name, size) =>
      withModal(async () =>
        window.confirm(`文件 ${name} 大小为 ${formatBytes(size)}，确认加载吗？`)
      ),
  };

  const payloadOf = (path: string, loaded: LoadedFile): ImagePayload => ({
    spec: loaded.spec,
    data: loaded.data,
    alignment: loaded.alignment,
    name: policy.basename(path),
    path,
  });

  const prefetchAround = (rows: readonly FileRow[], path: string) => {
    const index = rows.findIndex((row) => policy.key(row.path) === policy.key(path));
    if (index < 0) {
      return;
    }
    const targets: string[] = [];
    for (let offset = -2; offset <= 2; offset++) {
      if (offset === 0) {
        continue;
      }
      const candidate = rows[index + offset];
      if (candidate) {
        targets.push(candidate.path);
      }
    }
    cache.schedule(targets);
  };

  const loadSingle = async (
    token: number,
    dir: string,
    file: string,
    rows: readonly FileRow[]
  ) => {
    notice.show("正在加载图像…");
    try {
      const outcome = await loadFile(loadDeps, file, null);
      if (store.get().generation !== token) {
        return;
      }
      if (outcome.kind === "cancelled") {
        store.dispatch({ type: "backToList" });
        return;
      }
      if (outcome.kind === "error") {
        store.dispatch({ type: "loadAbort", token, error: outcome.message });
        return;
      }
      const payload = payloadOf(file, outcome.file);
      single.show(payload);
      syncFormatSelect(payload.spec.format);
      store.dispatch({
        type: "loadCommit",
        token,
        mode: { kind: "single", dir, file },
        rows,
        displayedFile: file,
      });
      prefetchAround(rows, file);
    } finally {
      notice.hide();
    }
  };

  const loadCompare = async (
    token: number,
    dir: string,
    a: string,
    b: string,
    rows: readonly FileRow[]
  ) => {
    notice.show("正在加载对比图像…");
    try {
      const first = await loadFile(loadDeps, a, null);
      if (store.get().generation !== token) {
        return;
      }
      if (first.kind === "cancelled") {
        store.dispatch({ type: "backToList" });
        return;
      }
      if (first.kind === "error") {
        store.dispatch({ type: "loadAbort", token, error: first.message });
        return;
      }

      const second = await loadFile(loadDeps, b, null);
      if (store.get().generation !== token) {
        return;
      }
      if (second.kind === "cancelled") {
        store.dispatch({ type: "backToList" });
        return;
      }
      if (second.kind === "error") {
        store.dispatch({ type: "loadAbort", token, error: second.message });
        return;
      }

      compare.setImages(payloadOf(a, first.file), payloadOf(b, second.file));
      store.dispatch({
        type: "loadCommit",
        token,
        mode: { kind: "compare", dir, a, b },
        rows,
        displayedFile: null,
      });
      prefetchAround(rows, a);
      prefetchAround(rows, b);
    } finally {
      notice.hide();
    }
  };

  const openFlow = createOpenPathFlow({
    host,
    policy,
    store,
    gate,
    onDirectoryOpened: (dir) => {
      address.value = dir;
      tree.expandTo(dir);
      recentDirs = pushRecentDir(recentDirs, dir, policy);
      menu.setRecent(recentDirs);
      cache.clear();
      persistSoon();
    },
    loadSingle,
    loadCompare,
  });

  async function openFiles() {
    try {
      const paths = await host.pickFiles();
      if (paths.length > 0) {
        await openFlow.open(paths);
      }
    } catch (error) {
      showBanner(String(error));
    }
  }

  async function openFolder() {
    try {
      const dir = await host.pickDirectory();
      if (dir) {
        await openFlow.open([dir]);
      }
    } catch (error) {
      showBanner(String(error));
    }
  }

  const openNeighbor = (delta: -1 | 1) => {
    const state = store.get();
    if (state.mode.kind !== "single") {
      return;
    }
    const next = neighborPath(state.rows, state.displayedFile ?? state.mode.file, delta);
    if (next) {
      void openFlow.open([next]);
    }
  };

  const activeView = () => (store.get().mode.kind === "compare" ? compare : single);

  const currentConfig = (geometry: AppConfig["window"]): AppConfig => {
    const state = store.get();
    return {
      lastDir: state.dir || config.lastDir,
      recentDirs,
      window: geometry,
      sidebarWidth,
      sortKey: state.sortKey,
      sortDesc: state.sortDesc,
      colorStandard,
      storeLocation: config.storeLocation,
    };
  };

  const persist = async () => {
    let geometry = config.window;
    try {
      geometry = await host.windowGeometry();
    } catch {
      // 忽略窗口几何读取失败
    }
    try {
      await host.saveConfig(encodeConfig(currentConfig(geometry)));
    } catch (error) {
      console.error("保存配置失败", error);
    }
  };

  function persistSoon() {
    if (saveTimer !== null) {
      window.clearTimeout(saveTimer);
    }
    saveTimer = window.setTimeout(() => {
      saveTimer = null;
      void persist();
    }, 400);
  }

  const setSidebarWidth = (width: number) => {
    sidebarWidth = Math.min(480, Math.max(180, Math.round(width)));
    sidebar.style.width = `${sidebarWidth}px`;
  };
  setSidebarWidth(sidebarWidth);

  let dragStart: { x: number; width: number } | null = null;
  splitter.addEventListener("pointerdown", (event) => {
    dragStart = { x: event.clientX, width: sidebarWidth };
    splitter.setPointerCapture(event.pointerId);
    document.body.classList.add("resizing");
  });
  splitter.addEventListener("pointermove", (event) => {
    if (!dragStart) {
      return;
    }
    setSidebarWidth(dragStart.width + (event.clientX - dragStart.x));
  });
  const endResize = (event: PointerEvent) => {
    if (!dragStart) {
      return;
    }
    dragStart = null;
    document.body.classList.remove("resizing");
    if (splitter.hasPointerCapture(event.pointerId)) {
      splitter.releasePointerCapture(event.pointerId);
    }
    persistSoon();
  };
  splitter.addEventListener("pointerup", endResize);
  splitter.addEventListener("pointercancel", endResize);

  address.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const value = address.value.trim();
      if (value) {
        void openFlow.open([value]);
      }
    }
  });

  goButton.addEventListener("click", () => {
    const value = address.value.trim();
    if (value) {
      void openFlow.open([value]);
    }
  });
  required("pick-files").addEventListener("click", () => {
    void openFiles();
  });
  required("pick-folder").addEventListener("click", () => {
    void openFolder();
  });
  backButton.addEventListener("click", () => {
    store.dispatch({ type: "backToList" });
  });

  document.addEventListener("keydown", (event) => {
    const state = store.get();
    if (state.modalOpen) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) {
      return;
    }
    const modifier = event.metaKey || event.ctrlKey;

    if (modifier && event.key.toLowerCase() === "o") {
      event.preventDefault();
      if (event.shiftKey) {
        void openFolder();
      } else {
        void openFiles();
      }
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      if (state.mode.kind === "single") {
        event.preventDefault();
        openNeighbor(event.key === "ArrowLeft" ? -1 : 1);
      }
      return;
    }

    if (event.key === "Escape") {
      if (state.mode.kind !== "list") {
        store.dispatch({ type: "backToList" });
      }
      return;
    }

    if (state.mode.kind === "list") {
      return;
    }

    if (event.key === "f" || event.key === "F") {
      activeView().fit();
    } else if (event.key === "1") {
      activeView().oneToOne();
    } else if (event.key === "+" || event.key === "=") {
      activeView().zoom(1.25);
    } else if (event.key === "-" || event.key === "_") {
      activeView().zoom(0.8);
    }
  });

  let lastModeKind = store.get().mode.kind;
  store.subscribe((state) => {
    list.render(state, state.rows);
    const kind = state.mode.kind;
    const inList = kind === "list";
    listHost.classList.toggle("hidden", !inList);
    stage.classList.toggle("hidden", inList);
    single.element.classList.toggle("hidden", kind !== "single");
    compare.element.classList.toggle("hidden", kind !== "compare");
    formatControl.classList.toggle("hidden", kind !== "single");
    backButton.classList.toggle("hidden", kind === "list");
    address.classList.toggle("hidden", !inList);
    goButton.classList.toggle("hidden", !inList);
    if (document.activeElement !== address) {
      address.value = state.dir;
    }
    errorLine.textContent = state.error ?? "";

    if (kind === "list" && lastModeKind !== "list") {
      single.clear();
      single.setStandard(colorStandard);
      compare.setImages(null, null);
      compare.setStandard(colorStandard);
      readout.textContent = "";
      scaleLabel.textContent = "";
    }
    lastModeKind = kind;
  });

  try {
    const volumes = await host.listVolumes();
    tree.setVolumes(volumes);
  } catch (error) {
    showBanner(`无法枚举卷：${String(error)}`);
  }

  if (!gl.webgl2) {
    showBanner(`WebGL2 不可用：${gl.error ?? "未知原因"}`);
  } else if (gl.error) {
    showBanner(gl.error);
  }

  single.setStandard(colorStandard);
  compare.setStandard(colorStandard);
  if (config.lastDir) {
    address.value = config.lastDir;
  }

  let draining: Promise<boolean> | null = null;
  let queued = false;
  const drainPending = (): Promise<boolean> => {
    if (draining) {
      queued = true;
      return draining;
    }
    let opened = false;
    draining = (async () => {
      try {
        do {
          queued = false;
          const batches = await host.takePendingPaths();
          for (const batch of batches) {
            if (batch.length > 0) {
              opened = true;
              await openFlow.open(batch);
            }
          }
        } while (queued);
        return opened;
      } finally {
        draining = null;
      }
    })();
    return draining;
  };

  const unlistenOpen = await host.onOpenPaths(() => {
    void drainPending();
  });
  await host.onDragDrop((paths) => {
    void openFlow.open(paths);
  });
  await host.onWindowGeometry(() => persistSoon());
  const unlistenClose = await host.onCloseRequested(() => persist());

  await host.signalReady();
  const openedAtStartup = await drainPending();

  if (!openedAtStartup && config.lastDir) {
    try {
      const info = await host.statPath(config.lastDir);
      if (info.is_dir) {
        await openFlow.open([config.lastDir]);
      }
    } catch {
      // 上次目录已不存在，忽略
    }
  }

  window.addEventListener("beforeunload", () => {
    unlistenOpen();
    unlistenClose();
  });
}

void main().catch((error) => {
  const banner = document.getElementById("banner");
  if (banner) {
    banner.textContent = `启动失败：${String(error)}`;
    banner.classList.remove("hidden");
  }
  console.error(error);
});
