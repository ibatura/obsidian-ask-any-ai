/**
 * Lightweight mock of the obsidian module for unit tests.
 * Only the symbols actually used by the plugin source are stubbed here.
 */

export class Notice {
  message: string;
  noticeEl: object = {};
  constructor(message: string | object) {
    this.message = typeof message === "string" ? message : "";
  }
  hide(): void {}
}

export class Plugin {
  app: unknown;
  loadData(): Promise<unknown> { return Promise.resolve({}); }
  saveData(_data: unknown): Promise<void> { return Promise.resolve(); }
  addSettingTab(_tab: unknown): void { /* noop */ }
  addCommand(_cmd: unknown): void { /* noop */ }
}

export class PluginSettingTab {
  app: unknown;
  containerEl = { empty: () => {}, createEl: () => ({}) };
  constructor(_app: unknown, _plugin: unknown) {}
}

export class Setting {
  constructor(_el: unknown) {}
  setName(_n: string) { return this; }
  setDesc(_d: string) { return this; }
  addDropdown(_cb: unknown) { return this; }
  addText(_cb: unknown) { return this; }
  addTextArea(_cb: unknown) { return this; }
  addToggle(_cb: unknown) { return this; }
}

export class TFile {
  path = "";
  extension = "";
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/");
}

export class SuggestModal<T> {
  app: unknown;
  constructor(_app: unknown) {}
  open(): void { /* noop */ }
  close(): void { /* noop */ }
  onClose(): void { /* noop */ }
  getSuggestions(_query: string): T[] { return []; }
  renderSuggestion(_value: T, _el: unknown): void { /* noop */ }
  onChooseSuggestion(_item: T, _evt: unknown): void { /* noop */ }
  selectSuggestion(_value: T, _evt?: unknown): void { /* noop */ }
}

export function requestUrl(_options: unknown): Promise<{ json: unknown }> {
  return Promise.resolve({ json: {} });
}
