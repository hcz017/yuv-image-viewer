export type ExportFormat = "jpg" | "png";

const SUPPORTED_EXTENSION =
  /\.(nv12|nv21|i420|yv12|p010|yuyv|uyvy|gray|grey|yuv|jpg|jpeg|png)$/i;

export function stripExtension(name: string): string {
  return name.replace(SUPPORTED_EXTENSION, "");
}

export function exportFileName(name: string, format: ExportFormat): string {
  return `${stripExtension(name) || "image"}.${format}`;
}

/** 把完整路径的扩展名替换为目标格式，用于批量转换的同目录输出。 */
export function replaceExtension(path: string, format: ExportFormat): string {
  return `${path.replace(SUPPORTED_EXTENSION, "")}.${format}`;
}
