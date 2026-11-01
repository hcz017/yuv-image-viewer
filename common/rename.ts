const INVALID_CHARS = /[/\\:*?"<>|\u0000-\u001f]/;

export function validateFileName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return "文件名不能为空";
  }
  if (trimmed === "." || trimmed === "..") {
    return "文件名不合法";
  }
  if (INVALID_CHARS.test(trimmed)) {
    return '文件名不能包含 / \\ : * ? " < > | 等字符';
  }
  return null;
}
