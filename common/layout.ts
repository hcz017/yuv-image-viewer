import type { Spec } from "./types";

export interface PlaneLayout {
  y: { stride: number; scanline: number };
  chroma: { stride: number; scanline: number };
}

export function layoutFor(spec: Spec): PlaneLayout {
  return {
    y: { stride: spec.stride, scanline: spec.scanline },
    chroma: {
      stride: Math.floor(spec.stride / 2),
      scanline: Math.floor(spec.scanline / 2),
    },
  };
}
