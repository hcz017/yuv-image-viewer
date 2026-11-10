import { exportFileName, type ExportFormat } from "../../common/exportName";

export interface ExportPaneOption {
  id: "a" | "b";
  name: string;
  width: number;
  height: number;
}

export interface ExportChoice {
  pane: "a" | "b";
  format: ExportFormat;
  quality: number;
}

export interface BatchChoice {
  format: ExportFormat;
  quality: number;
}

export interface ExportModal {
  choose(panes: readonly ExportPaneOption[]): Promise<ExportChoice | null>;
  chooseBatch(fileCount: number): Promise<BatchChoice | null>;
}

const QUALITY_PRESETS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "0.95", label: "高（95%）" },
  { value: "0.85", label: "标准（85%）" },
  { value: "0.7", label: "紧凑（70%）" },
];

const FORMAT_OPTIONS: ReadonlyArray<{ value: ExportFormat; label: string }> = [
  { value: "jpg", label: "JPG（有损压缩）" },
  { value: "png", label: "PNG（无损）" },
];

interface FormatForm {
  formatRow: HTMLElement;
  qualityRow: HTMLElement;
  format(): ExportFormat;
  quality(): number;
}

function createFormatForm(onChange: () => void): FormatForm {
  const formatRow = document.createElement("label");
  formatRow.className = "field";
  const formatLabel = document.createElement("span");
  formatLabel.textContent = "格式";
  const formatSelect = document.createElement("select");
  for (const option of FORMAT_OPTIONS) {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    formatSelect.append(element);
  }
  formatSelect.value = "jpg";
  formatRow.append(formatLabel, formatSelect);

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

  const sync = () => {
    qualityRow.style.display = formatSelect.value === "png" ? "none" : "";
    onChange();
  };
  formatSelect.onchange = sync;

  return {
    formatRow,
    qualityRow,
    format: () => formatSelect.value as ExportFormat,
    quality: () => Number(qualitySelect.value),
  };
}

function createBackdrop(container: HTMLElement, titleText: string, confirmText: string) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  const modal = document.createElement("div");
  modal.className = "modal";
  const title = document.createElement("h2");
  title.textContent = titleText;
  const body = document.createElement("div");
  const actions = document.createElement("div");
  actions.className = "modal-actions";
  const cancel = document.createElement("button");
  cancel.textContent = "取消";
  const confirm = document.createElement("button");
  confirm.className = "primary";
  confirm.textContent = confirmText;
  actions.append(cancel, confirm);
  modal.append(title, body, actions);
  backdrop.append(modal);
  container.append(backdrop);
  return { backdrop, body, cancel, confirm };
}

export function createExportModal(container: HTMLElement): ExportModal {
  return {
    choose(panes) {
      return new Promise<ExportChoice | null>((resolve) => {
        const { backdrop, body, cancel, confirm } = createBackdrop(
          container,
          "导出图像",
          "导出"
        );

        let paneId: "a" | "b" = panes[0].id;
        const hint = document.createElement("p");
        hint.className = "muted";

        const updateHint = () => {
          const pane = panes.find((entry) => entry.id === paneId) ?? panes[0];
          const format = form.format();
          const description = format === "png" ? "PNG 无损" : "JPEG 有损压缩";
          hint.textContent = `${pane.width} × ${pane.height} 像素 · 保存为 ${exportFileName(
            pane.name,
            format
          )}（${description}）`;
        };

        const form = createFormatForm(updateHint);

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

        body.append(form.formatRow, form.qualityRow, hint);
        updateHint();

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
          close({ pane: paneId, format: form.format(), quality: form.quality() });
        backdrop.onclick = (event) => {
          if (event.target === backdrop) {
            close(null);
          }
        };
      });
    },

    chooseBatch(fileCount) {
      return new Promise<BatchChoice | null>((resolve) => {
        const { backdrop, body, cancel, confirm } = createBackdrop(
          container,
          "批量格式转换",
          "开始转换"
        );

        const info = document.createElement("p");
        info.textContent = `共 ${fileCount} 个文件，结果保存到各自所在目录，同名文件将被跳过。`;

        const hint = document.createElement("p");
        hint.className = "muted";
        const updateHint = () => {
          hint.textContent =
            form.format() === "png" ? "PNG 无损，不保留压缩质量参数" : "JPEG 有损压缩";
        };

        const form = createFormatForm(updateHint);
        body.append(info, form.formatRow, form.qualityRow, hint);
        updateHint();

        const close = (value: BatchChoice | null) => {
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
        confirm.onclick = () => close({ format: form.format(), quality: form.quality() });
        backdrop.onclick = (event) => {
          if (event.target === backdrop) {
            close(null);
          }
        };
      });
    },
  };
}
