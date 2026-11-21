export const APP_TITLE = "YUV Image Viewer";

export function windowTitle(fileName: string | null): string {
  const name = fileName?.trim() ?? "";
  return name ? `${APP_TITLE} - ${name}` : APP_TITLE;
}

/** 只有恰好选中一个文件时才能重命名。 */
export function selectionPath(order: readonly string[]): string | null {
  return order.length === 1 ? order[0] : null;
}

export function deleteConfirmMessage(names: readonly string[]): string | null {
  if (names.length === 0) {
    return null;
  }
  if (names.length === 1) {
    return `确定将「${names[0]}」移到回收站吗？`;
  }
  return `确定将这 ${names.length} 个文件移到回收站吗？`;
}
