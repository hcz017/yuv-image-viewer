export interface DelayedNotice {
  show(message: string): void;
  hide(): void;
  destroy(): void;
}

export function createDelayedNotice(element: HTMLElement, delay = 500): DelayedNotice {
  let timer: number | null = null;

  const hide = () => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
    element.classList.add("hidden");
  };

  return {
    show(message: string) {
      hide();
      timer = window.setTimeout(() => {
        element.textContent = message;
        element.classList.remove("hidden");
        timer = null;
      }, delay);
    },
    hide,
    destroy: hide,
  };
}
