import { makeSpec, validateSpec } from "../../common/spec";
import type { Spec, YuvFormat } from "../../common/types";

const FORMATS: YuvFormat[] = ["nv12", "nv21", "i420", "yv12", "p010"];

export interface SpecModal {
  openManual(options: {
    name: string;
    fileSize: number;
    maxTextureSize: number;
    format: YuvFormat;
    width: number;
    height: number;
    stride: number;
    scanline: number;
    reason: string;
  }): Promise<Spec | null>;
  chooseFormat(name: string): Promise<YuvFormat | null>;
  chooseAlignment(name: string): Promise<"high" | "low" | null>;
}

function field(label: string, value: number, step = 2): { row: HTMLElement; input: HTMLInputElement } {
  const row = document.createElement("label");
  row.className = "field";
  const span = document.createElement("span");
  span.textContent = label;
  const input = document.createElement("input");
  input.type = "number";
  input.min = String(step);
  input.step = String(step);
  input.value = String(value);
  row.append(span, input);
  return { row, input };
}

export function createSpecModal(container: HTMLElement): SpecModal {
  const openDialog = (title: string, body: HTMLElement, onSubmit: () => boolean) =>
    new Promise<boolean>((resolve) => {
      const backdrop = document.createElement("div");
      backdrop.className = "modal-backdrop";
      const modal = document.createElement("div");
      modal.className = "modal";
      const heading = document.createElement("h2");
      heading.textContent = title;
      const error = document.createElement("p");
      error.className = "modal-error";

      const actions = document.createElement("div");
      actions.className = "modal-actions";
      const cancel = document.createElement("button");
      cancel.textContent = "取消";
      const ok = document.createElement("button");
      ok.className = "primary";
      ok.textContent = "确定";
      actions.append(cancel, ok);

      modal.append(heading, body, error, actions);
      backdrop.append(modal);
      container.append(backdrop);

      const close = (value: boolean) => {
        backdrop.remove();
        resolve(value);
      };
      cancel.onclick = () => close(false);
      ok.onclick = () => {
        if (onSubmit()) {
          close(true);
        }
      };
      backdrop.onclick = (event) => {
        if (event.target === backdrop) {
          close(false);
        }
      };
      document.addEventListener(
        "keydown",
        (event) => {
          if (event.key === "Escape") {
            close(false);
          }
        },
        { once: true }
      );
    });

  return {
    async openManual(options) {
      const body = document.createElement("div");
      const formatRow = document.createElement("label");
      formatRow.className = "field";
      const formatLabel = document.createElement("span");
      formatLabel.textContent = "格式";
      const formatSelect = document.createElement("select");
      for (const format of FORMATS) {
        const option = document.createElement("option");
        option.value = format;
        option.textContent = format.toUpperCase();
        formatSelect.append(option);
      }
      formatSelect.value = options.format;
      formatRow.append(formatLabel, formatSelect);

      const width = field("宽度", options.width);
      const height = field("高度", options.height);
      const stride = field("stride", options.stride);
      const scanline = field("scanline", options.scanline);
      body.append(formatRow, width.row, height.row, stride.row, scanline.row);

      let result: Spec | null = null;
      const valid = await openDialog("手动设置规格", body, () => {
        const spec = makeSpec(
          Number(width.input.value),
          Number(height.input.value),
          Number(stride.input.value),
          Number(scanline.input.value),
          formatSelect.value as YuvFormat
        );
        const check = validateSpec(spec, options.fileSize, options.maxTextureSize);
        if (check.kind === "invalid") {
          const error = body.parentElement?.querySelector(".modal-error");
          if (error) {
            error.textContent = check.reason ?? "规格不合法";
          }
          return false;
        }
        result = spec;
        return true;
      });
      return valid ? result : null;
    },

    chooseFormat(name) {
      const body = document.createElement("div");
      const hint = document.createElement("p");
      hint.textContent = `无法从文件名判断 ${name} 的像素格式，请选择：`;
      const list = document.createElement("div");
      list.className = "format-list";
      let chosen: YuvFormat | null = null;

      for (const format of FORMATS) {
        const button = document.createElement("button");
        button.textContent = format.toUpperCase();
        button.onclick = () => {
          chosen = format;
          button.closest(".modal")?.querySelector<HTMLButtonElement>(".primary")?.click();
        };
        list.append(button);
      }
      body.append(hint, list);

      return openDialog("选择像素格式", body, () => chosen !== null).then(() => chosen);
    },

    chooseAlignment(name) {
      const body = document.createElement("div");
      const hint = document.createElement("p");
      hint.textContent = `无法判断 ${name} 的 P010 数据对齐方式，请选择：`;
      const list = document.createElement("div");
      list.className = "format-list";
      let chosen: "high" | "low" | null = null;

      for (const [value, label] of [
        ["high", "高位对齐（常见）"],
        ["low", "低位对齐"],
      ] as const) {
        const button = document.createElement("button");
        button.textContent = label;
        button.onclick = () => {
          chosen = value;
          button.closest(".modal")?.querySelector<HTMLButtonElement>(".primary")?.click();
        };
        list.append(button);
      }
      body.append(hint, list);

      return openDialog("选择 P010 对齐方式", body, () => chosen !== null).then(() => chosen);
    },
  };
}
