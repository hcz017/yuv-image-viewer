import { formatDimensions } from "../../common/spec";
import type { SpecCacheEntry } from "../../common/specCache";

export interface CacheModalDeps {
  entries(): readonly SpecCacheEntry[];
  basename(path: string): string;
  remove(path: string): Promise<void>;
  clearAll(): Promise<void>;
}

export interface CacheModal {
  open(deps: CacheModalDeps): Promise<void>;
}

function describe(entry: SpecCacheEntry): string {
  return `${formatDimensions(entry.spec)} · ${entry.spec.format.toUpperCase()} · stride ${
    entry.spec.stride
  } · scanline ${entry.spec.scanline}`;
}

export function createCacheModal(container: HTMLElement): CacheModal {
  return {
    open(deps) {
      return new Promise<void>((resolve) => {
        const backdrop = document.createElement("div");
        backdrop.className = "modal-backdrop";

        const modal = document.createElement("div");
        modal.className = "modal cache-modal";

        const title = document.createElement("h2");
        title.textContent = "图片规格缓存";

        const body = document.createElement("div");
        body.className = "cache-list";
        const error = document.createElement("p");
        error.className = "modal-error";

        const actions = document.createElement("div");
        actions.className = "modal-actions";
        const clearAll = document.createElement("button");
        clearAll.textContent = "清除全部";
        const close = document.createElement("button");
        close.className = "primary";
        close.textContent = "关闭";
        actions.append(clearAll, close);

        const render = () => {
          body.textContent = "";
          const entries = deps.entries();
          clearAll.disabled = entries.length === 0;
          if (entries.length === 0) {
            const empty = document.createElement("p");
            empty.className = "muted";
            empty.textContent = "暂无缓存记录。打开无法识别尺寸的文件并手动确认规格后会写入缓存。";
            body.append(empty);
            return;
          }

          for (const entry of entries) {
            const row = document.createElement("div");
            row.className = "cache-row";

            const info = document.createElement("div");
            info.className = "cache-info";
            const name = document.createElement("div");
            name.className = "cache-name";
            name.textContent = deps.basename(entry.path);
            name.title = entry.path;
            const spec = document.createElement("div");
            spec.className = "cache-meta";
            spec.textContent = describe(entry);
            const updated = document.createElement("div");
            updated.className = "cache-meta";
            updated.textContent = `更新于 ${new Date(entry.updatedMs).toLocaleString()} · ${entry.path}`;
            info.append(name, spec, updated);

            const remove = document.createElement("button");
            remove.textContent = "清除";
            remove.onclick = () => {
              remove.disabled = true;
              error.textContent = "";
              deps
                .remove(entry.path)
                .then(render)
                .catch((reason: unknown) => {
                  remove.disabled = false;
                  error.textContent = `清除失败：${String(reason)}`;
                });
            };

            row.append(info, remove);
            body.append(row);
          }
        };

        clearAll.onclick = () => {
          if (deps.entries().length === 0) {
            return;
          }
          if (!window.confirm("确定清除全部图片规格缓存吗？")) {
            return;
          }
          clearAll.disabled = true;
          error.textContent = "";
          deps
            .clearAll()
            .then(render)
            .catch((reason: unknown) => {
              clearAll.disabled = false;
              error.textContent = `清除失败：${String(reason)}`;
            });
        };

        modal.append(title, body, error, actions);
        backdrop.append(modal);
        container.append(backdrop);
        render();

        const finish = () => {
          document.removeEventListener("keydown", onKeydown);
          backdrop.remove();
          resolve();
        };
        const onKeydown = (event: KeyboardEvent) => {
          if (event.key === "Escape") {
            event.preventDefault();
            finish();
          }
        };

        document.addEventListener("keydown", onKeydown);
        close.onclick = finish;
        backdrop.onclick = (event) => {
          if (event.target === backdrop) {
            finish();
          }
        };
      });
    },
  };
}
