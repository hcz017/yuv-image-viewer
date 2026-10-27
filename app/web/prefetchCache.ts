import type { HostApi } from "./host";

const MAX_FILES = 4;
const MAX_FILE_BYTES = 32 * 1024 * 1024;
const MAX_TOTAL_BYTES = 96 * 1024 * 1024;

export interface PrefetchCache {
  read(path: string): Promise<Uint8Array>;
  schedule(paths: readonly string[]): void;
  clear(): void;
}

export function createPrefetchCache(host: HostApi): PrefetchCache {
  const cache = new Map<string, Uint8Array>();
  const inflight = new Map<string, Promise<Uint8Array | null>>();
  let total = 0;
  let queue: string[] = [];
  let running = false;

  function evict() {
    while (cache.size > MAX_FILES) {
      const oldest = cache.keys().next();
      if (oldest.done) {
        break;
      }
      const data = cache.get(oldest.value);
      cache.delete(oldest.value);
      total -= data?.byteLength ?? 0;
    }
    while (total > MAX_TOTAL_BYTES && cache.size > 0) {
      const oldest = cache.keys().next();
      if (oldest.done) {
        break;
      }
      const data = cache.get(oldest.value);
      cache.delete(oldest.value);
      total -= data?.byteLength ?? 0;
    }
  }

  async function runQueue() {
    if (running) {
      return;
    }
    running = true;
    try {
      while (queue.length > 0) {
        const path = queue.shift()!;
        if (cache.has(path) || inflight.has(path)) {
          continue;
        }
        try {
          const stat = await host.statPath(path);
          if (stat.is_dir || stat.size > MAX_FILE_BYTES) {
            continue;
          }
          const promise = host
            .readFileBytes(path)
            .then((data) => {
              if (data.byteLength > MAX_FILE_BYTES) {
                return null;
              }
              cache.set(path, data);
              total += data.byteLength;
              evict();
              return data;
            })
            .catch(() => null)
            .finally(() => {
              inflight.delete(path);
            });
          inflight.set(path, promise);
          await promise;
        } catch {
          // 预取失败不影响主流程
        }
      }
    } finally {
      running = false;
    }
  }

  return {
    async read(path) {
      const cached = cache.get(path);
      if (cached) {
        return cached;
      }
      const pending = inflight.get(path);
      if (pending) {
        const data = await pending;
        if (data) {
          return data;
        }
      }
      return host.readFileBytes(path);
    },
    schedule(paths) {
      for (const path of paths) {
        if (!cache.has(path) && !inflight.has(path) && !queue.includes(path)) {
          queue.push(path);
        }
      }
      void runQueue();
    },
    clear() {
      cache.clear();
      queue = [];
      total = 0;
    },
  };
}
