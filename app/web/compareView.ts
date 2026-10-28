import { readPixel } from "../../common/sample";
import type { ColorStandard } from "../../common/types";
import { Renderer, type ScissorRect } from "../../webview/renderer";
import { splitStage } from "../../webview/panes";
import { clampView, clipRect, fitView, panView, viewRect, zoomAt, type View } from "../../webview/viewport";
import type { ImagePayload } from "./singleView";

export type ComparePane = ImagePayload;

export interface CompareViewDeps {
  onReadout: (text: string | null) => void;
  onContextError: (message: string) => void;
}

export interface CompareViewApi {
  readonly element: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  setImages(a: ComparePane | null, b: ComparePane | null): void;
  setStandard(standard: ColorStandard): void;
  setSync(enabled: boolean): void;
  fit(): void;
  oneToOne(): void;
  zoom(factor: number): void;
  swap(): void;
  redraw(): void;
  current(): { a: ComparePane | null; b: ComparePane | null };
  destroy(): void;
}

export function createCompareView(deps: CompareViewDeps): CompareViewApi {
  const element = document.createElement("div");
  element.className = "view view-compare";

  const canvas = document.createElement("canvas");
  canvas.className = "gl-canvas";
  element.append(canvas);

  let rendererA: Renderer | null = null;
  let rendererB: Renderer | null = null;
  let imageA: ComparePane | null = null;
  let imageB: ComparePane | null = null;
  let viewA: View = { scale: 1, x: 0, y: 0 };
  let viewB: View = { scale: 1, x: 0, y: 0 };
  let standard: ColorStandard = "bt601";
  let dragging: { pane: "a" | "b"; x: number; y: number } | null = null;
  let pendingFit = false;
  let syncView = true;

  const dpr = () => window.devicePixelRatio || 1;
  const syncEnabled = () => syncView;

  function createRenderer(existing: Renderer | null): Renderer | null {
    if (existing) {
      return existing;
    }
    try {
      const created = new Renderer(canvas);
      created.setStandard(standard);
      return created;
    } catch (error) {
      deps.onContextError(String(error));
      return null;
    }
  }

  function layout() {
    return splitStage(canvas.width, canvas.height, Math.round(8 * dpr()));
  }

  function resize() {
    const scale = dpr();
    const width = Math.max(1, Math.round(canvas.clientWidth * scale));
    const height = Math.max(1, Math.round(canvas.clientHeight * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const panes = layout();
    if (pendingFit && canvas.width > 1 && canvas.height > 1 && (imageA || imageB)) {
      pendingFit = false;
      fit();
      return;
    }
    if (imageA) {
      viewA = clampView(viewA, imageA.spec.width, imageA.spec.height, panes.a.width, panes.a.height);
    }
    if (imageB) {
      viewB = clampView(viewB, imageB.spec.width, imageB.spec.height, panes.b.width, panes.b.height);
    }
    redraw();
  }

  function uploadPane(which: "a" | "b"): Renderer | null {
    const image = which === "a" ? imageA : imageB;
    let renderer = which === "a" ? rendererA : rendererB;
    if (!image) {
      return renderer;
    }
    renderer = createRenderer(renderer);
    if (!renderer) {
      return null;
    }
    renderer.setStandard(standard);
    if (!renderer.upload(image.spec, image.data, image.alignment)) {
      deps.onContextError("显存不足或图像超出 GPU 纹理上限");
      return null;
    }
    if (which === "a") {
      rendererA = renderer;
    } else {
      rendererB = renderer;
    }
    return renderer;
  }

  function redraw() {
    const panes = layout();
    drawPane("a", panes.a);
    drawPane("b", panes.b);
  }

  function drawPane(which: "a" | "b", pane: ScissorRect) {
    const image = which === "a" ? imageA : imageB;
    const view = which === "a" ? viewA : viewB;
    const renderer = which === "a" ? rendererA : rendererB;
    if (!renderer) {
      return;
    }
    if (!image) {
      renderer.clear(pane);
      return;
    }
    const local = viewRect(view, image.spec.width, image.spec.height);
    const rect = clipRect(
      { x: pane.x + local.x, y: pane.y + local.y, w: local.w, h: local.h },
      canvas.width,
      canvas.height
    );
    renderer.draw(rect, pane);
  }

  function fit() {
    const panes = layout();
    if (imageA) {
      viewA = fitView(imageA.spec.width, imageA.spec.height, panes.a.width, panes.a.height);
    }
    if (imageB) {
      viewB = fitView(imageB.spec.width, imageB.spec.height, panes.b.width, panes.b.height);
    }
    redraw();
  }

  function oneToOne() {
    const panes = layout();
    if (imageA) {
      viewA = clampView(
        {
          scale: 1,
          x: (panes.a.width - imageA.spec.width) / 2,
          y: (panes.a.height - imageA.spec.height) / 2,
        },
        imageA.spec.width,
        imageA.spec.height,
        panes.a.width,
        panes.a.height
      );
    }
    if (imageB) {
      viewB = clampView(
        {
          scale: 1,
          x: (panes.b.width - imageB.spec.width) / 2,
          y: (panes.b.height - imageB.spec.height) / 2,
        },
        imageB.spec.width,
        imageB.spec.height,
        panes.b.width,
        panes.b.height
      );
    }
    redraw();
  }

  function syncFrom(source: "a" | "b") {
    if (!syncEnabled()) {
      return;
    }
    const sourceView = source === "a" ? viewA : viewB;
    const sourceImage = source === "a" ? imageA : imageB;
    const targetImage = source === "a" ? imageB : imageA;
    const panes = layout();
    const sourcePane = source === "a" ? panes.a : panes.b;
    const targetPane = source === "a" ? panes.b : panes.a;
    if (!sourceImage || !targetImage) {
      return;
    }

    const centerX = (sourcePane.width / 2 - sourceView.x) / sourceView.scale;
    const centerY = (sourcePane.height / 2 - sourceView.y) / sourceView.scale;
    const next: View = {
      scale: sourceView.scale,
      x: targetPane.width / 2 - centerX * sourceView.scale,
      y: targetPane.height / 2 - centerY * sourceView.scale,
    };
    const clamped = clampView(
      next,
      targetImage.spec.width,
      targetImage.spec.height,
      targetPane.width,
      targetPane.height
    );
    if (source === "a") {
      viewB = clamped;
    } else {
      viewA = clamped;
    }
  }

  function paneAt(event: MouseEvent): { which: "a" | "b"; pane: ScissorRect; localX: number; localY: number } | null {
    const rect = canvas.getBoundingClientRect();
    const scale = dpr();
    const x = (event.clientX - rect.left) * scale;
    const y = (event.clientY - rect.top) * scale;
    const panes = layout();
    if (x < panes.a.width) {
      return { which: "a", pane: panes.a, localX: x, localY: y };
    }
    if (x >= panes.b.x) {
      return { which: "b", pane: panes.b, localX: x - panes.b.x, localY: y };
    }
    return null;
  }

  function readoutAt(which: "a" | "b", localX: number, localY: number) {
    const view = which === "a" ? viewA : viewB;
    const image = which === "a" ? imageA : imageB;
    if (!image) {
      deps.onReadout(null);
      return;
    }
    const x = Math.floor((localX - view.x) / view.scale);
    const y = Math.floor((localY - view.y) / view.scale);
    if (x < 0 || y < 0 || x >= image.spec.width || y >= image.spec.height) {
      deps.onReadout(null);
      return;
    }
    const pixel = readPixel(image.data, image.spec, x, y, standard, image.alignment);
    if (!pixel) {
      deps.onReadout(null);
      return;
    }
    const label = which === "a" ? "A" : "B";
    let text = `${label} (${x}, ${y}) | Y ${pixel.y} U ${pixel.u} V ${pixel.v} | R ${pixel.r} G ${pixel.g} B ${pixel.b}`;
    if (imageA && imageB) {
      const a = readPixel(imageA.data, imageA.spec, x, y, standard, imageA.alignment);
      const b = readPixel(imageB.data, imageB.spec, x, y, standard, imageB.alignment);
      if (a && b) {
        text += ` | Δ(B-A) R ${b.r - a.r} G ${b.g - a.g} B ${b.b - a.b}`;
      }
    }
    deps.onReadout(text);
  }

  canvas.addEventListener(
    "wheel",
    (event) => {
      const hit = paneAt(event);
      if (!hit) {
        return;
      }
      const image = hit.which === "a" ? imageA : imageB;
      if (!image) {
        return;
      }
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.0015);
      const next = zoomAt(
        hit.which === "a" ? viewA : viewB,
        factor,
        hit.localX,
        hit.localY,
        image.spec.width,
        image.spec.height,
        hit.pane.width,
        hit.pane.height
      );
      if (hit.which === "a") {
        viewA = next;
      } else {
        viewB = next;
      }
      syncFrom(hit.which);
      redraw();
    },
    { passive: false }
  );

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }
    const hit = paneAt(event);
    if (!hit) {
      return;
    }
    canvas.setPointerCapture(event.pointerId);
    dragging = { pane: hit.which, x: event.clientX, y: event.clientY };
    canvas.classList.add("dragging");
  });

  canvas.addEventListener("pointermove", (event) => {
    const hit = paneAt(event);
    if (!hit) {
      deps.onReadout(null);
      return;
    }

    if (dragging) {
      const image = dragging.pane === "a" ? imageA : imageB;
      const panes = layout();
      const pane = dragging.pane === "a" ? panes.a : panes.b;
      if (image) {
        const scale = dpr();
        const dx = (event.clientX - dragging.x) * scale;
        const dy = (event.clientY - dragging.y) * scale;
        dragging = { pane: dragging.pane, x: event.clientX, y: event.clientY };
        const next = panView(
          dragging.pane === "a" ? viewA : viewB,
          dx,
          dy,
          image.spec.width,
          image.spec.height,
          pane.width,
          pane.height
        );
        if (dragging.pane === "a") {
          viewA = next;
        } else {
          viewB = next;
        }
        syncFrom(dragging.pane);
        redraw();
      }
    }

    readoutAt(hit.which, hit.localX, hit.localY);
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
    rendererA = null;
    rendererB = null;
    deps.onContextError("WebGL 上下文丢失，正在尝试恢复");
  });

  canvas.addEventListener("webglcontextrestored", () => {
    rendererA = null;
    rendererB = null;
    const a = uploadPane("a");
    const b = uploadPane("b");
    if (a || b) {
      redraw();
      deps.onContextError("");
    }
  });

  const observer = new ResizeObserver(() => resize());
  observer.observe(canvas);

  return {
    element,
    canvas,
    setImages(a, b) {
      imageA = a;
      rendererA?.disposeTextures();
      if (a) {
        rendererA = uploadPane("a");
      }
      imageB = b;
      rendererB?.disposeTextures();
      if (b) {
        rendererB = uploadPane("b");
      }
      pendingFit = true;
      if (canvas.width > 1 && canvas.height > 1) {
        pendingFit = false;
        fit();
      } else {
        redraw();
      }
    },
    setStandard(next) {
      standard = next;
      rendererA?.setStandard(next);
      rendererB?.setStandard(next);
      redraw();
    },
    setSync(enabled) {
      syncView = enabled;
    },
    fit,
    oneToOne,
    zoom(factor) {
      const panes = layout();
      if (imageA) {
        viewA = zoomAt(
          viewA,
          factor,
          panes.a.width / 2,
          panes.a.height / 2,
          imageA.spec.width,
          imageA.spec.height,
          panes.a.width,
          panes.a.height
        );
      }
      if (imageB) {
        viewB = zoomAt(
          viewB,
          factor,
          panes.b.width / 2,
          panes.b.height / 2,
          imageB.spec.width,
          imageB.spec.height,
          panes.b.width,
          panes.b.height
        );
      }
      redraw();
    },
    swap() {
      const nextA = imageB;
      const nextB = imageA;
      const nextViewA = viewB;
      const nextViewB = viewA;
      imageA = nextA;
      imageB = nextB;
      viewA = nextViewA;
      viewB = nextViewB;
      rendererA?.disposeTextures();
      rendererB?.disposeTextures();
      uploadPane("a");
      uploadPane("b");
      redraw();
    },
    redraw,
    current: () => ({ a: imageA, b: imageB }),
    destroy() {
      observer.disconnect();
      rendererA?.dispose();
      rendererB?.dispose();
      rendererA = null;
      rendererB = null;
    },
  };
}
