export interface ContextMenuEntry {
  label: string;
  onClick: () => void;
}

export function showContextMenu(x: number, y: number, entries: readonly ContextMenuEntry[]): void {
  document.querySelector(".context-menu")?.remove();

  const menu = document.createElement("div");
  menu.className = "context-menu";
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  const dismiss = () => {
    menu.remove();
    document.removeEventListener("click", dismiss);
    document.removeEventListener("keydown", onKey);
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      dismiss();
    }
  };

  for (const entry of entries) {
    const button = document.createElement("button");
    button.textContent = entry.label;
    button.onclick = () => {
      dismiss();
      entry.onClick();
    };
    menu.append(button);
  }

  menu.addEventListener("click", (event) => event.stopPropagation());
  document.body.append(menu);
  setTimeout(() => document.addEventListener("click", dismiss), 0);
  document.addEventListener("keydown", onKey);
}
