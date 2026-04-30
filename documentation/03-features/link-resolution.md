# Link resolution

Wikilink expansion is implemented in [src/core/linkResolver.ts](../../src/core/linkResolver.ts). The exported entry point is `expandObsidianLinks(text, sourcePath, app)`, which returns `{ expanded, unresolved }`.

## What gets expanded

| Syntax | Meaning | Resolved by |
|---|---|---|
| `[[Note]]` | Whole file | `extractByHeadingPath` not used — full file content returned |
| `[[Note#Heading]]` | Section under a heading | `extractByHeadingPath` |
| `[[Note#Outer#Inner]]` | Nested heading path | `extractByHeadingPath` (multi-part) |
| `[[Note#^blockid]]` | Block reference | `extractByBlockId` |
| `[[Note\|Alias]]` | Aliased link — alias is dropped, target is resolved | `parseLinkText` strips after `\|` |

The pipeline is **single-pass and non-recursive** — expanded content is *not* re-scanned for further wikilinks. This prevents both cycles and unbounded fan-out.

## Algorithm

[linkResolver.ts:92](../../src/core/linkResolver.ts:92) follows three phases:

### 1. Match and parse

Regex: `/\[\[([^\]]+)\]\]/g` ([linkResolver.ts:90](../../src/core/linkResolver.ts:90)).

For each match, `parseLinkText` ([linkResolver.ts:8](../../src/core/linkResolver.ts:8)) extracts:

- `linkpath` — the part before `|` and `#`
- `fragment` — the part after the first `#` (or `undefined` if absent)

### 2. Deduplicate and resolve

[linkResolver.ts:106](../../src/core/linkResolver.ts:106)

A `Set<string>` tracks already-resolved raw matches so the same `[[Foo]]` appearing twice triggers only one vault read. Resolutions are cached in a `Map<string, string>` keyed by raw link text.

`resolveLink` ([linkResolver.ts:62](../../src/core/linkResolver.ts:62)):

1. `app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath)` to find the target file (or the source file itself if `linkpath` is empty — the case for `[[#Heading]]` self-references).
2. `app.vault.read(targetFile)` to load content.
3. If no fragment → return whole content.
4. If fragment starts with `^` → block lookup via `extractByBlockId`.
5. Otherwise → heading-path lookup via `extractByHeadingPath`.

If the file or fragment is not found, the link is added to `unresolved` and left untouched in the output.

### 3. Substitute

[linkResolver.ts:121](../../src/core/linkResolver.ts:121) does a final `text.replace(WIKILINK_RE, ...)` using the resolution map. Unresolved links pass through unchanged.

## Heading-path extraction

[linkResolver.ts:20](../../src/core/linkResolver.ts:20)

`extractByHeadingPath` walks a multi-part fragment like `Outer#Inner#Subinner`:

1. Split by `#`.
2. For each part, find a matching heading (case-insensitive) at or after the current `startOffset`.
3. The section ends at the next heading whose level is *less than or equal to* the matched heading's level — this preserves the entire subtree.
4. Narrow the candidate-headings list to those inside the matched section before processing the next part.
5. After all parts are consumed, return `content.slice(startOffset, endOffset).trim()`.

This is why `[[Notes#A#B]]` correctly returns *only the B section under A*, not any other `B` heading elsewhere in the file.

## Block extraction

[linkResolver.ts:55](../../src/core/linkResolver.ts:55)

`extractByBlockId` reads the block's `position.start.offset` / `position.end.offset` from `cache.blocks[blockId]`. Block IDs are looked up *after* stripping the leading `^` from the fragment.

## Edge cases

| Case | Behaviour |
|---|---|
| `[[Foo\|Bar]]` (alias) | Alias dropped — only `Foo` is resolved |
| `[[Foo]]` repeated 5× | Resolved once; substituted 5× |
| `[[Foo#NotFound]]` | Whole match added to `unresolved`; left in place in output |
| `[[ ]]` (empty link) | `getFirstLinkpathDest` returns null → unresolved |
| `[[#Heading]]` (self) | `linkpath === ""` → falls through to `getAbstractFileByPath(sourcePath)` ([linkResolver.ts:70](../../src/core/linkResolver.ts:70)) |
| `[[Foo]]` whose target itself contains `[[Bar]]` | `Bar` is **not** expanded (single-pass) |
