export interface MenuBarDeps {
  openFiles: () => void;
  openFolder: () => void;
  openRecent: (path: string) => void;
  backToList: () => void;
  showAbout: () => void;
  setColorStandard: (value: "bt601" | "bt709") => void;
}

export interface MenuBarApi {
  setRecent(dirs: readonly string[]): void;
  setColorStandard(value: string): void;
}

export function createMenuBar(container: HTMLElement, deps: MenuBarDeps): MenuBarApi {
  container.textContent = "";

  const brand = document.createElement("div");
  brand.className = "brand";
  brand.textContent = "YUV Image Viewer";

  const menus = document.createElement("div");
  menus.className = "menus";

  let recentDirs: readonly string[] = [];
  let openDropdown: HTMLElement | null = null;

  const closeMenus = () => {
    openDropdown?.remove();
    openDropdown = null;
  };

  const dropdown = (anchor: HTMLElement, entries: Array<HTMLElement | "separator">) => {
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
    openDropdown = panel;
    setTimeout(() => {
      const dismiss = (event: MouseEvent) => {
        if (!panel.contains(event.target as Node)) {
          closeMenus();
          document.removeEventListener("click", dismiss);
        }
      };
      document.addEventListener("click", dismiss);
    }, 0);
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
    button.onclick = () => {
      closeMenus();
      onClick();
    };
    return button;
  };

  const fileButton = document.createElement("button");
  fileButton.className = "menu-button";
  fileButton.textContent = "文件";
  const modifier = navigator.platform.toLowerCase().includes("mac") ? "⌘" : "Ctrl";

  fileButton.onclick = (event) => {
    event.stopPropagation();
    const recent = document.createElement("div");
    recent.className = "dropdown-section";
    recent.textContent = "最近目录";
    dropdown(fileButton, [
      item("打开文件…", deps.openFiles, `${modifier}+O`),
      item("打开文件夹…", deps.openFolder, `${modifier}+Shift+O`),
      "separator",
      recent,
      "separator",
      item("返回文件列表", deps.backToList, "Esc"),
    ]);
    recentDirs.forEach((dir) => {
      const entry = item(dir, () => deps.openRecent(dir));
      entry.classList.add("recent-item");
      entry.title = dir;
      recent.append(entry);
    });
  };

  const helpButton = document.createElement("button");
  helpButton.className = "menu-button";
  helpButton.textContent = "帮助";
  helpButton.onclick = (event) => {
    event.stopPropagation();
    dropdown(helpButton, [item("关于 YUV Image Viewer", deps.showAbout)]);
  };

  menus.append(fileButton, helpButton);

  const spacer = document.createElement("div");
  spacer.className = "menubar-spacer";

  const standardLabel = document.createElement("label");
  standardLabel.className = "standard-picker";
  const standardText = document.createElement("span");
  standardText.textContent = "色彩标准";
  const select = document.createElement("select");
  for (const [value, label] of [
    ["bt601", "BT.601"],
    ["bt709", "BT.709"],
  ] as const) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
  select.onchange = () => deps.setColorStandard(select.value === "bt709" ? "bt709" : "bt601");
  standardLabel.append(standardText, select);

  container.append(brand, menus, spacer, standardLabel);
  container.addEventListener("click", (event) => {
    if (event.target === container) {
      closeMenus();
    }
  });

  return {
    setRecent(dirs) {
      recentDirs = dirs;
    },
    setColorStandard(value) {
      select.value = value === "bt709" ? "bt709" : "bt601";
    },
  };
}
