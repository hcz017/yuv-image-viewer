import type { PathPolicy } from "../../common/pathPolicy";
import { validateSpec } from "../../common/spec";
import {
  decodeSpecCache,
  encodeSpecCache,
  entryMatches,
  type SpecCacheEntry,
} from "../../common/specCache";
import type { Spec } from "../../common/types";
import type { HostApi } from "./host";

export interface SpecCacheApi {
  load(): Promise<void>;
  cachedSpec(
    path: string,
    size: number,
    modifiedMs: number,
    maxTextureSize: number
  ): Promise<Spec | null>;
  saveSpec(path: string, size: number, modifiedMs: number, spec: Spec): Promise<void>;
  updateSpec(path: string, spec: Spec): Promise<void>;
  has(path: string): boolean;
  list(): readonly SpecCacheEntry[];
  remove(path: string): Promise<void>;
  clear(): Promise<void>;
}

function messageOf(error: unknown): string {
  return error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : String(error);
}

/**
 * 规格缓存以规范化路径为键，并额外校验文件大小与修改时间。
 * 所有写入都以完整快照串行提交，后端再做原子替换，避免缓存文件被写坏。
 */
export function createSpecCache(
  host: HostApi,
  policy: PathPolicy,
  notify: (message: string) => void
): SpecCacheApi {
  const entries = new Map<string, SpecCacheEntry>();
  let loading: Promise<void> | null = null;
  let loadFailed = false;
  let writes: Promise<void> = Promise.resolve();

  const load = (): Promise<void> => {
    loading ??= host
      .loadSpecCache()
      .then((wire) => {
        for (const entry of decodeSpecCache(wire)) {
          entries.set(policy.key(entry.path), entry);
        }
      })
      .catch((error: unknown) => {
        loadFailed = true;
        notify(`读取规格缓存失败：${messageOf(error)}`);
      });
    return loading;
  };

  const persist = (): Promise<void> => {
    if (loadFailed) {
      return Promise.resolve();
    }
    const snapshot = encodeSpecCache([...entries.values()]);
    writes = writes
      .catch(() => undefined)
      .then(() => host.saveSpecCache(snapshot))
      .catch((error: unknown) => {
        notify(`保存规格缓存失败：${messageOf(error)}`);
      });
    return writes;
  };

  return {
    load,

    async cachedSpec(path, size, modifiedMs, maxTextureSize) {
      await load();
      const key = policy.key(path);
      const entry = entries.get(key);
      if (!entry) {
        return null;
      }
      if (!entryMatches(entry, size, modifiedMs)) {
        entries.delete(key);
        notify("文件已修改，旧的规格缓存已失效，请重新配置参数");
        void persist();
        return null;
      }
      if (validateSpec(entry.spec, size, maxTextureSize).kind === "invalid") {
        entries.delete(key);
        notify("规格缓存与当前文件不匹配，已清除，请重新配置参数");
        void persist();
        return null;
      }
      return entry.spec;
    },

    async saveSpec(path, size, modifiedMs, spec) {
      await load();
      entries.set(policy.key(path), {
        path,
        size,
        modifiedMs,
        spec,
        updatedMs: Date.now(),
      });
      await persist();
    },

    async updateSpec(path, spec) {
      await load();
      const key = policy.key(path);
      const entry = entries.get(key);
      if (!entry) {
        return;
      }
      entries.set(key, { ...entry, spec, updatedMs: Date.now() });
      await persist();
    },

    has(path) {
      return entries.has(policy.key(path));
    },

    list() {
      return [...entries.values()].sort((a, b) => b.updatedMs - a.updatedMs);
    },

    async remove(path) {
      await load();
      entries.delete(policy.key(path));
      await persist();
    },

    async clear() {
      await load();
      entries.clear();
      await persist();
    },
  };
}
