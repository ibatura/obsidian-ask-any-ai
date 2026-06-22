import { LlmConnection, LlmProvider, generateConnectionId } from "../settings";

const PROVIDER_NAMES: Record<LlmProvider, string> = {
  copilot: "Copilot",
  claude: "Claude",
  "claude-proxy": "Claude (proxy)",
  gemini: "Gemini",
  cli: "Local CLI",
};

const LEGACY_FIELDS = [
  "llmProvider", "llmModel",
  "copilotApiBaseUrl", "copilotApiKey",
  "claudeApiBaseUrl", "claudeApiKey",
  "claudeProxyApiBaseUrl", "claudeProxyApiKey",
  "geminiApiBaseUrl", "geminiApiKey",
  "cliCommand", "cliArgs", "cliCwd",
];

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function legacyBaseUrl(saved: Record<string, unknown>, provider: LlmProvider): string {
  switch (provider) {
    case "copilot": return str(saved.copilotApiBaseUrl);
    case "claude": return str(saved.claudeApiBaseUrl);
    case "claude-proxy": return str(saved.claudeProxyApiBaseUrl);
    case "gemini": return str(saved.geminiApiBaseUrl);
    case "cli": return "";
  }
}

function legacyApiKey(saved: Record<string, unknown>, provider: LlmProvider): string {
  switch (provider) {
    case "copilot": return str(saved.copilotApiKey);
    case "claude": return str(saved.claudeApiKey);
    case "claude-proxy": return str(saved.claudeProxyApiKey);
    case "gemini": return str(saved.geminiApiKey);
    case "cli": return "";
  }
}

export function migrateSettings(
  saved: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!saved) return {};

  const result: Record<string, unknown> = { ...saved };

  delete result.llmPromptMode;

  if ("llmProvider" in result && !("connections" in result)) {
    const provider = (str(result.llmProvider) || "copilot") as LlmProvider;
    const id = generateConnectionId();
    const connection: LlmConnection = {
      id,
      name: PROVIDER_NAMES[provider] ?? provider,
      provider,
      model: str(result.llmModel),
      baseUrl: legacyBaseUrl(result, provider),
      apiKey: legacyApiKey(result, provider),
      cliCommand: str(result.cliCommand),
      cliArgs: str(result.cliArgs),
      cliCwd: str(result.cliCwd),
    };
    result.connections = [connection];
    result.defaultConnectionId = id;
  }

  for (const field of LEGACY_FIELDS) {
    delete result[field];
  }

  return result;
}
