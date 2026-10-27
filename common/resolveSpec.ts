import { formatFromName, parseSizeCandidates } from "./filenameParser";
import { guessSpecsBySize } from "./sizeGuesser";
import { makeSpec, validateSpec } from "./spec";
import type { Spec, YuvFormat } from "./types";

export type SpecResolution =
  | { kind: "resolved"; spec: Spec }
  | { kind: "chooseFormat" }
  | { kind: "manual"; reason: string }
  | { kind: "invalid"; message: string };

export interface ResolveInput {
  name: string;
  fileSize: number;
  format: YuvFormat | null;
  maxTextureSize?: number;
}

export function resolveSpec(input: ResolveInput): SpecResolution {
  if (input.fileSize < 6) {
    return { kind: "invalid", message: "文件过小，无法容纳有效图像数据" };
  }

  const format = input.format ?? formatFromName(input.name);
  if (!format || format === "yuv") {
    return { kind: "chooseFormat" };
  }

  const maxTextureSize = input.maxTextureSize ?? 16384;
  const candidates = parseSizeCandidates(input.name);
  for (const candidate of candidates) {
    const spec = makeSpec(
      candidate.width,
      candidate.height,
      candidate.stride ?? candidate.width,
      candidate.scanline ?? candidate.height,
      format
    );
    if (validateSpec(spec, input.fileSize, maxTextureSize).kind !== "invalid") {
      return { kind: "resolved", spec };
    }
  }

  const guessed = guessSpecsBySize(input.fileSize, format);
  if (guessed.length === 1) {
    return { kind: "resolved", spec: guessed[0] };
  }
  if (guessed.length > 1) {
    return { kind: "manual", reason: "文件名中没有可靠规格，且字节数存在多个候选" };
  }
  return { kind: "manual", reason: "文件名中没有可用规格，字节数也无法推测" };
}
