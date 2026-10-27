import type { PathPolicy } from "./pathPolicy";

export interface StatInfo {
  exists: boolean;
  isDir: boolean;
  supported: boolean;
}

export type OpenDecision =
  | { kind: "dir"; dir: string }
  | { kind: "file"; dir: string; file: string }
  | { kind: "compare"; dir: string; a: string; b: string }
  | { kind: "error"; message: string };

export function resolveOpenRequest(
  paths: readonly string[],
  stat: (path: string) => StatInfo,
  policy: PathPolicy
): OpenDecision {
  if (paths.length === 0) {
    return { kind: "error", message: "没有可打开的路径" };
  }
  if (paths.length > 2) {
    return { kind: "error", message: "仅支持同时对比两张图片" };
  }
  for (const path of paths) {
    if (!policy.isAbsolute(path)) {
      return { kind: "error", message: `请输入绝对路径：${path}` };
    }
  }

  const infos = paths.map((path) => ({ path, info: stat(path) }));

  for (const { path, info } of infos) {
    if (!info.exists) {
      return { kind: "error", message: `路径不存在：${path}` };
    }
  }

  if (infos.length === 1) {
    const { path, info } = infos[0];
    if (info.isDir) {
      return { kind: "dir", dir: path };
    }
    if (!info.supported) {
      return { kind: "error", message: `不支持的文件类型：${policy.basename(path)}` };
    }
    return { kind: "file", dir: policy.parent(path), file: path };
  }

  const [first, second] = infos;
  if (first.info.isDir || second.info.isDir) {
    return { kind: "error", message: "目录不能与文件同时打开进行对比" };
  }
  if (!first.info.supported || !second.info.supported) {
    return { kind: "error", message: "只能对比受支持的 YUV 文件" };
  }

  const dirA = policy.parent(first.path);
  const dirB = policy.parent(second.path);
  if (policy.key(dirA) !== policy.key(dirB)) {
    return { kind: "error", message: "只能对比同一目录中的文件" };
  }

  return { kind: "compare", dir: dirA, a: first.path, b: second.path };
}
