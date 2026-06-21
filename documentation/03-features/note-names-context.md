# Note-names context

`buildNoteNamesBlock` in [src/core/noteNamesContext.ts](../../src/core/noteNamesContext.ts) appends a list of vault note names to the system prompt so the LLM can emit resolvable wikilinks. It runs only when `settings.includeVaultNoteNames` is `true` ([insertResult.ts](../../src/commands/insertResult.ts)).

## What the block looks like

Without aliases (`includeNoteAliases: false`, the default):

```
## Vault notes available for linking

When your response mentions any of the notes listed below, wrap the reference as an Obsidian wiki-link using double square brackets, e.g. [[Note Name]]. Do not invent links to notes that are not in this list.

- Note A
- Note B
- ...
```

With aliases enabled (`includeNoteAliases: true`):

```
## Vault notes available for linking

When your response mentions any of the notes listed below, wrap the reference as an Obsidian wiki-link using double square brackets, e.g. [[Note Name]]. Notes with aliases in parentheses may also be referenced by any of those aliases. Do not invent links to notes that are not in this list.

- Note A (aka: alias-one, alias-two)
- Note B
- ...
```

Notes without aliases are rendered identically in both modes.

## Algorithm

1. **Enumerate** — `app.vault.getMarkdownFiles()` returns every `.md` in the vault (no folder restriction; all top-level + nested).
2. **Exclude** — filter out files whose basename or vault-relative path (without `.md`) matches any pattern in `vaultNoteNamesExclusions`.
3. **Disambiguate** — count basename occurrences (case-insensitive). For any basename that appears in 2+ files, render the **full vault path** (without `.md`) instead of the basename. This guarantees every entry resolves uniquely when the LLM emits it as a wikilink.
4. **Sort** — alphabetical, case-insensitive.
5. **Render** — bullet list joined with `\n`, prepended by the heading and instruction. When `includeNoteAliases` is `true`, aliases are appended inline (see below).

## Exclusion patterns

[noteNamesContext.ts:6](../../src/core/noteNamesContext.ts:6)

`patternToRegex` converts a glob to a regex:

| Pattern token | Regex |
|---|---|
| `**` | `.*` (matches across `/`) |
| `*` | `[^/]*` (single segment) |
| `?` | `[^/]` |
| anything else | escaped literal |

Patterns are applied case-insensitively (`new RegExp(..., "i")` at [noteNamesContext.ts:25](../../src/core/noteNamesContext.ts:25)).

### Pattern scope

[noteNamesContext.ts:36](../../src/core/noteNamesContext.ts:36)

```ts
const testStr = pattern.includes("/") ? vaultPathNoExt : basename;
```

- A pattern *without* `/` matches against the **basename** only.
  - Example: `Untitled*` excludes any note whose name starts with "Untitled", regardless of folder.
- A pattern *with* `/` matches against the **vault-relative path** (sans `.md`).
  - Example: `Daily/2024-*` excludes daily notes from 2024 only when they live in the `Daily/` folder.

### Default exclusions

[src/settings.ts:78](../../src/settings.ts:78)

```ts
vaultNoteNamesExclusions: ["Untitled*", "Screenshot*"]
```

These suppress two common kinds of vault noise:

- Notes created by Obsidian's "New note" with no title yet.
- Files produced by clipboard-image plugins.

## Note aliases

When `settings.includeNoteAliases` is `true`, `buildNoteNamesBlock` reads `app.metadataCache.getFileCache(file)?.frontmatter?.aliases` for each file. Obsidian stores aliases as either a YAML array (`["a", "b"]`) or a single string (`"a"`). Both forms are normalised into a `string[]`; empty or whitespace-only entries are dropped.

A note with aliases is rendered as:

```
- My Note (aka: alias-one, alias-two)
```

A note without aliases is rendered as before:

```
- My Note
```

The extended linking instruction is used when aliases are enabled, telling the LLM that alias names are also acceptable targets for wikilinks.

Exclusion patterns are applied before alias lookup, so excluded notes are dropped regardless of their alias list.

## Where the block is appended

[insertResult.ts](../../src/commands/insertResult.ts)

```ts
if (settings.includeVaultNoteNames) {
  const noteBlock = buildNoteNamesBlock(app, settings.vaultNoteNamesExclusions, settings.includeNoteAliases);
  resolvedSystemPrompt = resolvedSystemPrompt ? `${resolvedSystemPrompt}\n\n${noteBlock}` : noteBlock;
}
```

If the prompt was previously empty (e.g. no inline prompt and picker returned `"None"`), the note block becomes the entire system prompt. Otherwise it is appended after a blank-line separator.

## Performance considerations

`getMarkdownFiles` is O(N) over the cached vault file list — no I/O. The filter, count, and sort are all O(N) or O(N log N) over the same list. Even with thousands of notes, the block is built in milliseconds, so it is computed on every invocation rather than cached.

The result is *not* deduplicated against the user's own active note — if the active note's basename appears, it is included. The LLM sees its own filename, which is intentional.
