export interface AboutModalDeps {
  version: string;
  platform: string;
  configLocation: string;
}

const FEATURES = [
  "支持 NV12 / NV21 / I420 / YV12 / P010，仅解码第一帧。",
  "按文件名（如 1920x1080_align）或文件大小自动推断分辨率，识别失败时可手动指定格式、stride 与 scanline。",
  "大图模式支持滚轮缩放、拖拽平移，状态栏实时显示光标处的 YUV 与 RGB 像素值。",
  "对比模式并排显示同目录下的两张图像，可同步缩放平移，并支持 A/B 交换。",
  "格式与色彩标准（BT.601 / BT.709）可在工具栏中即时切换。",
  "文件列表支持排序、多选，右键可在系统文件管理器中定位文件。",
];

export function createAboutModal(): { show(deps: AboutModalDeps): void } {
  return {
    show(deps) {
      document.querySelector(".about-backdrop")?.remove();

      const backdrop = document.createElement("div");
      backdrop.className = "modal-backdrop about-backdrop";

      const modal = document.createElement("div");
      modal.className = "modal about-modal";

      const title = document.createElement("h2");
      title.textContent = "YUV Image Viewer";

      const version = document.createElement("p");
      version.textContent = `版本 ${deps.version}`;

      const platform = document.createElement("p");
      platform.textContent = `平台 ${deps.platform}`;

      const config = document.createElement("p");
      config.className = "muted";
      config.textContent = `配置位置 ${deps.configLocation || "默认"}`;

      const note = document.createElement("p");
      note.className = "muted";
      note.textContent = "本地 YUV 图像查看器，仅读取第一帧，支持 BT.601 / BT.709 Full range。";

      const section = (heading: string, className: string, entries: Array<[string, string] | string>) => {
        const wrapper = document.createElement("section");
        wrapper.className = "about-section";
        const headingElement = document.createElement("h3");
        headingElement.textContent = heading;
        const list = document.createElement("ul");
        list.className = className;
        for (const entry of entries) {
          const li = document.createElement("li");
          if (typeof entry === "string") {
            li.textContent = entry;
          } else {
            const key = document.createElement("kbd");
            key.textContent = entry[0];
            const desc = document.createElement("span");
            desc.textContent = entry[1];
            li.append(key, desc);
          }
          list.append(li);
        }
        wrapper.append(headingElement, list);
        return wrapper;
      };

      const modifier = navigator.platform.toLowerCase().includes("mac") ? "⌘" : "Ctrl";
      const features = section("功能介绍", "about-list", FEATURES);
      const shortcuts = section("快捷键", "about-keys", [
        [`${modifier}+O`, "打开文件"],
        [`${modifier}+Shift+O`, "打开文件夹"],
        ["← / →", "上一张 / 下一张（大图模式）"],
        ["F", "适合窗口"],
        ["1", "实际大小（1:1）"],
        ["+ / -", "放大 / 缩小"],
        ["Esc", "返回文件列表"],
      ]);

      const closeDialog = () => {
        document.removeEventListener("keydown", onKeydown);
        backdrop.remove();
      };
      const onKeydown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeDialog();
        }
      };

      const actions = document.createElement("div");
      actions.className = "modal-actions";
      const close = document.createElement("button");
      close.className = "primary";
      close.textContent = "关闭";
      close.onclick = closeDialog;
      actions.append(close);

      modal.append(title, version, platform, config, note, features, shortcuts, actions);
      backdrop.append(modal);
      backdrop.onclick = (event) => {
        if (event.target === backdrop) {
          closeDialog();
        }
      };
      document.addEventListener("keydown", onKeydown);
      document.body.append(backdrop);
    },
  };
}
