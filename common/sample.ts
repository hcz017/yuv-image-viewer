import { coefficients } from "./colorspace";
import type { P010Alignment } from "./bitdepth";
import { layoutOf } from "./spec";
import type { ColorStandard, Spec } from "./types";

export interface PixelReadout {
  y: number;
  u: number;
  v: number;
  r: number;
  g: number;
  b: number;
}

function read16(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8);
}

function readSample(
  data: Uint8Array,
  offset: number,
  bytesPerSample: 1 | 2,
  alignment: P010Alignment
): number {
  if (bytesPerSample === 1) {
    return data[offset];
  }
  const word = read16(data, offset);
  return alignment === "low" ? word & 0x03ff : word >> 6;
}

export function readPixel(
  data: Uint8Array,
  spec: Spec,
  x: number,
  y: number,
  standard: ColorStandard,
  alignment: P010Alignment = "high"
): PixelReadout | null {
  if (x < 0 || y < 0 || x >= spec.width || y >= spec.height) {
    return null;
  }

  const layout = layoutOf(spec.format);

  if (layout === "rgba") {
    const offset = (y * spec.stride + x) * 4;
    if (offset + 4 > data.length) {
      return null;
    }
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const luma = Math.round(
      standard === "bt709"
        ? 0.2126 * r + 0.7152 * g + 0.0722 * b
        : 0.299 * r + 0.587 * g + 0.114 * b
    );
    const c = coefficients(standard);
    return {
      y: luma,
      u: clampByte(Math.round((b - luma) / c.bu) + 128),
      v: clampByte(Math.round((r - luma) / c.rv) + 128),
      r,
      g,
      b,
    };
  }

  if (layout === "gray") {
    const offset = y * spec.stride + x;
    if (offset + 1 > data.length) {
      return null;
    }
    const value = data[offset];
    return { y: value, u: 128, v: 128, r: value, g: value, b: value };
  }

  if (layout === "422") {
    const yuyv = spec.format === "yuyv";
    const offset = (y * spec.stride + x) * 2 + (yuyv ? 0 : 1);
    if (offset + 1 > data.length) {
      return null;
    }
    const yValue = data[offset];
    const pair = y * spec.stride * 2 + (x >> 1) * 4;
    if (pair + 4 > data.length) {
      return null;
    }
    const uValue = data[pair + (yuyv ? 1 : 0)];
    const vValue = data[pair + (yuyv ? 3 : 2)];
    return toReadout(yValue, uValue, vValue, standard);
  }

  const bps = spec.bytesPerSample;
  const yOffset = (y * spec.stride + x) * bps;
  if (yOffset + bps > data.length) {
    return null;
  }
  let yValue = readSample(data, yOffset, bps, alignment);

  const chromaRowBytes = spec.stride * bps;
  const chromaBase = spec.stride * spec.scanline * bps;
  let uValue = 128;
  let vValue = 128;

  if (spec.format === "nv12" || spec.format === "nv21" || spec.format === "p010") {
    const offset = chromaBase + (y >> 1) * chromaRowBytes + (x >> 1) * 2 * bps;
    if (offset + 2 * bps > data.length) {
      return null;
    }
    const first = readSample(data, offset, bps, alignment);
    const second = readSample(data, offset + bps, bps, alignment);
    if (spec.format === "nv21") {
      vValue = first;
      uValue = second;
    } else {
      uValue = first;
      vValue = second;
    }
  } else {
    const planeSize = Math.floor(spec.stride / 2) * Math.floor(spec.scanline / 2) * bps;
    const offset =
      chromaBase + (y >> 1) * Math.floor(spec.stride / 2) * bps + (x >> 1) * bps;
    if (offset + planeSize + bps > data.length) {
      return null;
    }
    const first = readSample(data, offset, bps, alignment);
    const second = readSample(data, offset + planeSize, bps, alignment);
    if (spec.format === "yv12") {
      vValue = first;
      uValue = second;
    } else {
      uValue = first;
      vValue = second;
    }
  }

  if (bps === 2) {
    const shift = 10 - 8;
    yValue = Math.min(255, Math.max(0, Math.round(yValue >> shift)));
    uValue = Math.min(255, Math.max(0, Math.round(uValue >> shift)));
    vValue = Math.min(255, Math.max(0, Math.round(vValue >> shift)));
  }

  return toReadout(yValue, uValue, vValue, standard);
}

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, value));
}

function toReadout(
  yValue: number,
  uValue: number,
  vValue: number,
  standard: ColorStandard
): PixelReadout {
  const c = coefficients(standard);
  const u = uValue - 128;
  const v = vValue - 128;
  const r = yValue + c.rv * v;
  const g = yValue - c.gu * u - c.gv * v;
  const b = yValue + c.bu * u;

  return {
    y: yValue,
    u: uValue,
    v: vValue,
    r: Math.round(clampByte(r)),
    g: Math.round(clampByte(g)),
    b: Math.round(clampByte(b)),
  };
}
