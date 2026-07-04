# Ask Any AI 1.0.0

First public release. Ask Any AI adds a single **Ask AI** workflow to Obsidian: select text, run a command, and get a response from your LLM of choice inserted back into the note — with `[[wikilinks]]` expanded, your own system prompts, and support for multiple named connections across five provider types.

## Highlights

- **Two commands** — **Ask AI** sends the current selection (or line) with an inline system prompt. **Ask AI with template** opens a picker over a folder of prompt files, using the chosen file as the system prompt for that run only.
- **Five providers** — GitHub Copilot (or any OpenAI-compatible endpoint), Anthropic Claude, Claude via an OpenAI-compatible proxy (OpenRouter, Together, internal gateways), Google Gemini, and any local CLI tool (`claude`, `llm`, `gemini`, or anything that reads stdin/writes stdout).
- **Multiple named connections** — configure several LLM connections side by side, each with its own provider, model, and credentials, and pick a default.
- **Wikilink expansion** — `[[Note]]`, `[[Note#Heading]]`, and `[[Note#^block]]` are resolved and inlined into the request before it's sent.
- **Template frontmatter overrides** — add `ai-*` YAML keys (`ai-llm`, `ai-model`, `ai-result-heading`, `ai-insert-position`, `ai-debug`, and more) to a template file to override settings for a single invocation, with validation and graceful fallback. Global settings are never mutated.
- **Vault-aware context** — optionally append a list of vault note names (with glob exclusions and alias support) to the system prompt so the LLM can emit resolvable wikilinks.
- **Configurable insertion** — after the selection, at the cursor, or at the end of the file, with an optional, customizable result heading.
- **Debug mode** — prepend the exact request payload (provider, model, prompts) to the result to see what was sent.
- **No telemetry, no cloud account, no remote auto-update** — the only network traffic is the explicit LLM request you trigger.

## Providers at a glance

| Provider | Wire format | Auth |
|---|---|---|
| Copilot | OpenAI Chat Completions | `Authorization: Bearer` |
| Claude | Anthropic Messages | `x-api-key` |
| Claude (proxy) | OpenAI Chat Completions | `Authorization: Bearer` |
| Gemini | Gemini `generateContent` | API key in query string |
| Local CLI | stdin/stdout subprocess | — |

## Requirements

- Obsidian 1.5.0 or later.
- Desktop only (macOS, Windows, Linux) — the local CLI provider uses Node's `child_process`.
- An API key for one of the hosted providers, or a local CLI tool on your `PATH`.

## Installation

1. **Settings → Community plugins → Browse**, search for *Ask Any AI*, install, enable.
2. Or manually: download `main.js`, `manifest.json`, and `styles.css` from this release and copy them into `<Vault>/.obsidian/plugins/ask-any-ai/`.

## Privacy & security

- Network requests go only to the provider you configure, only when you invoke a command.
- Nothing is uploaded automatically — vault content is sent only when it's part of your selection, pulled in via wikilink expansion, or explicitly included via the vault note names setting.
- API keys are stored locally in `<Vault>/.obsidian/plugins/ask-any-ai/data.json`.

## Documentation

See the [README](README.md) for full configuration details and [`documentation/`](documentation/README.md) for architecture notes.

**Full Changelog**: https://github.com/ibatura/obsidian-ai-assistant/commits/1.0.0
