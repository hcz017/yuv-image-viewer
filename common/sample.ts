import { coefficients } from "./colorspace";
import type { P010Alignment } from "./bitdepth";
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

  const bps = spec.bytesPerSample;
  const yOffset = (y * spec.stride + x) * bps;
  let yValue = readSample(data, yOffset, bps, alignment);

  const chromaRowBytes = spec.stride * bps;
  const chromaBase = spec.stride * spec.scanline * bps;
  let uValue = 128;
  let vValue = 128;

  if (spec.format === "nv12" || spec.format === "nv21" || spec.format === "p010") {
    const offset = chromaBase + (y >> 1) * chromaRowBytes + (x >> 1) * 2 * bps;
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
    r: Math.round(Math.min(255, Math.max(0, r))),
    g: Math.round(Math.min(255, Math.max(0, g))),
    b: Math.round(Math.min(255, Math.max(0, b))),
  };
}
