# Prompt resolution

The plugin supports three system-prompt modes via the `llmPromptMode` setting. The dispatch happens in two places:

- [src/core/promptResolver.ts](../../src/core/promptResolver.ts) — for `none` and `inline` modes (called when the command runs in those modes)
- [src/commands/insertResult.ts:92](../../src/commands/insertResult.ts:92) — for `picker` mode (resolved by the caller using the picked file)

## The three modes

| Mode | Behaviour | Source |
|---|---|---|
| `none` | Returns empty string — no system prompt at all | [promptResolver.ts:8](../../src/core/promptResolver.ts:8) |
| `inline` | Returns `llmInlinePrompt` (or default) — but only if `llmIncludeInlineSystemPrompt` is `true` | [promptResolver.ts:10](../../src/core/promptResolver.ts:10) |
| `picker` | Opens [PromptPickerModal](../../src/ui/promptPickerModal.ts) before progress UI; reads chosen `.md` file | [insertResult.ts:69](../../src/commands/insertResult.ts:69) |

## Inline-mode toggle

[promptResolver.ts:11](../../src/core/promptResolver.ts:11)

```ts
case "inline":
  if (settings.llmIncludeInlineSystemPrompt === false) return "";
  return settings.llmInlinePrompt || defaultInline;
```

`llmIncludeInlineSystemPrompt` lets a user keep their inline prompt configured but temporarily *not* send it — useful when iterating on the user-content side of the request without changing settings.

## Picker mode

[src/ui/promptPickerModal.ts](../../src/ui/promptPickerModal.ts) is a `SuggestModal<PromptItem>` listing:

- A `"None"` item ([promptPickerModal.ts:25](../../src/ui/promptPickerModal.ts:25)) which resolves to `null` (no system prompt).
- All `.md` files directly inside the configured `llmPromptsFolder` ([promptPickerModal.ts:27](../../src/ui/promptPickerModal.ts:27)) — the search is case-insensitive on the parent path and **non-recursive** (only direct children).

`openAndAwait()` ([promptPickerModal.ts:19](../../src/ui/promptPickerModal.ts:19)) returns a `Promise<TFile | null | "cancelled">`.

### The selectSuggestion override

[promptPickerModal.ts:54](../../src/ui/promptPickerModal.ts:54)

```ts
selectSuggestion(item: PromptItem): void {
  this.chosen = true;
  this.resolve(item.file);
  this.close();
}
```

Obsidian's default `SuggestModal` orchestration runs `onChooseSuggestion` and `onClose` in an order that the modal cannot influence. Without this override, `onClose` fires *first* and resolves the promise to `"cancelled"` before the chosen file ever surfaces.

By overriding `selectSuggestion` and resolving synchronously *before* `close()`, the chosen file always reaches the caller. The `chosen` flag prevents `onClose` from also calling `resolve("cancelled")` afterwards.

## Picker resolution back in the pipeline

[insertResult.ts:92](../../src/commands/insertResult.ts:92)

```ts
if (settings.llmPromptMode === "picker") {
  systemPrompt = pickedPromptFile ? await app.vault.read(pickedPromptFile) : "";
} else {
  systemPrompt = await resolveLlmPrompt(app, settings);
}
```

So when the user picks `"None"` (or no file is selected), `systemPrompt` is empty. Otherwise it's the full content of the picked `.md` file.

## Legacy migration

[src/main.ts:20](../../src/main.ts:20) rewrites the historical value `"from-folder"` to `"picker"` on first load after upgrade. The old behaviour read a fixed file from the prompts folder, which made every command run use the same prompt; the new behaviour shows the picker every time so the user can swap prompts per invocation without changing settings.

## Note-names augmentation

The system prompt may be augmented by `buildNoteNamesBlock` *after* it is resolved — see [Note-names context](note-names-context.md). The resolved prompt and the note block are joined with `\n\n` ([insertResult.ts:102](../../src/commands/insertResult.ts:102)).
