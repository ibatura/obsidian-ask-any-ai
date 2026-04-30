import { App } from "obsidian";
import { AiAssistantSettings } from "../settings";

export async function resolveLlmPrompt(_app: App, settings: AiAssistantSettings): Promise<string> {
  const defaultInline = "You are an expert assistant. Generate the requested result in Markdown.";

  switch (settings.llmPromptMode) {
    case "none":
      return "";
    case "inline":
      if (settings.llmIncludeInlineSystemPrompt === false) return "";
      return settings.llmInlinePrompt || defaultInline;
    case "picker":
      // Picker prompt is resolved by the caller; fall back to inline prompt if called directly.
      return settings.llmInlinePrompt || defaultInline;
  }
}
