import { Plugin } from "obsidian";
import { AiAssistantSettings, DEFAULT_SETTINGS } from "./settings";
import { AiAssistantSettingTab } from "./ui/settingsTab";
import { registerCommands } from "./commands";

export default class AiAssistantPlugin extends Plugin {
  settings!: AiAssistantSettings;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new AiAssistantSettingTab(this.app, this));
    registerCommands(this);
  }

  async loadSettings() {
    const saved = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);

    // Migrate legacy "from-folder" prompt mode to "picker"
    if ((this.settings.llmPromptMode as string) === "from-folder") {
      this.settings.llmPromptMode = "picker";
      await this.saveSettings();
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
