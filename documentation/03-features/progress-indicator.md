# Progress indicator

`showProgressIndicator` in [src/ui/progressIndicator.ts](../../src/ui/progressIndicator.ts) renders an Obsidian `Notice`-based progress UI for the duration of one command run.

## Public API

[progressIndicator.ts:3](../../src/ui/progressIndicator.ts:3)

```ts
interface ProgressController {
  updateStatus(text: string, percent: number, isError?: boolean): void;
  complete(): void;
  close(): void;
}

function showProgressIndicator(initialMessage: string): ProgressController
```

The factory returns a controller that the caller drives through the pipeline.

## DOM structure

[progressIndicator.ts:21](../../src/ui/progressIndicator.ts:21) builds this inside the persistent `Notice`:

```
.ai-progress-wrapper
├── .ai-progress-status         ← text label
├── .ai-progress-bar-container
│   └── .ai-progress-bar-fill   ← width = percent%; colour switches on error
└── .ai-progress-elapsed        ← "0.0s elapsed", updated every 200 ms
```

Styling lives in [styles.css](../../styles.css) at the project root — the plugin file ships it alongside `main.js` and `manifest.json`.

## Lifecycle

| Method | Effect |
|---|---|
| `showProgressIndicator(initial)` | Creates the persistent `Notice` (`new Notice("", 0)` ⇒ no auto-hide), starts the elapsed-time interval (200 ms) |
| `updateStatus(text, percent, isError?)` | Updates the label and bar width; bar colour becomes `var(--color-red)` when `isError === true` |
| `complete()` | Sets status to `"Done. Result inserted."` at 100 %, clears the interval, hides the notice after 1 s |
| `close()` | Clears the interval and hides the notice immediately (no completion message) |

## Where it is driven

The controller is created at [insertResult.ts:79](../../src/commands/insertResult.ts:79) and the percentages used throughout the pipeline are:

| Step | Percent |
|---|---|
| Expanding links | 10 |
| Loading system prompt | 20 |
| Building note list (optional) | 25 |
| Sending to provider | 30 |
| Waiting for response | 50 |
| Processing response | 85 |
| Inserting result | 95 |
| Done | 100 |

Validation failures and the empty-result path call `progress.close()` ([insertResult.ts:108](../../src/commands/insertResult.ts:108), [insertResult.ts:124](../../src/commands/insertResult.ts:124)) so the notice disappears immediately. The catch-all in `try { ... } catch (e) { ... progress.close() ... }` ([insertResult.ts:166](../../src/commands/insertResult.ts:166)) does the same on any thrown error.

## Headless / test fallback

[progressIndicator.ts:16](../../src/ui/progressIndicator.ts:16)

```ts
if (typeof document === "undefined") return noop;
```

In a non-DOM environment (Vitest in particular), the controller becomes a no-op that satisfies the interface. This lets `insertLlmResultInPlace` be unit-tested without a fake Obsidian DOM.

## Self-contained timer

The 200 ms elapsed-time interval is owned by the controller — both `complete()` and `close()` call `cleanup()` to clear it. Because the controller is created per command run, there is no leak across runs even when the user spams the command.
