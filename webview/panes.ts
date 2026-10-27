import type { ScissorRect } from "./renderer";

export interface StageLayout {
  gutter: number;
  a: ScissorRect;
  b: ScissorRect;
}

export function splitStage(width: number, height: number, gutter: number): StageLayout {
  const safeGutter = Math.max(0, Math.floor(gutter));
  const usable = Math.max(0, width - safeGutter);
  const left = Math.floor(usable / 2);
  return {
    gutter: safeGutter,
    a: { x: 0, y: 0, width: left, height },
    b: { x: left + safeGutter, y: 0, width: usable - left, height },
  };
}
