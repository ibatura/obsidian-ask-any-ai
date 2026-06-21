# Prompt resolution

The plugin provides two commands, each with its own system-prompt source.

## Ask AI

[src/commands/insertResult.ts — `insertLlmResultRaw`](../../src/commands/insertResult.ts)

The system prompt comes entirely from the inline prompt setting. `resolveInlinePrompt` in [src/core/promptResolver.ts](../../src/core/promptResolver.ts) returns:

- The `llmInlinePrompt` string (or the built-in default) when `llmIncludeInlineSystemPrompt` is `true`.
- An empty string when `llmIncludeInlineSystemPrompt` is `false`.

The toggle lets a user keep their inline prompt configured but temporarily suppress it without clearing it.

## Ask AI with template

[src/commands/insertResult.ts — `insertLlmResultWithTemplate`](../../src/commands/insertResult.ts)

### Step 1 — Picker

[src/ui/promptPickerModal.ts](../../src/ui/promptPickerModal.ts) is a `SuggestModal<PromptItem>` listing:

- A `"None"` item which resolves to `null` (no template, empty system prompt).
- All `.md` files directly inside `settings.llmPromptsFolder` — the search is case-insensitive and **non-recursive** (only direct children).

`openAndAwait()` returns a `Promise<TFile | null | "cancelled">`.

#### The selectSuggestion override

Obsidian's default `SuggestModal` fires `onClose` before `onChooseSuggestion`, which would resolve the promise to `"cancelled"` before the chosen file ever surfaces. The override resolves synchronously *before* `close()`, and a `chosen` flag prevents `onClose` from double-resolving.

### Step 2 — Frontmatter overrides

The template file's frontmatter is read via `app.metadataCache.getFileCache(picked)?.frontmatter`. Any `ai-*` keys found there are parsed and validated by `parseTemplateOverrides` and merged into a per-run clone of the global settings by `applyOverrides`. The global settings object is never mutated. See [Template overrides](template-overrides.md) for the full key table and fallback rules.

### Step 3 — Frontmatter stripping

The raw file content is read via `app.vault.read(picked)`. `stripFrontmatter` slices off everything up to and including the closing `---` line (using `frontmatterPosition.end.offset` from the metadata cache), then drops the leading newline. The result is the template *body* — the part that becomes the system prompt.

### Step 4 — System prompt assembly

```ts
const inlinePrompt = resolveInlinePrompt(effectiveSettings);
const systemPrompt = inlinePrompt
  ? `${inlinePrompt}\n\n${templateBody}`
  : templateBody;
```

If `llmIncludeInlineSystemPrompt` is `true` in the effective settings, the inline prompt is prepended to the template body with a blank-line separator. The template body is always present (even if the picker returns `null`, it becomes an empty string).

## Note-names augmentation

Both commands pass the system prompt through the same note-names step — see [Note-names context](note-names-context.md). The resolved prompt and the note block are joined with `\n\n`.
