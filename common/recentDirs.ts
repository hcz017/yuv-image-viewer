import type { PathPolicy } from "./pathPolicy";

export function pushRecentDir(
  recent: readonly string[],
  path: string,
  policy: PathPolicy,
  max = 10
): string[] {
  const key = policy.key(path);
  const filtered = recent.filter((item) => policy.key(item) !== key);
  return [path, ...filtered].slice(0, max);
}
