import type { ColorStandard } from "../../common/types";
import { Renderer } from "../../webview/renderer";
import { clipRect } from "../../webview/viewport";
import type { ImagePayload } from "./singleView";

// 回读 RGBA 与 ImageData 会各占一份内存，超过该像素数时不再尝试导出
const MAX_EXPORT_PIXELS = 64 * 1024 * 1024;

export function jpegFileName(name: string): string {
  const base = name.replace(/\.(nv12|nv21|i420|yv12|p010|yuv)$/i, "");
  return `${base || "image"}.jpg`;
}

export function encodeJpegBase64(
  image: ImagePayload,
  standard: ColorStandard,
  quality: number
): string {
  const { width, height } = image.spec;
  if (width * height > MAX_EXPORT_PIXELS) {
    throw new Error(`图像尺寸 ${width}×${height} 过大，无法导出 JPG`);
  }

  const glCanvas = document.createElement("canvas");
  glCanvas.width = width;
  glCanvas.height = height;

  let renderer: Renderer | null = null;
  try {
    renderer = new Renderer(glCanvas);
    renderer.setStandard(standard);
    if (!renderer.upload(image.spec, image.data, image.alignment)) {
      throw new Error("显存不足或图像超出 GPU 纹理上限");
    }
    renderer.draw(
      clipRect({ x: 0, y: 0, w: width, h: height }, width, height),
      { x: 0, y: 0, width, height }
    );

    const pixels = renderer.readPixels();

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("无法创建 2D 画布");
    }
    const imageData = context.createImageData(width, height);
    if (pixels.length !== imageData.data.length) {
      throw new Error("渲染输出尺寸与图像尺寸不一致");
    }

    // WebGL 回读为自底向上，转换为自上而下
    const rowBytes = width * 4;
    for (let y = 0; y < height; y++) {
      const source = (height - 1 - y) * rowBytes;
      imageData.data.set(pixels.subarray(source, source + rowBytes), y * rowBytes);
    }
    context.putImageData(imageData, 0, 0);

    const url = canvas.toDataURL("image/jpeg", quality);
    const comma = url.indexOf(",");
    if (comma < 0) {
      throw new Error("JPEG 编码失败");
    }
    return url.slice(comma + 1);
  } finally {
    renderer?.dispose();
    // 释放临时 WebGL 上下文，避免多次导出后耗尽浏览器的上下文配额
    glCanvas
      .getContext("webgl2")
      ?.getExtension("WEBGL_lose_context")
      ?.loseContext();
  }
}
