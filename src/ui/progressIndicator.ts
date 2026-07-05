import { Notice } from "obsidian";

export interface ProgressController {
  updateStatus(text: string, percent: number, isError?: boolean): void;
  complete(): void;
  close(): void;
}

const noop: ProgressController = {
  updateStatus() {},
  complete() {},
  close() {},
};

export function showProgressIndicator(initialMessage: string): ProgressController {
  if (typeof document === "undefined") return noop;

  const notice = new Notice("", 0);
  notice.messageEl.empty();

  const wrapper = notice.messageEl.createDiv({ cls: "ai-progress-wrapper" });
  const statusEl = wrapper.createDiv({ cls: "ai-progress-status" });
  const barContainer = wrapper.createDiv({ cls: "ai-progress-bar-container" });
  const barFill = barContainer.createDiv({ cls: "ai-progress-bar-fill" });
  const elapsedEl = wrapper.createDiv({ cls: "ai-progress-elapsed" });

  statusEl.textContent = initialMessage;
  elapsedEl.textContent = "0.0s elapsed";

  const startTime = Date.now();
  const intervalId = window.setInterval(() => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    elapsedEl.textContent = `${elapsed}s elapsed`;
  }, 200);

  function cleanup(): void {
    window.clearInterval(intervalId);
  }

  return {
    updateStatus(text: string, percent: number, isError = false): void {
      statusEl.textContent = text;
      barFill.style.width = `${percent}%`;
      barFill.style.background = isError ? "var(--color-red)" : "var(--interactive-accent)";
    },
    complete(): void {
      this.updateStatus("Done. Result inserted.", 100);
      cleanup();
      window.setTimeout(() => notice.hide(), 1000);
    },
    close(): void {
      cleanup();
      notice.hide();
    },
  };
}
