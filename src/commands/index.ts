import type AiAssistantPlugin from "../main";
import { insertLlmResultInPlace } from "./insertResult";

export function registerCommands(plugin: AiAssistantPlugin): void {
  plugin.addCommand({
    id: "insert-ai-result",
    name: "Ask AI",
    editorCallback: async (editor, view) => {
      await insertLlmResultInPlace(editor, view.file, plugin.app, plugin.settings);
    },
  });
}
