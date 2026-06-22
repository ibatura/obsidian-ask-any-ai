export type LlmProvider = "copilot" | "claude" | "claude-proxy" | "gemini" | "cli";

export interface LlmConnection {
  id: string;
  name: string;
  provider: LlmProvider;
  model: string;
  baseUrl: string;
  apiKey: string;
  cliCommand: string;
  cliArgs: string;
  cliCwd: string;
}

export function generateConnectionId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export interface AiAssistantSettings {
  connections: LlmConnection[];
  defaultConnectionId: string;
  timeoutMs: number;

  // Prompt configuration
  llmInlinePrompt: string;
  llmIncludeInlineSystemPrompt: boolean;
  llmPromptsFolder: string;

  // Insertion behavior
  llmResultHeading: string;
  insertPosition: "at-cursor" | "after-selection" | "end-of-file";

  // Vault note names in context
  includeVaultNoteNames: boolean;
  includeNoteAliases: boolean;
  vaultNoteNamesExclusions: string[];

  // Debugging
  debug: boolean;
}

function makeDefaultConnection(): LlmConnection {
  return {
    id: generateConnectionId(),
    name: "Default",
    provider: "copilot",
    model: "",
    baseUrl: "",
    apiKey: "",
    cliCommand: "claude",
    cliArgs: "",
    cliCwd: "",
  };
}

const _defaultConn = makeDefaultConnection();

export const DEFAULT_SETTINGS: AiAssistantSettings = {
  connections: [_defaultConn],
  defaultConnectionId: _defaultConn.id,
  timeoutMs: 60000,

  llmInlinePrompt: "You are an expert assistant. Generate the requested result in Markdown.",
  llmIncludeInlineSystemPrompt: true,
  llmPromptsFolder: "Prompts/AI",

  llmResultHeading: "AI Result",
  insertPosition: "after-selection",

  includeVaultNoteNames: false,
  includeNoteAliases: false,
  vaultNoteNamesExclusions: ["Untitled*", "Screenshot*"],

  debug: false,
};
