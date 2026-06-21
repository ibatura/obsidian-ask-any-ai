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

All credential strings default to `""`. The Claude and Gemini base URLs are special-cased — the client substitutes the public default when the field is empty, which is why both can validate as missing-only-if-non-http (see [providerValidation.ts](../../src/core/providerValidation.ts)).

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

Migrations run during `loadSettings` ([src/main.ts](../../src/main.ts)) and persist the corrected value immediately with `await this.saveSettings()`.

| When added | What it does |
|---|---|
| Initial | Removes the legacy `llmPromptMode` field (`"none" \| "inline" \| "picker"`). Prompt mode is now command-driven: **Ask AI** always uses the inline prompt, **Ask AI with template** always opens the picker. |

New migrations should follow the same shape: detect the legacy value, apply the correction, and save.

## Per-run overrides

The `llmProvider`, `llmModel`, `llmResultHeading`, `insertPosition`, `debug`, `llmIncludeInlineSystemPrompt`, `includeVaultNoteNames`, and `includeNoteAliases` fields can be overridden on a per-invocation basis by the **Ask AI with template** command via `ai-*` YAML properties in the template's frontmatter. The override is applied to a shallow clone of `settings` — global settings are never mutated. See [Template overrides](../03-features/template-overrides.md).
