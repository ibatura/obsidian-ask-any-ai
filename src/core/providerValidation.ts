import { AiAssistantSettings } from "../settings";

export function isValidHttpUrl(s: string): boolean {
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateProviderSettings(settings: AiAssistantSettings): string | null {
  switch (settings.llmProvider) {
    case "copilot":
      if (!isValidHttpUrl(settings.copilotApiBaseUrl)) return "Set a valid Copilot API base URL in plugin settings";
      if (!settings.copilotApiKey) return "Set a Copilot API key in plugin settings";
      return null;
    case "claude":
      if (settings.claudeApiBaseUrl && !isValidHttpUrl(settings.claudeApiBaseUrl)) return "Claude API base URL must be http(s)";
      if (!settings.claudeApiKey) return "Set a Claude API key in plugin settings";
      return null;
    case "claude-proxy":
      if (!isValidHttpUrl(settings.claudeProxyApiBaseUrl)) return "Set a valid Claude proxy API base URL in plugin settings";
      if (!settings.claudeProxyApiKey) return "Set a Claude proxy API key in plugin settings";
      return null;
    case "gemini":
      if (settings.geminiApiBaseUrl && !isValidHttpUrl(settings.geminiApiBaseUrl)) return "Gemini API base URL must be http(s)";
      if (!settings.geminiApiKey) return "Set a Gemini API key in plugin settings";
      return null;
    case "cli":
      if (!settings.cliCommand || !settings.cliCommand.trim()) return "Set a CLI command in plugin settings";
      return null;
    default:
      return "Unknown AI provider";
  }
}
