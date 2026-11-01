export interface DialogOptions {
  title: string;
  body: HTMLElement;
  onSubmit: (error: HTMLParagraphElement) => boolean;
  onMount?: () => void;
}

export function openDialog(container: HTMLElement, options: DialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    const modal = document.createElement("div");
    modal.className = "modal";
    const heading = document.createElement("h2");
    heading.textContent = options.title;
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

    modal.append(heading, options.body, error, actions);
    backdrop.append(modal);
    container.append(backdrop);

    const close = (value: boolean) => {
      document.removeEventListener("keydown", onKeydown);
      backdrop.remove();
      resolve(value);
    };
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(false);
      }
    };
    document.addEventListener("keydown", onKeydown);
    modal.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
        event.preventDefault();
        ok.click();
      }
    });
    cancel.onclick = () => close(false);
    ok.onclick = () => {
      if (options.onSubmit(error)) {
        close(true);
      }
    };
    backdrop.onclick = (event) => {
      if (event.target === backdrop) {
        close(false);
      }
    };
    options.onMount?.();
  });
}
