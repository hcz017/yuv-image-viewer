import { validateFileName } from "../../common/rename";
import { openDialog } from "./modal";

export interface RenameModal {
  prompt(currentName: string): Promise<string | null>;
}

export function createRenameModal(container: HTMLElement): RenameModal {
  return {
    prompt(currentName) {
      const body = document.createElement("div");
      const row = document.createElement("label");
      row.className = "field";
      const caption = document.createElement("span");
      caption.textContent = "文件名";
      const input = document.createElement("input");
      input.type = "text";
      input.value = currentName;
      input.spellcheck = false;
      row.append(caption, input);

      const hint = document.createElement("p");
      hint.textContent = "修改扩展名后，该文件可能不再出现在 YUV 列表中。";
      body.append(row, hint);

      let result: string | null = null;
      return openDialog(container, {
        title: "重命名",
        body,
        onMount: () => {
          input.focus();
          const dot = currentName.lastIndexOf(".");
          input.setSelectionRange(0, dot > 0 ? dot : currentName.length);
        },
        onSubmit: (error) => {
          const invalid = validateFileName(input.value);
          if (invalid) {
            error.textContent = invalid;
            return false;
          }
          result = input.value.trim();
          return true;
        },
      }).then((accepted) => (accepted ? result : null));
    },
  };
}
