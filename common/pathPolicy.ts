export interface PathPolicy {
  separator: "\\" | "/";
  caseInsensitive: boolean;
  rootLabel: string;
  modifier: "Ctrl" | "Cmd";
  key(path: string): string;
  parent(path: string): string;
  basename(path: string): string;
  segments(path: string): string[];
  join(base: string, ...parts: string[]): string;
  isRoot(path: string): boolean;
  isAbsolute(path: string): boolean;
}

function collapsePosix(path: string): string {
  let value = path.replace(/\/{2,}/g, "/");
  if (value.length > 1 && value.endsWith("/")) {
    value = value.replace(/\/+$/, "");
  }
  return value === "" ? "/" : value;
}

function collapseWindows(path: string): string {
  let value = path.replace(/\//g, "\\");
  const unc = value.startsWith("\\\\");
  if (unc) {
    value = "\\\\" + value.slice(2).replace(/\\{2,}/g, "\\");
  } else {
    value = value.replace(/\\{2,}/g, "\\");
  }
  if (!isWindowsRoot(value) && value.length > 3) {
    value = value.replace(/\\+$/, "");
  }
  return value;
}

function isWindowsRoot(path: string): boolean {
  if (/^[A-Za-z]:\\$/.test(path)) {
    return true;
  }
  return /^\\\\[^\\]+\\[^\\]+\\?$/.test(path);
}

export function createPathPolicy(input: {
  path_separator: string;
  case_insensitive_paths: boolean;
  volume_root_label: string;
  modifier_label: string;
}): PathPolicy {
  const isWindows = input.path_separator === "\\";
  const separator: "\\" | "/" = isWindows ? "\\" : "/";
  const normalize = (path: string) => (isWindows ? collapseWindows(path) : collapsePosix(path));

  const isRoot = (path: string) => {
    const value = normalize(path);
    if (isWindows) {
      return isWindowsRoot(value);
    }
    return value === "/";
  };

  const parent = (path: string) => {
    const value = normalize(path);
    if (isRoot(value)) {
      return value;
    }
    if (isWindows) {
      if (/^[A-Za-z]:$/.test(value)) {
        return value + "\\";
      }
      const index = value.lastIndexOf("\\");
      if (index <= 0) {
        return value;
      }
      const head = value.slice(0, index);
      if (/^[A-Za-z]:$/.test(head)) {
        return head + "\\";
      }
      if (/^\\\\[^\\]+$/.test(head)) {
        return head + "\\";
      }
      return head;
    }
    const index = value.lastIndexOf("/");
    return index <= 0 ? "/" : value.slice(0, index);
  };

  const basename = (path: string) => {
    const value = normalize(path);
    if (isRoot(value)) {
      return value;
    }
    const index = isWindows ? value.lastIndexOf("\\") : value.lastIndexOf("/");
    return index < 0 ? value : value.slice(index + 1);
  };

  const segments = (path: string) => {
    const value = normalize(path);
    if (isRoot(value) && !isWindows) {
      return [];
    }
    return value.split(isWindows ? "\\" : "/").filter((part) => part.length > 0);
  };

  const join = (base: string, ...parts: string[]) => {
    let result = normalize(base);
    for (const part of parts) {
      if (!part) {
        continue;
      }
      if (isRoot(result)) {
        result = result.endsWith(separator) ? result + part : result + separator + part;
      } else {
        result = result + separator + part;
      }
    }
    return normalize(result);
  };

  const key = (path: string) => {
    const value = normalize(path);
    return input.case_insensitive_paths ? value.toLowerCase() : value;
  };

  const isAbsolute = (path: string) => {
    if (isWindows) {
      return /^[A-Za-z]:[\\/]/.test(path) || /^\\\\/.test(path);
    }
    return path.startsWith("/");
  };

  return {
    separator,
    caseInsensitive: input.case_insensitive_paths,
    rootLabel: input.volume_root_label,
    modifier: input.modifier_label === "Cmd" ? "Cmd" : "Ctrl",
    key,
    parent,
    basename,
    segments,
    join,
    isRoot,
    isAbsolute,
  };
}

export const windowsPolicy: PathPolicy = createPathPolicy({
  path_separator: "\\",
  case_insensitive_paths: true,
  volume_root_label: "此电脑",
  modifier_label: "Ctrl",
});

export const macPolicy: PathPolicy = createPathPolicy({
  path_separator: "/",
  case_insensitive_paths: true,
  volume_root_label: "此电脑",
  modifier_label: "Cmd",
});

export const linuxPolicy: PathPolicy = createPathPolicy({
  path_separator: "/",
  case_insensitive_paths: false,
  volume_root_label: "此电脑",
  modifier_label: "Ctrl",
});
