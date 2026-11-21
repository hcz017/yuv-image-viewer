import { getVersion } from "@tauri-apps/api/app";
import { initialState, type AppState } from "../../common/appState";
import { detectP010Alignment, type P010Alignment } from "../../common/bitdepth";
import { decodeConfig, encodeConfig, type AppConfig } from "../../common/config";
import { exportFileName, replaceExtension } from "../../common/exportName";
import { filterRows, neighborPath, rowsFromEntries, sortRows } from "../../common/fileEntry";
import { parseSizeCandidates } from "../../common/filenameParser";
import { deleteConfirmMessage, selectionPath, windowTitle } from "../../common/listActions";
import { formatBytes } from "../../common/listMeta";
import { createPathPolicy, type PathPolicy } from "../../common/pathPolicy";
import { pushRecentDir } from "../../common/recentDirs";
import { isImageFormat, makeSpec, validateSpec } from "../../common/spec";
import { fromWireEntry, type FileRow, type SortKey, type YuvFormat } from "../../common/types";
import { createAboutModal } from "./aboutModal";
import { createCacheModal } from "./cacheModal";
import { createCompareView } from "./compareView";
import { createDelayedNotice } from "./delayedNotice";
import { encodeImageBase64 } from "./exportImage";
import { createExportModal, type ExportPaneOption } from "./exportModal";
import { probeGl } from "./glProbe";
import { createHost, type HostApi } from "./host";
import { createListView } from "./listView";
import { loadFile, type LoadDeps, type LoadOutcome, type LoadedFile } from "./loadFlow";
import { createMenuBar } from "./menuBar";
import { createOpenPathFlow } from "./openPathFlow";
import { createPrefetchCache } from "./prefetchCache";
import { createRenameModal } from "./renameModal";
import { createSingleView, type ImagePayload } from "./singleView";
import { createSpecCache } from "./specCache";
import { createSpecModal } from "./specModal";
import { nextToken, Store } from "./store";
import { createTree } from "./tree";

function required(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`缺少页面元素 #${id}`);
  }
  return element;
}

