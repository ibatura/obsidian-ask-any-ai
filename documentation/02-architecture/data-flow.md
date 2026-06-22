# Data flow

The plugin exposes two commands. Both share the same terminal pipeline (link expansion → connection resolution → provider call → insertion); they differ in how they produce the system prompt.

## Ask AI (raw)

```mermaid
flowchart TD
  RawInput[Raw text<br/>selection or current line]
  WikilinkExp[expandObsidianLinks]
  ExpandedUser[Expanded user content]

  InlinePrompt[resolveInlinePrompt<br/>llmInlinePrompt if toggle on, else empty]

  NotesToggle{includeVaultNoteNames?}
  NotesBlock[buildNoteNamesBlock<br/>includeNoteAliases flag]
  FinalSystem[Final system prompt]

  Resolve[resolveConnection<br/>default connection]
  Factory[createLlmClient<br/>connection + timeoutMs]
  Client[Provider client]
  Result[Result string]

  Debug{debug?}
  DebugBlock[Debug block]
  Heading[Optional heading]
  Insertion{insertPosition}
  Editor[(Editor)]

  RawInput --> WikilinkExp --> ExpandedUser

  InlinePrompt --> NotesToggle
  NotesToggle -- yes --> NotesBlock --> FinalSystem
  NotesToggle -- no --> FinalSystem

  ExpandedUser --> Resolve
  FinalSystem --> Resolve
  Resolve -- ok --> Factory --> Client --> Result

  Result --> Debug
  Debug -- yes --> DebugBlock --> Heading
  Debug -- no --> Heading
  Heading --> Insertion
  Insertion -- end-of-file --> Editor
  Insertion -- at-cursor --> Editor
  Insertion -- after-selection --> Editor
```

## Ask AI with template

```mermaid
flowchart TD
  RawInput[Raw text<br/>selection or current line]
  WikilinkExp[expandObsidianLinks]
  ExpandedUser[Expanded user content]

  Picker[PromptPickerModal<br/>pick a .md file or None]
  FileCache[app.metadataCache.getFileCache]
  Frontmatter[Template frontmatter]
  ParseOverrides[parseTemplateOverrides<br/>ai-* keys → TemplateOverrides + llmName + modelOverride]
  ApplyOverrides[applyOverrides<br/>clone global + apply settings overrides]
  EffectiveSettings[Effective settings]

  ResolveConn[resolveConnection<br/>llmName or default; apply modelOverride]
  Connection[LlmConnection]
  Warnings[Warnings notice]

  ReadFile[app.vault.read]
  StripFM[stripFrontmatter<br/>slice past frontmatterPosition.end.offset]
  TemplateBody[Template body]

  InlinePrompt[resolveInlinePrompt<br/>using effective settings]
  SystemPrompt[system prompt = inline + template body]

  NotesToggle{includeVaultNoteNames?<br/>from effective settings}
  NotesBlock[buildNoteNamesBlock<br/>includeNoteAliases flag]
  FinalSystem[Final system prompt]

  Factory[createLlmClient<br/>connection + timeoutMs]
  Client[Provider client]
  Result[Result string]

  Debug{debug?}
  DebugBlock[Debug block]
  Heading[Optional heading]
  Insertion{insertPosition}
  Editor[(Editor)]

  RawInput --> WikilinkExp --> ExpandedUser

  Picker --> FileCache --> Frontmatter --> ParseOverrides
  ParseOverrides --> ApplyOverrides --> EffectiveSettings
  ParseOverrides --> ResolveConn
  EffectiveSettings --> ResolveConn
  ResolveConn --> Connection
  ResolveConn --> Warnings

  Picker --> ReadFile --> StripFM --> TemplateBody
  TemplateBody --> SystemPrompt
  EffectiveSettings --> InlinePrompt --> SystemPrompt

  SystemPrompt --> NotesToggle
  NotesToggle -- yes --> NotesBlock --> FinalSystem
  NotesToggle -- no --> FinalSystem

  ExpandedUser --> Factory
  FinalSystem --> Factory
  Connection --> Factory --> Client --> Result

  Result --> Debug
  Debug -- yes --> DebugBlock --> Heading
  Debug -- no --> Heading
  Heading --> Insertion
  Insertion -- end-of-file --> Editor
  Insertion -- at-cursor --> Editor
  Insertion -- after-selection --> Editor
```

## Three streams that merge into the request

| Stream | Source | Transformation | Result |
|---|---|---|---|
| **User content** | `editor.getSelection()` or `editor.getLine(line)` | `expandObsidianLinks` replaces every `[[...]]` with the linked file/section/block content | `expanded: string` |
| **System prompt** | Inline prompt (Ask AI) or template body (Ask AI with template); optionally augmented by `buildNoteNamesBlock` | When `includeVaultNoteNames`, append `buildNoteNamesBlock(...)` joined with `\n\n` | `systemPrompt: string` |
| **Connection** | `settings.connections`, selected by `defaultConnectionId` or `ai-llm` frontmatter key; optionally model-overridden by `ai-model` | `resolveConnection` → `validateConnection` → `createLlmClient(connection, timeoutMs)` | `LlmClient` instance |

These three feed `client.generateResult({ systemPrompt, userContent })` ([insertResult.ts](../../src/commands/insertResult.ts)).

## What gets inserted

The block assembled at the end of `runRequest` follows this exact layout:

```
\n\n
[debug block, only if settings.debug]
## <llmResultHeading>     ← omitted if heading is empty after trim
\n\n
<result>
\n
```

The debug block (when enabled) contains:

```
## AI Request (debug)

**Connection:** <connection.name>
**Provider:** <connection.provider>
**Model:** <connection.model or "(default)">

### System prompt

```text
<systemPrompt>
```

### User content

```text
<expanded>
```
```

The fenced ` ```text ` blocks ensure that any Markdown inside the system prompt or user content is not re-rendered by Obsidian — see [Debug mode](../03-features/debug-mode.md).

## Insertion target

`settings.insertPosition` selects exactly one of three Editor API calls:

- `"end-of-file"` → `editor.replaceRange(block, { line: lastLine + 1, ch: 0 })`
- `"at-cursor"` → `editor.replaceSelection(block)` (replaces the selection)
- `"after-selection"` → `editor.replaceRange(block, { line: cursor.line + 1, ch: 0 })` where `cursor` is `getCursor("to")`

See [insertResult.ts](../../src/commands/insertResult.ts) for the dispatch.
