import type { PixelReadout } from "../common/sample";

export function formatReadout(x: number, y: number, pixel: PixelReadout | null): string {
  if (!pixel) {
    return `(${x}, ${y}) —`;
  }
  return `(${x}, ${y})  Y ${pixel.y}  U ${pixel.u}  V ${pixel.v}  R ${pixel.r}  G ${pixel.g}  B ${pixel.b}`;
}
