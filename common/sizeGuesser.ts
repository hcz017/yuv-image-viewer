import { expectedBytes, makeSpec } from "./spec";
import type { Spec, YuvFormat } from "./types";

const RESOLUTIONS: Array<[number, number]> = [
  [640, 480],
  [720, 576],
  [704, 576],
  [800, 600],
  [1024, 768],
  [1280, 720],
  [1280, 960],
  [1600, 1200],
  [1920, 1080],
  [2048, 1080],
  [2560, 1440],
  [352, 288],
  [176, 144],
  [3840, 2160],
  [4096, 2160],
  [4608, 3456],
];

const STRIDE_ALIGNMENTS = [0, 8, 16, 32, 64, 128, 256];
const SCANLINE_ALIGNMENTS = [0, 8, 16, 32, 64];

function align(value: number, alignment: number): number {
  if (alignment <= 0) {
    return value;
  }
  return Math.ceil(value / alignment) * alignment;
}

export function guessSpecsBySize(fileSize: number, format: YuvFormat): Spec[] {
  const found: Array<{ spec: Spec; padding: number }> = [];
  for (const [width, height] of RESOLUTIONS) {
    for (const strideAlign of STRIDE_ALIGNMENTS) {
      for (const scanlineAlign of SCANLINE_ALIGNMENTS) {
        const stride = align(width, strideAlign);
        const scanline = align(height, scanlineAlign);
        const spec = makeSpec(width, height, stride, scanline, format);
        if (expectedBytes(spec) === fileSize) {
          found.push({ spec, padding: (stride - width) + (scanline - height) });
        }
      }
    }
  }

  found.sort((a, b) => {
    if (a.padding !== b.padding) {
      return a.padding - b.padding;
    }
    return b.spec.width - a.spec.width;
  });

  const seen = new Set<string>();
  return found
    .map((item) => item.spec)
    .filter((spec) => {
      const key = `${spec.width}x${spec.height}:${spec.stride}x${spec.scanline}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}
