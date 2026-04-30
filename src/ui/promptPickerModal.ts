import { App, SuggestModal, TFile, normalizePath } from "obsidian";
import { AiAssistantSettings } from "../settings";

interface PromptItem {
  file: TFile | null;
  label: string;
}

export class PromptPickerModal extends SuggestModal<PromptItem> {
  private resolve!: (value: TFile | null | "cancelled") => void;
  private promise: Promise<TFile | null | "cancelled">;
  private chosen = false;

  constructor(app: App, private settings: AiAssistantSettings) {
    super(app);
    this.promise = new Promise(res => { this.resolve = res; });
  }

  openAndAwait(): Promise<TFile | null | "cancelled"> {
    this.open();
    return this.promise;
  }

  getSuggestions(query: string): PromptItem[] {
    const items: PromptItem[] = [{ file: null, label: "None" }];

    const folderPath = normalizePath(this.settings.llmPromptsFolder || "").toLowerCase();
    if (folderPath && folderPath !== "/") {
      const files = this.app.vault.getFiles()
        .filter(f => {
          const parentPath = normalizePath(f.parent?.path ?? "").toLowerCase();
          return parentPath === folderPath && f.extension === "md";
        })
        .sort((a, b) => a.basename.toLowerCase().localeCompare(b.basename.toLowerCase()));

      for (const file of files) {
        items.push({ file, label: file.basename });
      }
    }

    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter(item => item.label.toLowerCase().includes(q));
  }

  renderSuggestion(item: PromptItem, el: HTMLElement): void {
    el.createEl("div", { text: item.label });
  }

  // Override Obsidian's orchestration. The default selectSuggestion triggers
  // close() (→ onClose) and onChooseSuggestion in an order we can't rely on,
  // which caused onClose to resolve "cancelled" before the chosen file surfaced.
  // We flip `chosen` and resolve synchronously *before* close() runs.
  selectSuggestion(item: PromptItem): void {
    this.chosen = true;
    this.resolve(item.file);
    this.close();
  }

  onChooseSuggestion(_item: PromptItem): void {
    // Resolution is handled in selectSuggestion above.
  }

  onClose(): void {
    if (!this.chosen) this.resolve("cancelled");
  }
}
