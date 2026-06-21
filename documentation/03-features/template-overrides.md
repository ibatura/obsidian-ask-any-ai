# Template overrides

The **Ask AI with template** command lets each template `.md` file carry its own YAML frontmatter that overrides plugin settings for a single invocation. Global settings are never mutated.

## YAML key table

Add any of these to a template's frontmatter:

| Frontmatter key | Maps to setting | Accepted values |
|---|---|---|
| `ai-provider` | `llmProvider` | `copilot`, `claude`, `claude-proxy`, `gemini`, `cli` |
| `ai-model` | `llmModel` | Any non-empty string |
| `ai-result-heading` | `llmResultHeading` | Any string (empty string disables the heading) |
| `ai-insert-position` | `insertPosition` | `after-selection`, `at-cursor`, `end-of-file` |
| `ai-debug` | `debug` | `true` or `false` |
| `ai-include-inline-prompt` | `llmIncludeInlineSystemPrompt` | `true` or `false` |
| `ai-include-note-names` | `includeVaultNoteNames` | `true` or `false` |
| `ai-include-note-aliases` | `includeNoteAliases` | `true` or `false` |

Any `ai-` key not in this table is warned about and ignored.

## Example

```yaml
---
ai-provider: claude
ai-model: claude-haiku-4-5-20251001
ai-result-heading: Translation
ai-insert-position: end-of-file
ai-include-note-names: true
ai-include-note-aliases: true
---
You are a professional translator. Translate the following text to French.
```

## Validation and warn-and-fall-back

Overrides are validated field-by-field. An invalid value produces a single warning and leaves the global value intact; other fields are still applied. All warnings for a run are shown in a single Obsidian `Notice` and logged to the console.

| Condition | Behaviour |
|---|---|
| `ai-provider` has an unrecognised value | Warn; global provider and model are kept |
| `ai-insert-position` has an unrecognised value | Warn; global insert position is kept |
| Boolean key (`ai-debug`, `ai-include-inline-prompt`, etc.) has a non-boolean value | Warn; global value is kept |
| `ai-provider` (or `ai-model`) overrides to a provider that has no configured credentials | Warn "no configured credentials — reverting to global provider"; provider and model are both reverted to the global values |
| Unknown `ai-*` key | Warn; ignored |
| Non-`ai-*` key | Silently ignored |

## Effective-settings merge

```ts
// applyOverrides in src/core/templateOverrides.ts
const effective: AiAssistantSettings = { ...global, ...overrides };
```

`applyOverrides` shallow-clones `global` and spreads `overrides` over it. The result is an `AiAssistantSettings` that is used for one invocation only. If credentials validation fails for an overridden provider, `effective.llmProvider` and `effective.llmModel` are both reset to `global.llmProvider` / `global.llmModel` in-place.

## Frontmatter stripping

The template body sent to the model is the file content **after** the frontmatter block. `stripFrontmatter` slices at `frontmatterPosition.end.offset` (from Obsidian's metadata cache) and drops the following newline. If the template has no frontmatter, the entire file content is used.

## Source locations

| File | Purpose |
|---|---|
| [src/core/templateOverrides.ts](../../src/core/templateOverrides.ts) | `parseTemplateOverrides`, `applyOverrides`, `stripFrontmatter` |
| [src/core/providerValidation.ts](../../src/core/providerValidation.ts) | `validateProviderSettings` — shared credential check used by both `applyOverrides` and `insertResult.ts` |
| [src/commands/insertResult.ts](../../src/commands/insertResult.ts) | `insertLlmResultWithTemplate` — wires picker → parse → apply → strip → request |
| [src/core/templateOverrides.test.ts](../../src/core/templateOverrides.test.ts) | Unit tests for all three functions |
