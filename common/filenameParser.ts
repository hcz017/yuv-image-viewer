import type { YuvFormat } from "./types";

export interface SizeCandidate {
  width: number;
  height: number;
  stride?: number;
  scanline?: number;
  source: string;
}

const SIZE_PATTERN = /(\d{2,5})\s*[xX]\s*(\d{2,5})/g;

function collect(input: string): SizeCandidate[] {
  const matches: SizeCandidate[] = [];
  let match: RegExpExecArray | null;
  SIZE_PATTERN.lastIndex = 0;
  while ((match = SIZE_PATTERN.exec(input)) !== null) {
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (width > 0 && height > 0) {
      matches.push({ width, height, source: match[0] });
    }
  }
  return matches;
}

export function formatFromName(name: string): YuvFormat | null {
  const dot = name.lastIndexOf(".");
  if (dot < 0) {
    return null;
  }
  const ext = name.slice(dot + 1).toLowerCase();
  return ["nv12", "nv21", "i420", "yv12", "p010", "yuv"].includes(ext)
    ? (ext as YuvFormat)
    : null;
}

export function parseSizeCandidates(name: string): SizeCandidate[] {
  const result: SizeCandidate[] = [];
  const rules: Array<(input: string) => SizeCandidate | null> = [
    (input) => {
      const match = /_size_(\d+)x(\d+)_align(\d+)x(\d+)_/i.exec(input);
      return match
        ? {
            width: +match[1],
            height: +match[2],
            stride: +match[3],
            scanline: +match[4],
            source: "size+align",
          }
        : null;
    },
    (input) => {
      const size = /_size_(\d+)x(\d+)_/i.exec(input);
      const stride = /_stride_(\d+)_/i.exec(input);
      return size && stride
        ? {
            width: +size[1],
            height: +size[2],
            stride: +stride[1],
            scanline: +size[2],
            source: "size+stride",
          }
        : null;
    },
    (input) => {
      const match = /(\d+)x(\d+)_align(\d+)x(\d+)/i.exec(input);
      return match
        ? {
            width: +match[1],
            height: +match[2],
            stride: +match[3],
            scanline: +match[4],
            source: "WxH_align",
          }
        : null;
    },
  ];

  for (const rule of rules) {
    const candidate = rule(name);
    if (candidate) {
      result.push(candidate);
    }
  }

  const generic = collect(name);
  for (let index = generic.length - 1; index >= 0; index--) {
    result.push({ ...generic[index], source: "generic" });
  }

  const seen = new Set<string>();
  return result.filter((candidate) => {
    const key = `${candidate.width}x${candidate.height}|${candidate.stride ?? ""}|${candidate.scanline ?? ""}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
