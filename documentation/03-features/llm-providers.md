# LLM providers

Five concrete providers implement the `LlmClient` interface defined in [src/core/llmClient.ts](../../src/core/llmClient.ts). The factory `createLlmClient` ([llmClient.ts:264](../../src/core/llmClient.ts:264)) maps `settings.llmProvider` to the correct class.

## Provider matrix

| Provider | Class | Endpoint / mechanism | Auth | Default model | Lines |
|---|---|---|---|---|---|
| `copilot` | `CopilotClient` | `<baseUrl>/v1/chat/completions` (POST) | `Authorization: Bearer <key>` | `gpt-4.1-mini` | [llmClient.ts:18](../../src/core/llmClient.ts:18) |
| `claude` | `ClaudeClient` | `<baseUrl or anthropic>/v1/messages` (POST) | `x-api-key: <key>`, `anthropic-version: 2023-06-01` | `claude-sonnet-4-20250514` | [llmClient.ts:52](../../src/core/llmClient.ts:52) |
| `claude-proxy` | `ClaudeProxyClient` | `<baseUrl>/v1/chat/completions` (POST) | `Authorization: Bearer <key>` | *(none — throws if empty)* | [llmClient.ts:98](../../src/core/llmClient.ts:98) |
| `gemini` | `GeminiClient` | `<baseUrl or googleapis>/v1beta/models/<model>:generateContent?key=<key>` (POST) | API key in query string | `gemini-2.0-flash` | [llmClient.ts:139](../../src/core/llmClient.ts:139) |
| `cli` | `CliClient` | `spawn(command, args)` + stdin pipe | — | — | [llmClient.ts:184](../../src/core/llmClient.ts:184) |

## Common interface

[llmClient.ts:5](../../src/core/llmClient.ts:5)

```ts
interface LlmRequest { systemPrompt: string; userContent: string; }
interface LlmClient { generateResult(req: LlmRequest): Promise<string>; }
```

All HTTP clients use Obsidian's `requestUrl` ([llmClient.ts:2](../../src/core/llmClient.ts:2)) with `throw: true` so non-2xx responses propagate as errors. None of the clients stream — every response is read as a single JSON object.

## Wire formats

### Copilot (OpenAI Chat Completions)

[llmClient.ts:25](../../src/core/llmClient.ts:25)

```json
{
  "model": "<llmModel or gpt-4.1-mini>",
  "messages": [
    { "role": "system", "content": "<systemPrompt>" },
    { "role": "user",   "content": "<userContent>" }
  ]
}
```

Response extraction: `data.choices[0].message.content.trim()` ([llmClient.ts:45](../../src/core/llmClient.ts:45)).

### Claude (Anthropic Messages)

[llmClient.ts:59](../../src/core/llmClient.ts:59)

```json
{
  "model": "<llmModel or claude-sonnet-4-20250514>",
  "max_tokens": 4096,
  "system": "<systemPrompt>",
  "messages": [
    { "role": "user", "content": "<userContent>" }
  ]
}
```

Response extraction: filters `content[]` blocks where `type === "text"`, joins their `.text`, trims ([llmClient.ts:82](../../src/core/llmClient.ts:82)).

### Claude proxy (OpenAI-compatible gateway)

Same wire format as Copilot — used for OpenRouter, Together, internal gateways. The only behavioural difference: **no fallback model** ([llmClient.ts:102](../../src/core/llmClient.ts:102)) — the client throws so the user is forced to pick a proxy-specific model ID like `anthropic/claude-3.7-sonnet`. This is intentional: silently substituting a default would surprise users who expect their proxy-routed model to be used.

The provider is registered as a top-level entry in `LlmProvider` rather than an auth variant of `claude` so the factory and validator can treat it independently.

### Gemini

[llmClient.ts:147](../../src/core/llmClient.ts:147)

```json
{
  "system_instruction": { "parts": [{ "text": "<systemPrompt>" }] },
  "contents": [
    { "role": "user", "parts": [{ "text": "<userContent>" }] }
  ]
}
```

Response extraction: maps `candidates[0].content.parts[].text` and joins ([llmClient.ts:170](../../src/core/llmClient.ts:170)).

### CLI

[llmClient.ts:184](../../src/core/llmClient.ts:184)

The CLI client is the only provider that crosses the process boundary. It:

1. Validates `cliCommand` is non-empty.
2. Splits `cliArgs` on whitespace ([llmClient.ts:195](../../src/core/llmClient.ts:195)) — *no shell, no quoting*. Users who need quoted arguments must wrap the command in a shell script.
3. Spawns with `shell: false` and `stdio: ["pipe", "pipe", "pipe"]` ([llmClient.ts:209](../../src/core/llmClient.ts:209)).
4. Pipes `systemPrompt + "\n\n" + userContent` (or just `userContent` when no system prompt) to stdin and closes it ([llmClient.ts:203](../../src/core/llmClient.ts:203)).
5. Concatenates stdout into a buffer; uses stderr for error context.
6. Enforces `timeoutMs` via `setTimeout` + `child.kill("SIGKILL")` ([llmClient.ts:218](../../src/core/llmClient.ts:218)).
7. On `close`, resolves with `stdout.trim()` if exit code 0; otherwise rejects with `stderr` (or stdout) as the message.

The `settled` flag at [llmClient.ts:208](../../src/core/llmClient.ts:208) guards against double-resolution from racing `error` / `close` / timeout events.

## Factory

[llmClient.ts:264](../../src/core/llmClient.ts:264)

```ts
switch (settings.llmProvider) {
  case "copilot":      return new CopilotClient(settings);
  case "claude":       return new ClaudeClient(settings);
  case "claude-proxy": return new ClaudeProxyClient(settings);
  case "gemini":       return new GeminiClient(settings);
  case "cli":          return new CliClient(settings);
  default: { const _exhaustive: never = settings.llmProvider; throw ... }
}
```

The `_exhaustive: never` assignment forces a TypeScript error if `LlmProvider` ever gains a new member without a matching `case`.

## Validation (separate from clients)

Credential and URL validation is centralised in `validateProviderSettings` at [insertResult.ts:20](../../src/commands/insertResult.ts:20). It runs *before* `createLlmClient` so the user sees a focused error message instead of a generic HTTP failure.

| Provider | Validation rule |
|---|---|
| Copilot | base URL must be `http(s)`; key required |
| Claude | base URL optional, but if present must be `http(s)`; key required |
| Claude proxy | base URL must be `http(s)`; key required |
| Gemini | base URL optional, but if present must be `http(s)`; key required |
| CLI | `cliCommand` must be non-empty after trim |
