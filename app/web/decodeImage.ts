export interface DecodedImage {
  width: number;
  height: number;
  rgba: Uint8Array;
}

/** 用浏览器解码 JPEG/PNG，输出 RGBA 原始像素。 */
export async function decodeImageBytes(
  data: Uint8Array,
  format: "jpg" | "png"
): Promise<DecodedImage> {
  const type = format === "png" ? "image/png" : "image/jpeg";
  const buffer = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([buffer], { type });
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    throw new Error("无法解码图片，文件可能已损坏");
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      throw new Error("无法创建画布");
    }
    context.drawImage(bitmap, 0, 0);
    const imageData = context.getImageData(0, 0, bitmap.width, bitmap.height);
    return {
      width: bitmap.width,
      height: bitmap.height,
      rgba: new Uint8Array(imageData.data),
    };
  } finally {
    bitmap.close();
  }
}
