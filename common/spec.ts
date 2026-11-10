import type { Spec, YuvFormat } from "./types";

export type PixelLayout = "420" | "422" | "gray" | "rgba";

/** 像素布局：决定每像素字节数、纹理组织方式与尺寸奇偶要求。 */
export function layoutOf(format: YuvFormat): PixelLayout {
  switch (format) {
    case "yuyv":
    case "uyvy":
      return "422";
    case "gray":
      return "gray";
    case "jpg":
    case "png":
      return "rgba";
    default:
      return "420";
  }
}

/** JPEG/PNG 在内存中按 RGBA 原始像素保存，尺寸来自文件头。 */
export function isImageFormat(format: YuvFormat): format is "jpg" | "png" {
  return layoutOf(format) === "rgba";
}

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
  const pixels = spec.stride * spec.scanline;
  switch (layoutOf(spec.format)) {
    case "422":
      return pixels * 2;
    case "gray":
      return pixels;
    case "rgba":
      return pixels * 4;
    default:
      return (pixels * 3 * spec.bytesPerSample) / 2;
  }
}

export interface SpecCheck {
  kind: "ok" | "short" | "trailing" | "invalid";
  expected: number;
  reason?: string;
}

export function validateSpec(
  spec: Spec,
  fileSize: number,
  maxTextureSize = 16384,
  options: { allowShort?: boolean } = {}
): SpecCheck {
  if (!Number.isInteger(spec.width) || !Number.isInteger(spec.height)) {
    return { kind: "invalid", expected: 0, reason: "宽高必须是整数" };
  }
  if (spec.width < 2 || spec.height < 2) {
    return { kind: "invalid", expected: 0, reason: "宽高必须不小于 2" };
  }
  const layout = layoutOf(spec.format);
  if ((layout === "420" || layout === "422") && spec.width % 2 !== 0) {
    return { kind: "invalid", expected: 0, reason: "宽度必须是偶数" };
  }
  if (layout === "420" && spec.height % 2 !== 0) {
    return { kind: "invalid", expected: 0, reason: "高度必须是偶数" };
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
    if (options.allowShort) {
      return { kind: "short", expected };
    }
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
