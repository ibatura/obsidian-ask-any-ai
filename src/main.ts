import { Plugin } from "obsidian";
import { AskAnyAiSettings, DEFAULT_SETTINGS } from "./settings";
import { AskAnyAiSettingTab } from "./ui/settingsTab";
import { registerCommands } from "./commands";
import { migrateSettings } from "./core/settingsMigration";

export default class AskAnyAiPlugin extends Plugin {
  settings!: AskAnyAiSettings;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new AskAnyAiSettingTab(this.app, this));
    registerCommands(this);
  }

  async loadSettings() {
    const saved = await this.loadData() as Record<string, unknown> | null;
    const needsMigration = saved != null && (
      "llmProvider" in saved || "llmPromptMode" in saved
    );
    const migrated = migrateSettings(saved);
    this.settings = Object.assign({}, DEFAULT_SETTINGS, migrated);
    if (needsMigration) {
      await this.saveSettings();
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
