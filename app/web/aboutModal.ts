export interface AboutModalDeps {
  version: string;
  platform: string;
  configLocation: string;
}

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

      modal.append(title, version, platform, config, note, actions);
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
