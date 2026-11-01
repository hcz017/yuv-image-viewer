import { jpegFileName } from "./exportImage";

export interface ExportPaneOption {
  id: "a" | "b";
  name: string;
  width: number;
  height: number;
}

export interface ExportChoice {
  pane: "a" | "b";
  quality: number;
}

export interface ExportModal {
  choose(panes: readonly ExportPaneOption[]): Promise<ExportChoice | null>;
}

const QUALITY_PRESETS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "0.95", label: "高（95%）" },
  { value: "0.85", label: "标准（85%）" },
  { value: "0.7", label: "紧凑（70%）" },
];

export function createExportModal(container: HTMLElement): ExportModal {
  return {
    choose(panes) {
      return new Promise<ExportChoice | null>((resolve) => {
        const backdrop = document.createElement("div");
        backdrop.className = "modal-backdrop";

        const modal = document.createElement("div");
        modal.className = "modal";

        const title = document.createElement("h2");
        title.textContent = "导出为 JPG";

        let paneId: "a" | "b" = panes[0].id;
        const hint = document.createElement("p");
        hint.className = "muted";

        const updateHint = () => {
          const pane = panes.find((entry) => entry.id === paneId) ?? panes[0];
          hint.textContent = `${pane.width} × ${pane.height} 像素 · 保存为 ${jpegFileName(
            pane.name
          )}（JPEG 有损压缩）`;
        };

        const body = document.createElement("div");
        if (panes.length > 1) {
          const imageRow = document.createElement("label");
          imageRow.className = "field";
          const imageLabel = document.createElement("span");
          imageLabel.textContent = "图像";
          const imageSelect = document.createElement("select");
          for (const pane of panes) {
            const option = document.createElement("option");
            option.value = pane.id;
            option.textContent = `${pane.id.toUpperCase()} · ${pane.name}`;
            imageSelect.append(option);
          }
          imageSelect.value = paneId;
          imageSelect.onchange = () => {
            paneId = imageSelect.value as "a" | "b";
            updateHint();
          };
          imageRow.append(imageLabel, imageSelect);
          body.append(imageRow);
        } else {
          const imageInfo = document.createElement("p");
          imageInfo.textContent = `图像：${panes[0].name}`;
          body.append(imageInfo);
        }

        const qualityRow = document.createElement("label");
        qualityRow.className = "field";
        const qualityLabel = document.createElement("span");
        qualityLabel.textContent = "质量";
        const qualitySelect = document.createElement("select");
        for (const preset of QUALITY_PRESETS) {
          const option = document.createElement("option");
          option.value = preset.value;
          option.textContent = preset.label;
          qualitySelect.append(option);
        }
        qualitySelect.value = QUALITY_PRESETS[1].value;
        qualityRow.append(qualityLabel, qualitySelect);
        body.append(qualityRow, hint);
        updateHint();

        const actions = document.createElement("div");
        actions.className = "modal-actions";
        const cancel = document.createElement("button");
        cancel.textContent = "取消";
        const confirm = document.createElement("button");
        confirm.className = "primary";
        confirm.textContent = "导出";
        actions.append(cancel, confirm);

        modal.append(title, body, actions);
        backdrop.append(modal);
        container.append(backdrop);

        const close = (value: ExportChoice | null) => {
          document.removeEventListener("keydown", onKeydown);
          backdrop.remove();
          resolve(value);
        };
        const onKeydown = (event: KeyboardEvent) => {
          if (event.key === "Escape") {
            event.preventDefault();
            close(null);
          }
        };

        document.addEventListener("keydown", onKeydown);
        cancel.onclick = () => close(null);
        confirm.onclick = () =>
          close({ pane: paneId, quality: Number(qualitySelect.value) });
        backdrop.onclick = (event) => {
          if (event.target === backdrop) {
            close(null);
          }
        };
      });
    },
  };
}
