import type { Spec, YuvFormat } from "./types";

export function bytesPerSample(format: YuvFormat): 1 | 2 {
  return format === "p010" ? 2 : 1;
}

export function makeSpec(
  width: number,
  height: number,
  stride: number,
  scanline: number,
  format: YuvFormat
): Spec {
  return {
    width,
    height,
    stride,
    scanline,
    format,
    bytesPerSample: bytesPerSample(format),
  };
}

export function expectedBytes(spec: Spec): number {
  return (spec.stride * spec.scanline * 3 * spec.bytesPerSample) / 2;
}

export interface SpecCheck {
  kind: "ok" | "trailing" | "invalid";
  expected: number;
  reason?: string;
}

export function validateSpec(
  spec: Spec,
  fileSize: number,
  maxTextureSize = 16384
): SpecCheck {
  if (!Number.isInteger(spec.width) || !Number.isInteger(spec.height)) {
    return { kind: "invalid", expected: 0, reason: "宽高必须是整数" };
  }
  if (spec.width < 2 || spec.height < 2) {
    return { kind: "invalid", expected: 0, reason: "宽高必须不小于 2" };
  }
  if (spec.width % 2 !== 0 || spec.height % 2 !== 0) {
    return { kind: "invalid", expected: 0, reason: "宽高必须是偶数" };
  }
  if (spec.stride < spec.width) {
    return { kind: "invalid", expected: 0, reason: "stride 不能小于宽度" };
  }
  if (spec.scanline < spec.height) {
    return { kind: "invalid", expected: 0, reason: "scanline 不能小于高度" };
  }
  if (spec.stride > maxTextureSize || spec.scanline > maxTextureSize) {
    return {
      kind: "invalid",
      expected: 0,
      reason: `stride/scanline 超过 GPU 上限 ${maxTextureSize}`,
    };
  }

  const expected = expectedBytes(spec);
  if (fileSize < expected) {
    return {
      kind: "invalid",
      expected,
      reason: `文件长度 ${fileSize} 小于所需 ${expected}`,
    };
  }
  return { kind: fileSize === expected ? "ok" : "trailing", expected };
}

export function formatDimensions(spec: Spec): string {
  return `${spec.width}x${spec.height}`;
}
