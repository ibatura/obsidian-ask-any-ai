# Template overrides

The **Ask AI with template** command lets each template `.md` file carry its own YAML frontmatter that overrides plugin settings for a single invocation. Global settings are never mutated.

## YAML key table

Add any of these to a template's frontmatter:

| Frontmatter key | Effect | Accepted values |
|---|---|---|
| `ai-llm` | Select a connection by name for this run | Any configured connection name (case-insensitive) |
| `ai-model` | Override the model of the selected connection | Any non-empty string |
| `ai-result-heading` | Maps to `llmResultHeading` | Any string (empty disables the heading) |
| `ai-insert-position` | Maps to `insertPosition` | `after-selection`, `at-cursor`, `end-of-file` |
| `ai-debug` | Maps to `debug` | `true` or `false` |
| `ai-include-inline-prompt` | Maps to `llmIncludeInlineSystemPrompt` | `true` or `false` |
| `ai-include-note-names` | Maps to `includeVaultNoteNames` | `true` or `false` |
| `ai-include-note-aliases` | Maps to `includeNoteAliases` | `true` or `false` |

Any `ai-` key not in this table is warned about and ignored.

## Example

```yaml
---
ai-llm: Work Claude
ai-model: claude-haiku-4-5-20251001
ai-result-heading: Translation
ai-insert-position: end-of-file
ai-include-note-names: true
ai-include-note-aliases: true
---
You are a professional translator. Translate the following text to French.
```

`ai-llm: Work Claude` selects the connection named "Work Claude" for this run. `ai-model` overrides its model; the connection's credentials are still used.

## Validation and warn-and-fall-back

| Condition | Behaviour |
|---|---|
| `ai-llm` names a connection that does not exist | Warn "connection X not configured — using default"; default connection is used |
| `ai-llm` names a connection whose credentials are incomplete | Warn "connection X misconfigured — falling back to default"; default is used |
| `ai-insert-position` has an unrecognised value | Warn; global insert position is kept |
| Boolean key (`ai-debug`, `ai-include-inline-prompt`, etc.) has a non-boolean value | Warn; global value is kept |
| `ai-provider` (deprecated key) | Warn "Unknown template property: ai-provider"; ignored |
| Unknown `ai-*` key | Warn; ignored |
| Non-`ai-*` key | Silently ignored |

All warnings for a run are shown in a single Obsidian `Notice` and logged to the console.

## Effective-settings merge

```ts
// applyOverrides in src/core/templateOverrides.ts
const effective: AiAssistantSettings = { ...global, ...overrides };
```

`applyOverrides` shallow-clones `global` and spreads `overrides` over it. The result is an `AiAssistantSettings` used for one invocation only. Connection resolution (`resolveConnection`) runs afterward with the `llmName` and `modelOverride` parsed from frontmatter.

## Frontmatter stripping

The template body sent to the model is the file content **after** the frontmatter block. `stripFrontmatter` slices at `frontmatterPosition.end.offset` (from Obsidian's metadata cache) and drops the following newline. If the template has no frontmatter, the entire file content is used.

## Source locations

| File | Purpose |
|---|---|
| [src/core/templateOverrides.ts](../../src/core/templateOverrides.ts) | `parseTemplateOverrides`, `applyOverrides`, `stripFrontmatter` |
| [src/core/connectionResolver.ts](../../src/core/connectionResolver.ts) | `resolveConnection` — picks connection by name or default, validates, warns and falls back |
| [src/core/providerValidation.ts](../../src/core/providerValidation.ts) | `validateConnection` — checks credentials for a single `LlmConnection` |
| [src/commands/insertResult.ts](../../src/commands/insertResult.ts) | `insertLlmResultWithTemplate` — wires picker → parse → apply → resolve connection → strip → request |
| [src/core/templateOverrides.test.ts](../../src/core/templateOverrides.test.ts) | Unit tests for all three functions |
