import type { P010Alignment } from "../../common/bitdepth";
import { readPixel } from "../../common/sample";
import type { ColorStandard, Spec } from "../../common/types";
import { Renderer } from "../../webview/renderer";
import {
  clampView,
  clipRect,
  fitView,
  panView,
  viewRect,
  zoomAt,
  type View,
} from "../../webview/viewport";

export interface ImagePayload {
  spec: Spec;
  data: Uint8Array;
  alignment: P010Alignment;
  name: string;
  path: string;
}

export interface SingleViewDeps {
  onReadout: (text: string | null) => void;
  onScale: (scale: number) => void;
  onContextError: (message: string) => void;
}

export interface SingleViewApi {
  readonly element: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  show(image: ImagePayload): void;
  updateSpec(spec: Spec, alignment: P010Alignment): boolean;
  clear(): void;
  setStandard(standard: ColorStandard): void;
  fit(): void;
  oneToOne(): void;
  zoom(factor: number): void;
  redraw(): void;
  currentImage(): ImagePayload | null;
  destroy(): void;
}

const MIN_SCALE = 0.01;
const MAX_SCALE = 64;

export function createSingleView(deps: SingleViewDeps): SingleViewApi {
  const element = document.createElement("div");
  element.className = "view view-single";

  const canvas = document.createElement("canvas");
  canvas.className = "gl-canvas";
  element.append(canvas);

  let renderer: Renderer | null = null;
  let rendererError: string | null = null;
  let image: ImagePayload | null = null;
  let view: View = { scale: 1, x: 0, y: 0 };
  let standard: ColorStandard = "bt601";
  let dragging: { x: number; y: number } | null = null;
  let pendingFit = false;

  const dpr = () => window.devicePixelRatio || 1;

  function ensureRenderer(): Renderer | null {
    if (renderer) {
      return renderer;
    }
    try {
      renderer = new Renderer(canvas);
      rendererError = null;
    } catch (error) {
      rendererError = String(error);
      deps.onContextError(rendererError);
      return null;
    }
    renderer.setStandard(standard);
    return renderer;
  }

  function resize() {
    const scale = dpr();
    const width = Math.max(1, Math.round(canvas.clientWidth * scale));
    const height = Math.max(1, Math.round(canvas.clientHeight * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    if (image) {
      if (pendingFit && canvas.width > 1 && canvas.height > 1) {
        view = fitView(image.spec.width, image.spec.height, canvas.width, canvas.height);
        pendingFit = false;
        deps.onScale(view.scale);
      } else {
        view = clampView(view, image.spec.width, image.spec.height, canvas.width, canvas.height);
      }
    }
    redraw();
  }

  function redraw() {
    if (!image) {
      renderer?.clear({ x: 0, y: 0, width: canvas.width, height: canvas.height });
      return;
    }
    const target = ensureRenderer();
    if (!target) {
      return;
    }
    const rect = viewRect(view, image.spec.width, image.spec.height);
    target.draw(clipRect(rect, canvas.width, canvas.height), {
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
    });
  }

  function fit() {
    if (!image) {
      return;
    }
    view = fitView(image.spec.width, image.spec.height, canvas.width, canvas.height);
    deps.onScale(view.scale);
    redraw();
  }

  function uploadCurrent(): boolean {
    const target = ensureRenderer();
    if (!target || !image) {
      return false;
    }
    target.setStandard(standard);
    const ok = target.upload(image.spec, image.data, image.alignment);
    if (!ok) {
      deps.onContextError("显存不足或图像超出 GPU 纹理上限");
      return false;
    }
    return true;
  }

  function toImagePoint(event: PointerEvent): { x: number; y: number } | null {
    if (!image) {
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    const scale = dpr();
    const px = (event.clientX - rect.left) * scale;
    const py = (event.clientY - rect.top) * scale;
    const x = Math.floor((px - view.x) / view.scale);
    const y = Math.floor((py - view.y) / view.scale);
    if (x < 0 || y < 0 || x >= image.spec.width || y >= image.spec.height) {
      return null;
    }
    return { x, y };
  }

  canvas.addEventListener(
    "wheel",
    (event) => {
      if (!image) {
        return;
      }
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const scale = dpr();
      const anchorX = (event.clientX - rect.left) * scale;
      const anchorY = (event.clientY - rect.top) * scale;
      const factor = Math.exp(-event.deltaY * 0.0015);
      view = zoomAt(
        view,
        factor,
        anchorX,
        anchorY,
        image.spec.width,
        image.spec.height,
        canvas.width,
        canvas.height
      );
      deps.onScale(view.scale);
      redraw();
    },
    { passive: false }
  );

  canvas.addEventListener("pointerdown", (event) => {
    if (!image || event.button !== 0) {
      return;
    }
    canvas.setPointerCapture(event.pointerId);
    dragging = { x: event.clientX, y: event.clientY };
    canvas.classList.add("dragging");
  });

  canvas.addEventListener("pointermove", (event) => {
    if (dragging && image) {
      const scale = dpr();
      const dx = (event.clientX - dragging.x) * scale;
      const dy = (event.clientY - dragging.y) * scale;
      dragging = { x: event.clientX, y: event.clientY };
      view = panView(
        view,
        dx,
        dy,
        image.spec.width,
        image.spec.height,
        canvas.width,
        canvas.height
      );
      redraw();
    }

    const point = toImagePoint(event);
    if (!point || !image) {
      deps.onReadout(null);
      return;
    }
    const pixel = readPixel(image.data, image.spec, point.x, point.y, standard, image.alignment);
    if (!pixel) {
      deps.onReadout(null);
      return;
    }
    deps.onReadout(
      `(${point.x}, ${point.y})  Y ${pixel.y}  U ${pixel.u}  V ${pixel.v}  R ${pixel.r}  G ${pixel.g}  B ${pixel.b}`
    );
  });

  const endDrag = (event: PointerEvent) => {
    dragging = null;
    canvas.classList.remove("dragging");
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", () => deps.onReadout(null));

  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    renderer = null;
    deps.onContextError("WebGL 上下文丢失，正在尝试恢复");
  });

  canvas.addEventListener("webglcontextrestored", () => {
    renderer = null;
    if (image && uploadCurrent()) {
      redraw();
      deps.onContextError("");
    }
  });

  const observer = new ResizeObserver(() => resize());
  observer.observe(canvas);

  return {
    element,
    canvas,
    show(next) {
      image = next;
      if (!uploadCurrent()) {
        return;
      }
      pendingFit = true;
      if (canvas.width > 1 && canvas.height > 1) {
        view = fitView(next.spec.width, next.spec.height, canvas.width, canvas.height);
        pendingFit = false;
        deps.onScale(view.scale);
      }
      redraw();
    },
    updateSpec(spec, alignment) {
      if (!image) {
        return false;
      }
      image = { ...image, spec, alignment };
      if (!uploadCurrent()) {
        return false;
      }
      view = clampView(view, spec.width, spec.height, canvas.width, canvas.height);
      redraw();
      return true;
    },
    clear() {
      image = null;
      pendingFit = false;
      renderer?.disposeTextures();
      redraw();
      deps.onReadout(null);
    },
    setStandard(next) {
      standard = next;
      renderer?.setStandard(next);
      redraw();
    },
    fit,
    oneToOne() {
      if (!image) {
        return;
      }
      view = clampView(
        {
          scale: 1,
          x: (canvas.width - image.spec.width) / 2,
          y: (canvas.height - image.spec.height) / 2,
        },
        image.spec.width,
        image.spec.height,
        canvas.width,
        canvas.height
      );
      deps.onScale(view.scale);
      redraw();
    },
    zoom(factor) {
      if (!image) {
        return;
      }
      view = zoomAt(
        view,
        factor,
        canvas.width / 2,
        canvas.height / 2,
        image.spec.width,
        image.spec.height,
        canvas.width,
        canvas.height
      );
      deps.onScale(view.scale);
      redraw();
    },
    redraw,
    currentImage: () => image,
    destroy() {
      observer.disconnect();
      renderer?.dispose();
      renderer = null;
    },
  };
}
