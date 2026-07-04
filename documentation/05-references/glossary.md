# Glossary

Plugin-specific terms used throughout this documentation and the code.

| Term | Definition |
|---|---|
| **Provider** | One of the five LLM backends: `copilot`, `claude`, `claude-proxy`, `gemini`, `cli`. Stored as `connection.provider` in a `LlmConnection`. See [LLM providers](../03-features/llm-providers.md). |
| **Connection** | A named, user-configured LLM endpoint stored as a `LlmConnection` in `settings.connections`. The active connection is chosen by `defaultConnectionId` or overridden per-template with `ai-llm`. |
| **Provider client** | Concrete class implementing `LlmClient` for one provider — e.g. `CopilotClient`, `CliClient`. Built by `createLlmClient(connection, timeoutMs)` ([llmClient.ts:264](../../src/core/llmClient.ts:264)). |
| **Prompt mode** | One of `none`, `inline`, `picker` — controls where the system prompt comes from. See [Prompt resolution](../03-features/prompt-resolution.md). |
| **Picker** | The runtime modal ([promptPickerModal.ts](../../src/ui/promptPickerModal.ts)) that lets the user pick a `.md` file from `llmPromptsFolder` as the system prompt at the moment the command runs. |
| **Inline prompt** | A user-edited string saved in `settings.llmInlinePrompt`, used as the system prompt when prompt mode is `inline` and `llmIncludeInlineSystemPrompt` is true. |
| **Wikilink fragment** | The part after `#` in `[[Note#fragment]]`. Two flavours: a *heading path* like `Outer#Inner` (resolved by `extractByHeadingPath`) or a *block reference* starting with `^` like `^para1` (resolved by `extractByBlockId`). |
| **Heading path** | A multi-part fragment such as `A#B` that targets the `B` heading nested inside `A`. Walked left-to-right; section ends at the next heading of equal or lower level. |
| **Block reference** | A wikilink fragment starting with `^`, targeting an Obsidian block ID. The whole block (typically a paragraph or list item) is extracted. |
| **Note-names block** | The optional Markdown block appended to the system prompt when `includeVaultNoteNames` is on. Lists every non-excluded vault note plus an instruction to wrap matches in `[[...]]`. See [Note-names context](../03-features/note-names-context.md). |
| **Exclusion pattern** | A glob string in `vaultNoteNamesExclusions`. Patterns without `/` match basename; patterns with `/` match the vault-relative path. `*`, `**`, `?` are supported. |
| **Insert position** | Where the result block lands in the editor: `at-cursor` (replaces selection), `after-selection` (next line down), or `end-of-file`. |
| **Result heading** | The Markdown heading inserted before the response. Configured by `llmResultHeading`; an empty string disables it. |
| **Debug block** | A Markdown block emitted before the result when `settings.debug` is on, echoing the final system prompt + user content sent to the provider. Wrapped in ` ```text ` fences so its content is not re-rendered. See [Debug mode](../03-features/debug-mode.md). |
| **Progress controller** | The object returned by `showProgressIndicator(initial)` ([progressIndicator.ts:15](../../src/ui/progressIndicator.ts:15)). Drives the `Notice`-based progress UI through `updateStatus` / `complete` / `close`. |
| **CLI provider** | A local subprocess (`claude`, `llm`, `gemini`, etc.) spawned by `CliClient` with stdin/stdout piping. Requires the plugin to run in a Node-enabled context (`isDesktopOnly: true`). |
| **`requestUrl`** | Obsidian's CORS-safe HTTP helper used by all four HTTP providers. Configured with `throw: true` so non-2xx responses raise an error. |
| **Settings tab** | The Obsidian settings page rendered by `AskAnyAiSettingTab` ([src/ui/settingsTab.ts](../../src/ui/settingsTab.ts)). Four logical sections; saves on every change. |
| **SDD** | Spec-Driven Development — the repo's feature workflow: proposal → design → tasks → execution. Defined in [AGENTS.md](../../AGENTS.md). |
