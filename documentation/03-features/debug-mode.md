# Debug mode

When `settings.debug` is `true`, the plugin prepends a debug block to the inserted output. This shows the *exact* request that was sent to the provider — useful when iterating on prompts or diagnosing why the LLM is misbehaving.

## Where it is built

[src/commands/insertResult.ts:134](../../src/commands/insertResult.ts:134)

```ts
if (settings.debug) {
  const model = connection.model.trim() || "(default)";
  const systemBlock = systemPrompt.trim()
    ? "```text\n" + systemPrompt + "\n```"
    : "_(empty)_";
  block +=
    `## AI Request (debug)\n\n` +
    `**Connection:** ${connection.name}\n` +
    `**Provider:** ${connection.provider}\n` +
    `**Model:** ${model}\n\n` +
    `### System prompt\n\n${systemBlock}\n\n` +
    `### User content\n\n\`\`\`text\n${expanded}\n\`\`\`\n\n`;
}
```

The block is appended to the same `block` string that holds the heading + result, so it is inserted in a single editor write.

## Layout in the inserted output

```
\n\n
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

## <llmResultHeading>     ← only if heading is non-empty

<result>
```

## Why fenced ``` ```text ``` blocks

The system prompt and user content are inserted **verbatim** inside ` ```text ` fences so Obsidian does not re-render any Markdown they contain. Without the fence, an inline `[[Foo]]` in the user content would render as a clickable wikilink and an inline code block would change formatting — both of which would obscure what was actually sent.

The `text` language tag is intentional (rather than no language) so syntax highlighters do not attempt to colour the content.

## What is shown

| Field | Source |
|---|---|
| `Connection` | `connection.name` — the user-facing name of the resolved connection |
| `Provider` | `connection.provider` (raw enum value: `copilot`, `claude`, `claude-proxy`, `gemini`, `cli`) |
| `Model` | `connection.model.trim()`; falls back to literal string `"(default)"` when empty |
| `System prompt` | Final post-resolution prompt (after picker/inline/none + optional note-names append) |
| `User content` | Post-expansion content (after `expandObsidianLinks` replaces every `[[...]]`) |

The debug block reflects the **final** values just before the LLM request — i.e. **after** link expansion, **after** the note-names block has been appended. Anything not visible in the debug block was not sent to the provider.

## What is **not** shown

- API keys, cookies, request IDs, response headers — none of these appear in the block. Only the request body's logical contents are echoed.
- Provider-specific transformations like Claude's `max_tokens` or Gemini's `system_instruction` wrapping are **not** rendered — the debug block shows the *plugin-level* request shape, not the provider wire format. To inspect the wire format, use the browser/Obsidian devtools network tab.

## See also

- [Settings model — `debug` field](../02-architecture/settings-model.md)
