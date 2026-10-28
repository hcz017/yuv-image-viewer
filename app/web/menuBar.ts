export interface MenuBarDeps {
  openFiles: () => void;
  openFolder: () => void;
  openRecent: (path: string) => void;
  backToList: () => void;
  showAbout: () => void;
}

export interface MenuBarApi {
  setRecent(dirs: readonly string[]): void;
}

export function createMenuBar(container: HTMLElement, deps: MenuBarDeps): MenuBarApi {
  container.textContent = "";

  const brand = document.createElement("div");
  brand.className = "brand";
  brand.textContent = "YUV Image Viewer";

  const menus = document.createElement("div");
  menus.className = "menus";

  let recentDirs: readonly string[] = [];
  let openPanel: HTMLElement | null = null;
  let openAnchor: HTMLElement | null = null;

  const closeMenus = () => {
    openPanel?.remove();
    openPanel = null;
    openAnchor = null;
  };

  const item = (label: string, onClick: () => void, shortcut?: string) => {
    const button = document.createElement("button");
    button.className = "dropdown-item";
    const text = document.createElement("span");
    text.textContent = label;
    button.append(text);
    if (shortcut) {
      const hint = document.createElement("span");
      hint.className = "shortcut";
      hint.textContent = shortcut;
      button.append(hint);
    }
    button.onclick = (event) => {
      event.stopPropagation();
      closeMenus();
      onClick();
    };
    return button;
  };

  const dropdown = (anchor: HTMLElement, entries: Array<HTMLElement | "separator">) => {
    if (openAnchor === anchor) {
      closeMenus();
      return;
    }
    closeMenus();

    const panel = document.createElement("div");
    panel.className = "dropdown";
    for (const entry of entries) {
      if (entry === "separator") {
        const line = document.createElement("div");
        line.className = "dropdown-separator";
        panel.append(line);
      } else {
        panel.append(entry);
      }
    }
    anchor.append(panel);
    openPanel = panel;
    openAnchor = anchor;
  };

  const modifier = navigator.platform.toLowerCase().includes("mac") ? "⌘" : "Ctrl";

  const fileEntries = (): Array<HTMLElement | "separator"> => {
    const recent = document.createElement("div");
    recent.className = "dropdown-section";
    recent.textContent = "最近目录";

    const entries: Array<HTMLElement | "separator"> = [
      item("打开文件…", deps.openFiles, `${modifier}+O`),
      item("打开文件夹…", deps.openFolder, `${modifier}+Shift+O`),
      "separator",
      recent,
      "separator",
      item("返回文件列表", deps.backToList, "Esc"),
    ];

    recentDirs.forEach((dir) => {
      const entry = item(dir, () => deps.openRecent(dir));
      entry.classList.add("recent-item");
      entry.title = dir;
      recent.append(entry);
    });

    return entries;
  };

  const menu = (label: string, build: () => Array<HTMLElement | "separator">) => {
    const wrapper = document.createElement("div");
    wrapper.className = "menu";
    const button = document.createElement("button");
    button.className = "menu-button";
    button.textContent = label;
    button.onclick = (event) => {
      event.stopPropagation();
      dropdown(wrapper, build());
    };
    wrapper.append(button);
    menus.append(wrapper);
  };

  menu("文件", fileEntries);
  menu("帮助", () => [item("关于 YUV Image Viewer", deps.showAbout)]);

  container.append(brand, menus);

  document.addEventListener("click", (event) => {
    if (!openPanel) {
      return;
    }
    const target = event.target as Node | null;
    if (target && openPanel.contains(target)) {
      return;
    }
    if (target instanceof Element && target.closest(".menu-button")) {
      return;
    }
    closeMenus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenus();
    }
  });

  window.addEventListener("blur", () => closeMenus());

  return {
    setRecent(dirs) {
      recentDirs = dirs;
    },
  };
}
