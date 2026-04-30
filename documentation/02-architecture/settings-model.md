# Settings model

The settings shape is defined in [src/settings.ts](../../src/settings.ts) as the `AiAssistantSettings` interface. Defaults live in `DEFAULT_SETTINGS` ([src/settings.ts:48](../../src/settings.ts:48)). The settings UI in [src/ui/settingsTab.ts](../../src/ui/settingsTab.ts) renders the same fields, grouped into five logical sections.

## Field reference

### Provider selection

| Field | Type | Default | Used by |
|---|---|---|---|
| `llmProvider` | `"copilot" \| "claude" \| "claude-proxy" \| "gemini" \| "cli"` | `"copilot"` | [llmClient.ts:264](../../src/core/llmClient.ts:264) factory; [insertResult.ts:21](../../src/commands/insertResult.ts:21) validator |
| `llmModel` | `string` | `""` | Each provider client; falls back to provider-specific defaults except `claude-proxy` which throws |
| `timeoutMs` | `number` | `60000` | [llmClient.ts:201](../../src/core/llmClient.ts:201) `CliClient` only |

Provider-specific defaults inside the clients (used when `llmModel` is empty):

- `CopilotClient` → `gpt-4.1-mini` ([llmClient.ts:26](../../src/core/llmClient.ts:26))
- `ClaudeClient` → `claude-sonnet-4-20250514` ([llmClient.ts:60](../../src/core/llmClient.ts:60))
- `GeminiClient` → `gemini-2.0-flash` ([llmClient.ts:144](../../src/core/llmClient.ts:144))
- `ClaudeProxyClient` → throws an error if empty ([llmClient.ts:102](../../src/core/llmClient.ts:102))

### Credentials per provider

| Provider | Fields |
|---|---|
| Copilot | `copilotApiBaseUrl`, `copilotApiKey` |
| Claude | `claudeApiBaseUrl` (defaults to `https://api.anthropic.com`), `claudeApiKey` |
| Claude proxy | `claudeProxyApiBaseUrl`, `claudeProxyApiKey` |
| Gemini | `geminiApiBaseUrl` (defaults to `https://generativelanguage.googleapis.com`), `geminiApiKey` |
| CLI | `cliCommand` (default `"claude"`), `cliArgs`, `cliCwd` |

All credential strings default to `""`. The Claude and Gemini base URLs are special-cased — the client substitutes the public default when the field is empty, which is why both can validate as missing-only-if-non-http (see [insertResult.ts:27](../../src/commands/insertResult.ts:27) and [insertResult.ts:35](../../src/commands/insertResult.ts:35)).

### Prompt configuration

| Field | Type | Default | Used by |
|---|---|---|---|
| `llmPromptMode` | `"none" \| "inline" \| "picker"` | `"picker"` | [promptResolver.ts:7](../../src/core/promptResolver.ts:7); [insertResult.ts:70](../../src/commands/insertResult.ts:70) |
| `llmInlinePrompt` | `string` | `"You are an expert assistant. Generate the requested result in Markdown."` | [promptResolver.ts:12](../../src/core/promptResolver.ts:12) |
| `llmIncludeInlineSystemPrompt` | `boolean` | `true` | [promptResolver.ts:11](../../src/core/promptResolver.ts:11) — when `false` in inline mode, no system prompt is sent |
| `llmPromptsFolder` | `string` | `"Prompts/AI"` | [promptPickerModal.ts:27](../../src/ui/promptPickerModal.ts:27) |

### Vault note names context

| Field | Type | Default | Used by |
|---|---|---|---|
| `includeVaultNoteNames` | `boolean` | `false` | [insertResult.ts:99](../../src/commands/insertResult.ts:99) |
| `vaultNoteNamesExclusions` | `string[]` | `["Untitled*", "Screenshot*"]` | [noteNamesContext.ts:42](../../src/core/noteNamesContext.ts:42) |

### Insertion + debug

| Field | Type | Default | Used by |
|---|---|---|---|
| `llmResultHeading` | `string` | `"AI Result"` | [insertResult.ts:147](../../src/commands/insertResult.ts:147) — empty string disables the heading |
| `insertPosition` | `"at-cursor" \| "after-selection" \| "end-of-file"` | `"after-selection"` | [insertResult.ts:152](../../src/commands/insertResult.ts:152) |
| `debug` | `boolean` | `false` | [insertResult.ts:134](../../src/commands/insertResult.ts:134) |

## Persistence

[src/main.ts:15](../../src/main.ts:15)

```ts
async loadSettings() {
  const saved = await this.loadData();
  this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
  // ... legacy migration
}

async saveSettings() {
  await this.saveData(this.settings);
}
```

- `loadData` / `saveData` are Obsidian's plugin-scoped persistence (one JSON file per plugin under `<vault>/.obsidian/plugins/<id>/data.json`).
- The merge is shallow; arrays and objects are replaced wholesale.
- Every settings-tab change calls `await plugin.saveSettings()` immediately, so there is no in-memory dirty state.

## Migration

The only migration so far is the one-shot `"from-folder"` → `"picker"` rewrite at [src/main.ts:20](../../src/main.ts:20). It was added when the prompt-from-a-fixed-folder mode was replaced by the interactive picker (see [Prompt resolution](../03-features/prompt-resolution.md)). New migrations should follow the same shape: detect the legacy value during `loadSettings`, set the new value, call `await this.saveSettings()`.
