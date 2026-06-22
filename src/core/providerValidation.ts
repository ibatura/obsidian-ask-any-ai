import { LlmConnection } from "../settings";

export function isValidHttpUrl(s: string): boolean {
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateConnection(connection: LlmConnection): string | null {
  switch (connection.provider) {
    case "copilot":
      if (!isValidHttpUrl(connection.baseUrl)) return "Set a valid Copilot API base URL in plugin settings";
      if (!connection.apiKey) return "Set a Copilot API key in plugin settings";
      return null;
    case "claude":
      if (connection.baseUrl && !isValidHttpUrl(connection.baseUrl)) return "Claude API base URL must be http(s)";
      if (!connection.apiKey) return "Set a Claude API key in plugin settings";
      return null;
    case "claude-proxy":
      if (!isValidHttpUrl(connection.baseUrl)) return "Set a valid Claude proxy API base URL in plugin settings";
      if (!connection.apiKey) return "Set a Claude proxy API key in plugin settings";
      return null;
    case "gemini":
      if (connection.baseUrl && !isValidHttpUrl(connection.baseUrl)) return "Gemini API base URL must be http(s)";
      if (!connection.apiKey) return "Set a Gemini API key in plugin settings";
      return null;
    case "cli":
      if (!connection.cliCommand || !connection.cliCommand.trim()) return "Set a CLI command in plugin settings";
      return null;
    default: {
      const _exhaustive: never = connection.provider;
      return `Unknown provider: ${String(_exhaustive)}`;
    }
  }
}
