export interface View {
  scale: number;
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function fitView(
  imageWidth: number,
  imageHeight: number,
  canvasWidth: number,
  canvasHeight: number
): View {
  if (imageWidth <= 0 || imageHeight <= 0 || canvasWidth <= 0 || canvasHeight <= 0) {
    return { scale: 1, x: 0, y: 0 };
  }
  const scale = Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight);
  return {
    scale,
    x: (canvasWidth - imageWidth * scale) / 2,
    y: (canvasHeight - imageHeight * scale) / 2,
  };
}

export function viewRect(view: View, imageWidth: number, imageHeight: number): Rect {
  return {
    x: view.x,
    y: view.y,
    w: imageWidth * view.scale,
    h: imageHeight * view.scale,
  };
}

export function clipRect(rect: Rect, canvasWidth: number, canvasHeight: number) {
  return {
    x: (rect.x / canvasWidth) * 2 - 1,
    y: 1 - (rect.y / canvasHeight) * 2,
    w: (rect.w / canvasWidth) * 2,
    h: -(rect.h / canvasHeight) * 2,
  };
}

export function zoomAt(
  view: View,
  factor: number,
  anchorX: number,
  anchorY: number,
  imageWidth: number,
  imageHeight: number,
  canvasWidth: number,
  canvasHeight: number
): View {
  const nextScale = Math.min(64, Math.max(0.01, view.scale * factor));
  const ratio = nextScale / view.scale;
  const next: View = {
    scale: nextScale,
    x: anchorX - (anchorX - view.x) * ratio,
    y: anchorY - (anchorY - view.y) * ratio,
  };
  return clampView(next, imageWidth, imageHeight, canvasWidth, canvasHeight);
}

export function panView(
  view: View,
  dx: number,
  dy: number,
  imageWidth: number,
  imageHeight: number,
  canvasWidth: number,
  canvasHeight: number
): View {
  return clampView(
    { ...view, x: view.x + dx, y: view.y + dy },
    imageWidth,
    imageHeight,
    canvasWidth,
    canvasHeight
  );
}

export function clampView(
  view: View,
  imageWidth: number,
  imageHeight: number,
  canvasWidth: number,
  canvasHeight: number
): View {
  const width = imageWidth * view.scale;
  const height = imageHeight * view.scale;
  const x =
    width <= canvasWidth
      ? (canvasWidth - width) / 2
      : Math.min(0, Math.max(canvasWidth - width, view.x));
  const y =
    height <= canvasHeight
      ? (canvasHeight - height) / 2
      : Math.min(0, Math.max(canvasHeight - height, view.y));
  return { scale: view.scale, x, y };
}
