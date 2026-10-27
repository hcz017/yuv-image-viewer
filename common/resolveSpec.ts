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
  const candidates = parseSizeCandidates(input.name).map((candidate) =>
    makeSpec(
      candidate.width,
      candidate.height,
      candidate.stride ?? candidate.width,
      candidate.scanline ?? candidate.height,
      format
    )
  );

  for (const spec of candidates) {
    if (validateSpec(spec, input.fileSize, maxTextureSize).kind === "ok") {
      return { kind: "resolved", spec };
    }
  }

  const guessed = guessSpecsBySize(input.fileSize, format);
  if (guessed.length === 1) {
    return { kind: "resolved", spec: guessed[0] };
  }
  if (guessed.length > 1) {
    const matching = guessed.filter((guess) =>
      candidates.some(
        (candidate) => candidate.width === guess.width && candidate.height === guess.height
      )
    );
    if (matching.length === 1) {
      return { kind: "resolved", spec: matching[0] };
    }
  }

  for (const spec of candidates) {
    if (validateSpec(spec, input.fileSize, maxTextureSize).kind === "trailing") {
      return { kind: "resolved", spec };
    }
  }

  return { kind: "manual", reason: "文件名中没有可用规格，字节数也无法推测" };
}
