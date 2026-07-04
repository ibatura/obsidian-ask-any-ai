# Ask Any AI for Obsidian

Run any LLM from inside your note. Select text, hit a hotkey, get the result inserted in place — with `[[wikilinks]]` automatically expanded, your own system prompts, and support for multiple named connections across five provider types.

> **Status**: desktop-only · Obsidian ≥ 1.5.0 · `id: ask-any-ai`

---

## Quick start

1. Install the plugin (see [Installation](#installation)).
2. Open **Settings → Ask Any AI**. A default "Default" connection (Copilot) is pre-configured — fill in the API key, or add a new connection for a different provider.
3. In any note, select a sentence and run **Ask AI** from the command palette (`Ctrl/Cmd+P`).
4. The result is inserted just below your selection under an `## AI Result` heading.

---

## What it does

Two commands share the same core pipeline:

- **Ask AI** — uses the inline system prompt (or no prompt) and sends immediately.
- **Ask AI with template** — opens a picker so you choose a `.md` file from your prompts folder. The file body becomes the system prompt; its YAML frontmatter can override per-run settings (model, provider, insertion position, and more).

Both commands:

1. Read the **selection** (or the current line if nothing is selected).
2. **Expand `[[wikilinks]]`** in the input — `[[Note]]`, `[[Note#Heading]]`, or `[[Note#^block]]` — replacing them with the linked content before anything is sent to the LLM.
3. Optionally append a list of **vault note names** to the system prompt so the LLM can write back resolvable wikilinks.
4. Send the request to your configured provider.
5. Insert the response into the note at the position you chose (after the selection, replacing the selection, or at the end of the file).

A persistent progress notice shows where you are in the pipeline and how long it has taken.

---

## Features

- **Five providers** — GitHub Copilot (any OpenAI-compatible endpoint), Anthropic Claude, Claude via OpenAI-compatible proxies (OpenRouter, Together, internal gateways), Google Gemini, and any local CLI (`claude`, `llm`, `gemini`, …).
- **Two commands** — **Ask AI** (inline prompt) and **Ask AI with template** (picker + optional frontmatter overrides).
- **Template frontmatter overrides** — add `ai-llm`, `ai-model`, `ai-insert-position`, and other `ai-*` YAML keys to any template file to override plugin settings for that single invocation. Invalid values warn and fall back gracefully; global settings are never mutated.
- **Wikilink expansion** with full support for nested heading paths (`#A#B`) and block references (`#^id`).
- **Vault-aware context** — optionally include a list of vault note names in the system prompt with glob-based exclusions (`Untitled*`, `Daily/*`, …) and optional alias rendering so the LLM can emit wikilinks that resolve.
- **Three insertion positions** — after selection (default), at cursor / replacing the selection, or end of file.
- **Configurable result heading** — set it to `AI Result`, leave blank to disable, or use any heading you like.
- **Debug mode** — prepend the exact request payload (provider, model, system prompt, user content) to the result so you can see what was sent.
- **Timeout** — applies to the local CLI provider (default 60 s).
- **No telemetry, no cloud account, no remote auto-update** — only the explicit LLM request leaves your machine.

---

## Requirements

- Obsidian **1.5.0** or later.
- **Desktop platform** (macOS, Windows, Linux). The CLI provider uses Node `child_process`, so the plugin is desktop-only.
- One of:
  - An API key for **Copilot** (or any OpenAI-compatible service), **Claude**, **a Claude proxy**, or **Gemini**, *or*
  - A **local CLI** tool installed and on your `PATH` (`claude`, `llm`, `gemini`, or any tool that reads from stdin and writes to stdout).

---

## Installation

### From the community plugin store

**Settings → Community plugins → Browse**, search for *Ask Any AI*, install, enable.

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from a release.
2. Copy them into `<Vault>/.obsidian/plugins/ask-any-ai/`.
3. Reload Obsidian and enable the plugin in **Settings → Community plugins**.

---

## Configuration

Open **Settings → Ask Any AI**. The settings tab has four sections.

### 1. LLM connections

Manage one or more named LLM connections. Each connection has:

- **Name** — a label you can reference in templates with `ai-llm: <Name>`.
- **Provider** — `Copilot`, `Claude`, `Claude (proxy)`, `Gemini`, or `Local CLI`.
- **Default model** — leave blank to use the provider's built-in default (`gpt-4.1-mini`, `claude-sonnet-4-20250514`, `gemini-2.0-flash`). Claude proxies require an explicit model (e.g. `anthropic/claude-3.7-sonnet` for OpenRouter).
- **Credential fields** (vary by provider):

| Provider | Fields |
|---|---|
| Copilot | Base URL + API key |
| Claude | Base URL (defaults to `https://api.anthropic.com`) + API key |
| Claude (proxy) | Base URL + API key (Bearer token) |
| Gemini | Base URL (defaults to `https://generativelanguage.googleapis.com`) + API key |
| Local CLI | Command, optional args, optional working directory |

- **Set as default** — the connection used when no template specifies `ai-llm`.
- **Remove** — deletes the connection (at least one must remain).

Use **+ Add connection** to create additional connections. Use **Request timeout** to set the maximum wait time for CLI responses.

### 2. System prompt & templates

- **System prompt** — the fixed prompt used by **Ask AI**. A toggle lets you skip sending it without clearing it.
- **Prompts templates folder** — vault-relative folder scanned by **Ask AI with template** for `.md` files (default: `Prompts/AI`).

When the include-system-prompt toggle is on, **Ask AI with template** prepends the inline prompt before the template body.

### 3. Vault note names context

Optional. When on, the plugin appends a Markdown block listing every note in the vault to the system prompt, plus an instruction telling the LLM to wrap matches in `[[...]]`. **Exclusions** is a list of glob patterns:

- `Untitled*` — any note starting with "Untitled".
- `Screenshot*` — any clipboard-image note.
- `Daily/2024-*` — folder-scoped pattern (uses `/`).

**Include note aliases** — when enabled, each note's frontmatter aliases are listed alongside it (`Note Name (aka: alias1, alias2)`), letting the LLM use either name.

### 4. Result insertion

- **Result heading** — Markdown heading inserted before the response. Empty string disables it.
- **Insert position** — `After selection` (default), `At cursor`, or `End of file`.
- **Debug** — prepend a debug block showing the exact provider, model, system prompt, and user content sent.

---

## Usage

Select text in any note and run **Ask AI** from the command palette (`Ctrl/Cmd+P`). If the selection is empty, the current line is used.

You can bind the command to a hotkey under **Settings → Hotkeys**.

### Example: a wikilink-expanded request

Imagine `Project Brief.md` exists in your vault. In a different note, type and select:

```
Summarise [[Project Brief]] in three bullets.
```

When you run the command:

1. `[[Project Brief]]` is replaced with the full content of `Project Brief.md`.
2. The expanded text is sent to your provider.
3. The summary is inserted under `## AI Result` (or your configured heading).

### Ask AI with template

Run **Ask AI with template** to open a modal showing every `.md` file in your prompts folder plus a "None" option. Pick a file to use it as the system prompt for *this* invocation only — no settings are mutated.

#### Template frontmatter overrides

Add `ai-*` YAML keys to the template's frontmatter to override settings for that single run:

```yaml
---
ai-llm: Work Claude
ai-model: claude-haiku-4-5-20251001
ai-result-heading: Translation
ai-insert-position: end-of-file
ai-include-note-names: true
---
You are a professional translator. Translate the following to French.
```

`ai-llm` selects a connection by name; `ai-model` overrides its model for this run. Supported keys: `ai-llm`, `ai-model`, `ai-result-heading`, `ai-insert-position`, `ai-debug`, `ai-include-inline-prompt`, `ai-include-note-names`, `ai-include-note-aliases`.

Invalid values warn and fall back to the global setting; the warning is shown in a single notice. See [`documentation/03-features/template-overrides.md`](documentation/03-features/template-overrides.md) for the full reference.

---

## Providers in detail

| Provider | Endpoint | Wire format | Auth |
|---|---|---|---|
| **Copilot** | `<baseUrl>/v1/chat/completions` | OpenAI Chat Completions | `Authorization: Bearer <key>` |
| **Claude** | `<baseUrl>/v1/messages` | Anthropic Messages | `x-api-key: <key>` |
| **Claude (proxy)** | `<baseUrl>/v1/chat/completions` | OpenAI Chat Completions | `Authorization: Bearer <key>` |
| **Gemini** | `<baseUrl>/v1beta/models/<model>:generateContent` | Gemini `generateContent` | API key in query string |
| **Local CLI** | subprocess | `systemPrompt + "\n\n" + userContent` piped to stdin | — |

For the local CLI provider, the plugin spawns the configured command with `shell: false`. Args are split on whitespace; complex quoting requires a wrapper script.

---

## Privacy and security

- Network requests are made **only** to the provider you configure, only when you invoke the command.
- Nothing is uploaded automatically. Vault content is sent to the provider only when it is part of the input you select (or when wikilink expansion pulls in a referenced note, or when "vault note names context" is on).
- API keys are stored locally via Obsidian's plugin data store (`<Vault>/.obsidian/plugins/ask-any-ai/data.json`).
- No telemetry, no analytics, no remote auto-update.

---

## Documentation

- **Architecture, module map, data flow, feature internals** — [`documentation/`](documentation/README.md).
- **Coding conventions and policies** — [`AGENTS.md`](AGENTS.md).

---

## Development

```bash
npm install
npm run dev    # esbuild watch — rebuilds main.js on every change
npm run build  # tsc --noEmit + esbuild production build
npm test       # vitest run
npm run lint   # eslint
```

To test inside a vault, symlink the repo into `<Vault>/.obsidian/plugins/ask-any-ai/`, run `npm run dev`, and reload Obsidian (`Ctrl/Cmd+R`) after changes.

See [`AGENTS.md`](AGENTS.md) for the full project conventions.

---

## License

[GNU GPLv3](LICENSE)