async function main() {
  const host = createHost();
  const [platform, appVersion] = await Promise.all([host.platformInfo(), getVersion()]);
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
  const searchControl = required("search-control");
  const searchInput = required("search") as HTMLInputElement;
  const readout = required("readout");
  const errorLine = required("error");
  const noticeElement = required("notice");
  const scaleLabel = required("scale");
  const specControl = required("spec-control");
  const widthInput = required("spec-width") as HTMLInputElement;
  const heightInput = required("spec-height") as HTMLInputElement;
  const strideInput = required("spec-stride") as HTMLInputElement;
  const scanlineInput = required("spec-scanline") as HTMLInputElement;
  const sidebar = required("sidebar");
  const splitter = required("splitter");
  const formatControl = required("format-control");
  const formatSelect = required("format") as HTMLSelectElement;
  const colorControl = required("color-control");
  const colorSelect = required("color-standard") as HTMLSelectElement;
  const zoomControl = required("zoom-control");
  const zoomOneButton = required("zoom-one");
  const zoomFitButton = required("zoom-fit");
  const compareControl = required("compare-control");
  const compareSync = required("compare-sync") as HTMLInputElement;
  const compareSwap = required("compare-swap");
  const backButton = required("back");
  const prevButton = required("prev");
  const nextButton = required("next");
  const goButton = required("go");

  const gate = { paused: false };
  let colorStandard: "bt601" | "bt709" = config.colorStandard === "bt709" ? "bt709" : "bt601";
  let recentDirs: string[] = [...config.recentDirs];
  let sidebarWidth = config.sidebarWidth;
  let saveTimer: number | null = null;
  // 批量转换进行中禁止再次触发（菜单项与快捷键共用）
  let batchRunning = false;
  let deleteRunning = false;

  const notice = createDelayedNotice(noticeElement, 500);
  const specModal = createSpecModal(document.body);
  const exportModal = createExportModal(document.body);
  const renameModal = createRenameModal(document.body);
  const cacheModal = createCacheModal(document.body);
  const maxTextureSize = gl.webgl2 && gl.maxTextureSize > 0 ? gl.maxTextureSize : 16384;

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

  const showBanner = (message: string) => {
    banner.classList.remove("success");
    banner.textContent = message;
    banner.title = message;
    banner.classList.toggle("hidden", message.length === 0);
  };

  let successTimer: number | null = null;
  const showSuccess = (message: string) => {
    if (successTimer !== null) {
      window.clearTimeout(successTimer);
    }
    banner.textContent = message;
    banner.title = message;
    banner.classList.remove("hidden");
    banner.classList.add("success");
    successTimer = window.setTimeout(() => {
      successTimer = null;
      if (banner.textContent === message) {
        showBanner("");
      }
    }, 4000);
  };

  const errorMessage = (error: unknown): string =>
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);

  const specCache = createSpecCache(host, policy, showBanner);

  const revealFileLabel =
    platform.os === "macos"
      ? "在访达中显示"
      : platform.os === "windows"
        ? "在资源管理器中显示"
        : "在文件管理器中显示";
  const revealFolderLabel =
    platform.os === "macos"
      ? "在访达中打开"
      : platform.os === "windows"
        ? "在资源管理器中打开"
        : "在文件管理器中打开";

  const reveal = (path: string) => {
    void host.revealPath(path).catch((error: unknown) => {
      showBanner(`无法打开所在文件夹：${errorMessage(error)}`);
    });
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
    onContextError: (message) => showBanner(message),
  });

  stage.append(single.element, compare.element);

  const FORMATS: YuvFormat[] = ["nv12", "nv21", "i420", "yv12", "p010", "yuyv", "uyvy", "gray"];
  for (const format of FORMATS) {
    const option = document.createElement("option");
    option.value = format;
    option.textContent = format.toUpperCase();
    formatSelect.append(option);
  }
  for (const format of ["jpg", "png"] as const) {
    const option = document.createElement("option");
    option.value = format;
    option.textContent = format.toUpperCase();
    option.disabled = true;
    formatSelect.append(option);
  }

  const syncFormatSelect = (format: YuvFormat) => {
    formatSelect.value = format;
    // JPEG/PNG 的像素来自解码结果，不能切换原始像素格式
    formatSelect.disabled = isImageFormat(format);
  };

  for (const [value, label] of [
    ["bt601", "BT.601"],
    ["bt709", "BT.709"],
  ] as const) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    colorSelect.append(option);
  }
  colorSelect.value = colorStandard;

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
    if (image.path) {
      void specCache.updateSpec(image.path, spec);
    }
    if (banner.textContent.startsWith("无法切换为")) {
      showBanner("");
    }
    syncFormatSelect(next);
  };

  formatSelect.onchange = () => switchFormat(formatSelect.value as YuvFormat);

  const specInputs = [widthInput, heightInput, strideInput, scanlineInput];

  const syncSpecInputs = () => {
    const image = single.currentImage();
    const locked = image !== null && isImageFormat(image.spec.format);
    for (const input of specInputs) {
      input.disabled = locked;
    }
    widthInput.value = image ? String(image.spec.width) : "";
    heightInput.value = image ? String(image.spec.height) : "";
    strideInput.value = image ? String(image.spec.stride) : "";
    scanlineInput.value = image ? String(image.spec.scanline) : "";
  };

  const applySpecInputs = () => {
    const image = single.currentImage();
    if (!image) {
      syncSpecInputs();
      return;
    }
    const width = Number(widthInput.value);
    const height = Number(heightInput.value);
    const stride = Number(strideInput.value);
    const scanline = Number(scanlineInput.value);
    if (
      width === image.spec.width &&
      height === image.spec.height &&
      stride === image.spec.stride &&
      scanline === image.spec.scanline
    ) {
      return;
    }
    if (![width, height, stride, scanline].every(Number.isInteger)) {
      showBanner("宽、高、stride 和 scanline 必须是整数");
      syncSpecInputs();
      return;
    }
    const spec = makeSpec(width, height, stride, scanline, image.spec.format);
    const check = validateSpec(spec, image.data.length, maxTextureSize, {
      allowShort: true,
    });
    if (check.kind === "invalid") {
      showBanner(`无法应用规格：${check.reason ?? "规格不合法"}`);
      syncSpecInputs();
      return;
    }
    if (!single.updateSpec(spec, image.alignment)) {
      syncSpecInputs();
      return;
    }
    if (
      banner.textContent.startsWith("无法应用") ||
      banner.textContent.startsWith("宽、高")
    ) {
      showBanner("");
    }
    syncSpecInputs();
  };

  for (const input of specInputs) {
    input.addEventListener("change", applySpecInputs);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        input.blur();
      } else if (event.key === "Escape") {
        event.preventDefault();
        syncSpecInputs();
        input.blur();
      }
    });
  }

  const setStandard = (value: "bt601" | "bt709") => {
    colorStandard = value;
    single.setStandard(value);
    compare.setStandard(value);
    colorSelect.value = value;
    persistSoon();
  };

  colorSelect.onchange = () =>
    setStandard(colorSelect.value === "bt709" ? "bt709" : "bt601");

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
    exportImage: () => {
      void exportImage();
    },
    canExport: () => {
      const state = store.get();
      return state.mode.kind !== "list" || state.selectionOrder.length === 1;
    },
    batchConvert: () => {
      void batchConvert();
    },
    canBatchConvert: () => {
      const state = store.get();
      return !batchRunning && state.mode.kind === "list" && state.rows.length > 0;
    },
    adjustSpec: () => {
      void adjustCurrentSpec();
    },
    canAdjustSpec: () => {
      const image = single.currentImage();
      return (
        store.get().mode.kind === "single" &&
        image !== null &&
        !isImageFormat(image.spec.format)
      );
    },
    manageSpecCache: () => {
      void openCacheManager();
    },
    backToList: () => {
      store.dispatch({ type: "backToList" });
    },
    showAbout: () => {
      about.show({
        version: appVersion,
        platform: platform.os,
        configLocation: platform.config_location,
      });
    },
  });
  const about = createAboutModal();
  menu.setRecent(recentDirs);

  const basename = (path: string) => {
    const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    return path.slice(slash + 1);
  };

  const refreshAfterRename = async (fromPath: string, toPath: string) => {
    const reloaded = await refreshCurrentList();
    if (!reloaded) {
      return;
    }
    const { state, rows } = reloaded;
    const present = new Set(rows.map((row) => policy.key(row.path)));
    const remap = (path: string) => (policy.key(path) === policy.key(fromPath) ? toPath : path);
    const order = state.selectionOrder.map(remap).filter((path) => present.has(policy.key(path)));
    store.dispatch({
      type: "select",
      order,
      anchor: state.selectionAnchor ? remap(state.selectionAnchor) : null,
    });
  };

  const renameFile = async (path: string) => {
    const currentName = basename(path);
    const nextName = await withModal(() => renameModal.prompt(currentName));
    if (!nextName || nextName === currentName) {
      return;
    }
    let newPath: string;
    try {
      newPath = await host.renamePath(path, nextName);
    } catch (error) {
      showBanner(`重命名失败：${errorMessage(error)}`);
      return;
    }
    try {
      await refreshAfterRename(path, newPath);
    } catch (error) {
      showBanner(`已重命名，但刷新列表失败：${errorMessage(error)}`);
    }
  };

  const refreshAfterDelete = async (removed: readonly string[]) => {
    if (removed.length === 0) {
      return;
    }
    const reloaded = await refreshCurrentList();
    if (!reloaded) {
      return;
    }
    const { state, rows } = reloaded;
    const removedKeys = new Set(removed.map((path) => policy.key(path)));
    const present = new Set(rows.map((row) => policy.key(row.path)));
    const order = state.selectionOrder.filter(
      (path) => !removedKeys.has(policy.key(path)) && present.has(policy.key(path))
    );
    const anchorPath = state.selectionAnchor;
    const anchor =
      anchorPath && order.some((path) => policy.key(path) === policy.key(anchorPath))
        ? anchorPath
        : (order[0] ?? null);
    store.dispatch({ type: "select", order, anchor });
  };

  const deleteFiles = async (paths: readonly string[]) => {
    if (deleteRunning || store.get().mode.kind !== "list") {
      return;
    }
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const path of paths) {
      const key = policy.key(path);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      unique.push(path);
    }
    const message = deleteConfirmMessage(unique.map((path) => policy.basename(path)));
    if (!message) {
      return;
    }
    const confirmed = await withModal(async () => window.confirm(message));
    if (!confirmed || store.get().mode.kind !== "list") {
      return;
    }
    deleteRunning = true;
    try {
      const report = await host.trashPaths(unique);
      let refreshError: string | null = null;
      try {
        await refreshAfterDelete(report.removed);
      } catch (error) {
        refreshError = errorMessage(error);
      }
      if (report.failed.length > 0) {
        const detail = report.failed[0];
        showBanner(
          report.removed.length > 0
            ? `已移到回收站 ${report.removed.length} 个，另有 ${report.failed.length} 个失败：${detail}`
            : `删除失败：${detail}`
        );
      } else if (refreshError) {
        showBanner(`文件已移到回收站，但刷新列表失败：${refreshError}`);
      } else if (report.removed.length === 1) {
        showSuccess(`已将 ${policy.basename(report.removed[0])} 移到回收站`);
      } else if (report.removed.length > 1) {
        showSuccess(`已将 ${report.removed.length} 个文件移到回收站`);
      }
    } catch (error) {
      showBanner(`删除失败：${errorMessage(error)}`);
    } finally {
      deleteRunning = false;
    }
  };

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
    onExport: (path) => {
      void exportImage(path);
    },
    onSort: (key) => {
      store.dispatch({ type: "setSort", key });
      const state = store.get();
      const rows = sortRows(state.rows, state.sortKey, state.sortDesc);
      store.dispatch({ type: "openDir", token: state.generation, dir: state.dir, rows });
      persistSoon();
    },
    onReveal: reveal,
    onRename: (path) => {
      void renameFile(path);
    },
    onDelete: (paths) => {
      void deleteFiles(paths);
    },
    revealLabel: revealFileLabel,
  });

  const tree = createTree(treeHost, {
    host,
    policy,
    onNavigate: (path) => {
      void openFlow.open([path]);
    },
    onReveal: reveal,
    revealLabel: revealFolderLabel,
    isListMode: () => store.get().mode.kind === "list",
  });

  const cache = createPrefetchCache(host);
  const cachedHost: HostApi = {
    ...host,
    readFileBytes: (path) => cache.read(path),
  };

  async function openCacheManager() {
    await specCache.load();
    await withModal(() =>
      cacheModal.open({
        entries: () => specCache.list(),
        basename: (path) => policy.basename(path),
        remove: (path) => specCache.remove(path),
        clearAll: () => specCache.clear(),
      })
    );
  }

  async function adjustCurrentSpec() {
    if (store.get().mode.kind !== "single") {
      return;
    }
    const image = single.currentImage();
    if (!image) {
      return;
    }
    const spec = await withModal(() =>
      specModal.openManual({
        name: image.name,
        fileSize: image.data.length,
        maxTextureSize,
        format: image.spec.format,
        width: image.spec.width,
        height: image.spec.height,
        stride: image.spec.stride,
        scanline: image.spec.scanline,
        reason: "手动调整当前图像的规格参数",
      })
    );
    if (!spec) {
      return;
    }

    const detected = spec.format === "p010" ? detectP010Alignment(image.data) : "high";
    const alignment: P010Alignment = detected === "unknown" ? "high" : detected;
    if (!single.updateSpec(spec, alignment)) {
      showBanner("无法应用该规格：图像数据不足或超过 GPU 限制");
      return;
    }
    syncFormatSelect(spec.format);

    if (!image.path) {
      return;
    }
    try {
      const stat = await host.statPath(image.path);
      await specCache.saveSpec(stat.path, stat.size, stat.modified_ms, spec);
      showSuccess("已将该规格写入此文件的缓存");
    } catch (error) {
      showBanner(`保存规格缓存失败：${errorMessage(error)}`);
    }
  }

  const exportPane = (id: "a" | "b", image: ImagePayload): ExportPaneOption => ({
    id,
    name: image.name,
    width: image.spec.width,
    height: image.spec.height,
  });

  async function exportImage(targetPath?: string) {
    const state = store.get();
    let imageA: ImagePayload | null = null;
    let imageB: ImagePayload | null = null;

    if (state.mode.kind === "list") {
      if (state.selectionOrder.length > 1) {
        showBanner("导出图片一次只能处理一个文件，请只选择一个文件");
        return;
      }
      const path = targetPath ?? state.selectionOrder[0] ?? null;
      if (!path) {
        showBanner("请先在文件列表中选择要导出的文件");
        return;
      }
      notice.show("正在读取图像…");
      let outcome: LoadOutcome;
      try {
        outcome = await loadFile(loadDeps, path, null);
      } finally {
        notice.hide();
      }
      if (store.get().generation !== state.generation) {
        return;
      }
      if (outcome.kind === "cancelled") {
        return;
      }
      if (outcome.kind === "error") {
        showBanner(outcome.message);
        return;
      }
      imageA = payloadOf(path, outcome.file);
    } else if (state.mode.kind === "single") {
      imageA = single.currentImage();
    } else {
      const current = compare.current();
      imageA = current.a;
      imageB = current.b;
    }

    const panes: ExportPaneOption[] = [];
    if (imageA) {
      panes.push(exportPane("a", imageA));
    }
    if (imageB) {
      panes.push(exportPane("b", imageB));
    }
    if (panes.length === 0) {
      showBanner("请先打开图像再导出");
      return;
    }

    const choice = await withModal(() => exportModal.choose(panes));
    if (!choice) {
      return;
    }
    const image = choice.pane === "b" ? imageB : imageA;
    if (!image) {
      return;
    }
    const label = choice.format.toUpperCase();

    let target: string | null;
    try {
      const directory = image.path ? policy.parent(image.path) : state.dir;
      target = await host.pickExportPath(
        exportFileName(image.name, choice.format),
        choice.format,
        directory
      );
    } catch (error) {
      showBanner(`无法选择保存位置：${errorMessage(error)}`);
      return;
    }
    if (!target) {
      return;
    }

    notice.show(`正在导出 ${label}…`);
    try {
      const data = encodeImageBase64(image, colorStandard, choice.format, choice.quality);
      await host.writeImage(target, data, choice.format);
      showSuccess(`已导出 ${label}：${policy.basename(target)}`);
    } catch (error) {
      showBanner(`导出 ${label} 失败：${errorMessage(error)}`);
    } finally {
      notice.hide();
    }
  }

  const loadDeps: LoadDeps = {
    host: cachedHost,
    maxTextureSize,
    chooseFormat: (name) =>
      withModal(() => specModal.chooseFormat(name)),
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
    cachedSpec: (path, size, modifiedMs, max) =>
      specCache.cachedSpec(path, size, modifiedMs, max),
    saveSpec: (path, size, modifiedMs, spec) =>
      specCache.saveSpec(path, size, modifiedMs, spec),
  };

  const payloadOf = (path: string, loaded: LoadedFile): ImagePayload => ({
    spec: loaded.spec,
    data: loaded.data,
    alignment: loaded.alignment,
    name: policy.basename(path),
    path,
  });

  const batchDeps: LoadDeps = { ...loadDeps, host };

  const targetExists = async (path: string): Promise<boolean> => {
    try {
      await host.statPath(path);
      return true;
    } catch (error) {
      return (error as { kind?: unknown }).kind !== "not_found";
    }
  };

  async function refreshCurrentList(): Promise<{ state: AppState; rows: FileRow[] } | null> {
    const state = store.get();
    if (state.mode.kind !== "list") {
      return null;
    }
    const token = nextToken();
    store.dispatch({ type: "requestStarted", token });
    const entries = await host.listDirEntries(state.dir);
    const rows = sortRows(rowsFromEntries(entries.map(fromWireEntry)), state.sortKey, state.sortDesc);
    if (store.get().generation !== token) {
      return null;
    }
    store.dispatch({ type: "openDir", token, dir: state.dir, rows });
    return { state, rows };
  }

  async function batchConvert() {
    if (batchRunning) {
      return;
    }
    const state = store.get();
    if (state.mode.kind !== "list") {
      showBanner("请回到文件列表后再进行批量转换");
      return;
    }
    const selected = new Set(state.selectionOrder.map((path) => policy.key(path)));
    const targets =
      state.selectionOrder.length > 0
        ? state.rows.map((row) => row.path).filter((path) => selected.has(policy.key(path)))
        : state.rows.map((row) => row.path);
    if (targets.length === 0) {
      showBanner("当前列表没有可转换的文件");
      return;
    }

    batchRunning = true;
    try {
      const choice = await withModal(() => exportModal.chooseBatch(targets.length));
      if (!choice) {
        return;
      }
      const label = choice.format.toUpperCase();

      let converted = 0;
      let skipped = 0;
      let sameFormat = 0;
      let aborted = false;
      const failures: string[] = [];
      notice.show(`正在转换 0/${targets.length}…`);
      try {
        for (let index = 0; index < targets.length; index++) {
          if (store.get().generation !== state.generation) {
            aborted = true;
            break;
          }
          const path = targets[index];
          notice.show(`正在转换 ${index + 1}/${targets.length}…`);
          const target = replaceExtension(path, choice.format);
          // 源文件已经是目标格式，无需转换，也不属于「目标已存在」
          if (policy.key(target) === policy.key(path)) {
            sameFormat++;
            continue;
          }
          if (await targetExists(target)) {
            skipped++;
            continue;
          }
          const outcome = await loadFile(batchDeps, path, null, { interactive: false });
          if (outcome.kind !== "loaded") {
            failures.push(
              `${policy.basename(path)}：${outcome.kind === "error" ? outcome.message : "已取消"}`
            );
            continue;
          }
          try {
            const image = payloadOf(path, outcome.file);
            const data = encodeImageBase64(image, colorStandard, choice.format, choice.quality);
            await host.writeImage(target, data, choice.format);
            converted++;
          } catch (error) {
            failures.push(`${policy.basename(path)}：${errorMessage(error)}`);
          }
        }
      } finally {
        notice.hide();
      }

      if (!aborted && converted > 0) {
        try {
          await refreshCurrentList();
        } catch (error) {
          showBanner(`已转换 ${converted} 个文件，但刷新列表失败：${errorMessage(error)}`);
          return;
        }
      }

      const parts = [`${aborted ? "转换已中断，已转换" : "已转换"} ${converted} 个文件`];
      if (sameFormat > 0) {
        parts.push(`跳过 ${sameFormat} 个（已是 ${label} 格式）`);
      }
      if (skipped > 0) {
        parts.push(`跳过 ${skipped} 个（目标已存在）`);
      }
      if (failures.length > 0) {
        parts.push(`失败 ${failures.length} 个`);
      }
      const summary = `${parts.join("，")}（${label}）`;
      if (failures.length > 0) {
        showBanner(
          `${summary}；${failures.slice(0, 3).join("；")}${failures.length > 3 ? " 等" : ""}`
        );
      } else {
        showSuccess(summary);
      }
    } finally {
      batchRunning = false;
    }
  }

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
      syncSpecInputs();
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
    const next = neighborPath(
      filterRows(state.rows, state.filter),
      state.displayedFile ?? state.mode.file,
      delta
    );
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

  let lastGeometry = config.window;

  const persist = async () => {
    let geometry = lastGeometry;
    try {
      const current = await host.windowGeometry();
      if (current) {
        lastGeometry = current;
        geometry = current;
      }
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
  searchInput.addEventListener("input", () => {
    store.dispatch({ type: "setFilter", value: searchInput.value });
  });
  backButton.addEventListener("click", () => {
    store.dispatch({ type: "backToList" });
  });
  prevButton.addEventListener("click", () => openNeighbor(-1));
  nextButton.addEventListener("click", () => openNeighbor(1));
  zoomOneButton.addEventListener("click", () => activeView().oneToOne());
  zoomFitButton.addEventListener("click", () => activeView().fit());
  compareSync.addEventListener("change", () => compare.setSync(compareSync.checked));
  compareSwap.addEventListener("click", () => {
    compare.swap();
    store.dispatch({ type: "swapCompare" });
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

    if (modifier && event.shiftKey && event.key.toLowerCase() === "e") {
      event.preventDefault();
      void exportImage();
      return;
    }

    if (modifier && event.shiftKey && event.key.toLowerCase() === "b") {
      event.preventDefault();
      if (state.mode.kind === "list") {
        void batchConvert();
      }
      return;
    }

    if (event.key === "F2") {
      const path = state.mode.kind === "list" ? selectionPath(state.selectionOrder) : null;
      if (path) {
        event.preventDefault();
        void renameFile(path);
      }
      return;
    }

    if (event.key === "Delete") {
      if (state.mode.kind === "list" && state.selectionOrder.length > 0) {
        event.preventDefault();
        void deleteFiles(state.selectionOrder);
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
    colorControl.classList.toggle("hidden", inList);
    zoomControl.classList.toggle("hidden", inList);
    compareControl.classList.toggle("hidden", kind !== "compare");
    specControl.classList.toggle("hidden", kind !== "single");
    // JPEG/PNG 已解码为 RGB，色彩标准不参与转换，禁止切换
    if (kind === "single") {
      const image = single.currentImage();
      colorSelect.disabled = image !== null && isImageFormat(image.spec.format);
    } else if (kind === "compare") {
      const current = compare.current();
      colorSelect.disabled = ![current.a, current.b].some(
        (image) => image !== null && !isImageFormat(image.spec.format)
      );
    } else {
      colorSelect.disabled = true;
    }
    backButton.classList.toggle("hidden", kind === "list");
    prevButton.classList.toggle("hidden", kind !== "single");
    nextButton.classList.toggle("hidden", kind !== "single");
    address.classList.toggle("hidden", !inList);
    goButton.classList.toggle("hidden", !inList);
    searchControl.classList.toggle("hidden", !inList);
    if (document.activeElement !== address) {
      address.value = state.dir;
    }
    if (document.activeElement !== searchInput) {
      searchInput.value = state.filter;
    }
    const errorText = state.error ?? "";
    errorLine.textContent = errorText;
    errorLine.title = errorText;
    const title = windowTitle(state.mode.kind === "single" ? policy.basename(state.mode.file) : null);
    if (document.title !== title) {
      document.title = title;
      void host.setWindowTitle(title);
    }

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
  const startupGeometry = await host.windowGeometry();
  if (startupGeometry) {
    lastGeometry = startupGeometry;
  }
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
    banner.title = banner.textContent;
    banner.classList.remove("hidden");
  }
  console.error(error);
});
