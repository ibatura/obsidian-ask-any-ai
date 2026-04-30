# Architecture documentation

This folder is the architecture-level technical reference for the **AI Assistant** Obsidian plugin. It is written for developers and AI agents who need to understand *how the plugin is built* — not how to install or use it.

It is intended to be **self-contained**: every architectural fact, design rationale, and behavioural detail needed to understand or evolve the plugin lives here, alongside links into [`src/`](../src/) for the canonical implementation.

## How this folder relates to the rest of the repo

| Location | Purpose | Status |
|---|---|---|
| [README.md](../README.md) | End-user install, setup, usage | User-facing |
| [AGENTS.md](../AGENTS.md) | Coding conventions, build/test commands, policies | Authoritative for *rules* |
| [CLAUDE.md](../CLAUDE.md) | Claude Code agent pointer file | Agent config |
| **`documentation/`** *(this folder)* | **Architecture, module map, data flow** | **Authoritative for *structure*** |

## Table of contents

### 01 — Overview
- [System context](01-overview/system-context.md) — what the plugin does, runtime context, constraints

### 02 — Architecture
- [Module map](02-architecture/module-map.md) — folder-by-folder map of `src/` and dependency graph
- [Plugin lifecycle](02-architecture/plugin-lifecycle.md) — `onload` / `onunload`, settings load, command registration
- [Command pipeline](02-architecture/command-pipeline.md) — end-to-end flow of *Ask AI*
- [Settings model](02-architecture/settings-model.md) — `AiAssistantSettings` shape, defaults, migration
- [Data flow](02-architecture/data-flow.md) — input → expansion → LLM → insertion

### 03 — Features
- [LLM providers](03-features/llm-providers.md) — Copilot, Claude, Claude-proxy, Gemini, CLI
- [Link resolution](03-features/link-resolution.md) — wikilink expansion algorithm
- [Prompt resolution](03-features/prompt-resolution.md) — none / inline / picker modes
- [Note-names context](03-features/note-names-context.md) — vault enumeration, glob exclusions
- [Progress indicator](03-features/progress-indicator.md) — controller, percentages, error states
- [Debug mode](03-features/debug-mode.md) — inserting the request payload alongside the response

### 05 — References
- [Glossary](05-references/glossary.md) — plugin-specific terminology
