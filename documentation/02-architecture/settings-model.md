# Settings model

The settings shape is defined in [src/settings.ts](../../src/settings.ts) as the `AskAnyAiSettings` interface. Defaults live in `DEFAULT_SETTINGS`. The settings UI in [src/ui/settingsTab.ts](../../src/ui/settingsTab.ts) renders the same fields, grouped into four logical sections.

## Field reference

### LLM connections

The plugin stores a list of named LLM connections rather than a single active provider. The active connection for a command is chosen by the default selection or overridden per-template with `ai-llm`.

| Field | Type | Default |
|---|---|---|
| `connections` | `LlmConnection[]` | One Copilot connection |
| `defaultConnectionId` | `string` | ID of the first connection |
| `timeoutMs` | `number` | `60000` |

#### `LlmConnection` shape

```ts
interface LlmConnection {
  id: string;           // stable random identifier, never changes
  name: string;         // user-facing label; referenced in templates as ai-llm: <name>
  provider: LlmProvider; // "copilot" | "claude" | "claude-proxy" | "gemini" | "cli"
  model: string;        // empty = use provider default
  baseUrl: string;      // API base URL; empty = use provider default
  apiKey: string;       // API key or Bearer token; unused by CLI
  cliCommand: string;   // binary name or path; CLI only
  cliArgs: string;      // space-separated extra args; CLI only
  cliCwd: string;       // override working directory; CLI only, empty = inherit
}
```

**`id`** is assigned once (via `generateConnectionId`) and never changed. It is the stable key for `defaultConnectionId`.

**`name`** must be non-empty and unique across all connections (case-insensitive comparison). It is the value used in `ai-llm:` frontmatter.

**Provider-specific defaults** inside the clients (used when `model` is empty):

- `CopilotClient` → `gpt-4.1-mini`
- `ClaudeClient` → `claude-sonnet-4-20250514`
- `GeminiClient` → `gemini-2.0-flash`
- `ClaudeProxyClient` → throws if `model` is empty

**Credential requirements per provider:**

| Provider | Required fields |
|---|---|
| Copilot | `baseUrl`, `apiKey` |
| Claude | `apiKey` (`baseUrl` defaults to `https://api.anthropic.com`) |
| Claude proxy | `baseUrl`, `apiKey` |
| Gemini | `apiKey` (`baseUrl` defaults to `https://generativelanguage.googleapis.com`) |
| CLI | `cliCommand` |

### Prompt configuration

| Field | Type | Default | Used by |
|---|---|---|---|
| `llmInlinePrompt` | `string` | `"You are an expert assistant. Generate the requested result in Markdown."` | [promptResolver.ts](../../src/core/promptResolver.ts) |
| `llmIncludeInlineSystemPrompt` | `boolean` | `true` | [promptResolver.ts](../../src/core/promptResolver.ts) — when `false`, the inline prompt is not sent |
| `llmPromptsFolder` | `string` | `"Prompts/AI"` | [promptPickerModal.ts](../../src/ui/promptPickerModal.ts) |

### Vault note names context

| Field | Type | Default | Used by |
|---|---|---|---|
| `includeVaultNoteNames` | `boolean` | `false` | [insertResult.ts](../../src/commands/insertResult.ts) |
| `includeNoteAliases` | `boolean` | `false` | [noteNamesContext.ts](../../src/core/noteNamesContext.ts) — when `true`, each note's frontmatter aliases are rendered alongside the note name |
| `vaultNoteNamesExclusions` | `string[]` | `["Untitled*", "Screenshot*"]` | [noteNamesContext.ts](../../src/core/noteNamesContext.ts) |

### Insertion + debug

| Field | Type | Default | Used by |
|---|---|---|---|
| `llmResultHeading` | `string` | `"AI Result"` | [insertResult.ts](../../src/commands/insertResult.ts) — empty string disables the heading |
| `insertPosition` | `"at-cursor" \| "after-selection" \| "end-of-file"` | `"after-selection"` | [insertResult.ts](../../src/commands/insertResult.ts) |
| `debug` | `boolean` | `false` | [insertResult.ts](../../src/commands/insertResult.ts) |

## Persistence

[src/main.ts](../../src/main.ts)

```ts
async loadSettings() {
  const saved = await this.loadData() as Record<string, unknown> | null;
  const needsMigration = saved != null && ("llmProvider" in saved || "llmPromptMode" in saved);
  const migrated = migrateSettings(saved);
  this.settings = Object.assign({}, DEFAULT_SETTINGS, migrated);
  if (needsMigration) await this.saveSettings();
}

async saveSettings() {
  await this.saveData(this.settings);
}
```

- `loadData` / `saveData` are Obsidian's plugin-scoped persistence (`<vault>/.obsidian/plugins/<id>/data.json`).
- The merge is shallow; arrays and objects are replaced wholesale.
- Every settings-tab change calls `await plugin.saveSettings()` immediately, so there is no in-memory dirty state.

## Migration

Migrations run in `migrateSettings` ([src/core/settingsMigration.ts](../../src/core/settingsMigration.ts)) and are applied during `loadSettings`. If migration is needed the corrected value is persisted immediately.

| When added | What it does |
|---|---|
| Initial | Removes the legacy `llmPromptMode` field (`"none" \| "inline" \| "picker"`). Prompt mode is now command-driven: **Ask AI** always uses the inline prompt, **Ask AI with template** always opens the picker. |
| Multiple connections | Removes the legacy flat provider/credential fields (`llmProvider`, `llmModel`, `copilotApiBaseUrl`, `copilotApiKey`, `claudeApiBaseUrl`, `claudeApiKey`, `claudeProxyApiBaseUrl`, `claudeProxyApiKey`, `geminiApiBaseUrl`, `geminiApiKey`, `cliCommand`, `cliArgs`, `cliCwd`) and builds one `LlmConnection` named `"Default"` from them. |

New migrations follow the same shape: detect the legacy value, apply the correction, return the corrected object.

## Per-run overrides

The `ai-llm` and `ai-model` frontmatter keys in a template select a connection by name and override its model for one run. The `llmResultHeading`, `insertPosition`, `debug`, `llmIncludeInlineSystemPrompt`, `includeVaultNoteNames`, and `includeNoteAliases` fields can also be overridden. The override is applied to a shallow clone of `settings` — global settings are never mutated. See [Template overrides](../03-features/template-overrides.md).
