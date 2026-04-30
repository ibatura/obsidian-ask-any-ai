import { AiAssistantSettings } from "../settings";
import { requestUrl } from "obsidian";
import { spawn } from "child_process";

export interface LlmRequest {
  systemPrompt: string;
  userContent: string;
}

export interface LlmClient {
  generateResult(req: LlmRequest): Promise<string>;
}

/**
 * Copilot client — targets an OpenAI-compatible /v1/chat/completions endpoint
 * (e.g. GitHub Copilot proxy or any OpenAI-compatible service).
 */
export class CopilotClient implements LlmClient {
  constructor(private settings: AiAssistantSettings) {}

  async generateResult(req: LlmRequest): Promise<string> {
    const baseUrl = this.settings.copilotApiBaseUrl.replace(/\/+$/, "");
    const url = `${baseUrl}/v1/chat/completions`;

    const body = {
      model: this.settings.llmModel || "gpt-4.1-mini",
      messages: [
        { role: "system", content: req.systemPrompt },
        { role: "user", content: req.userContent },
      ],
    };

    const response = await requestUrl({
      url,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.settings.copilotApiKey}`,
      },
      body: JSON.stringify(body),
      throw: true,
    });

    const data = response.json;
    return data?.choices?.[0]?.message?.content?.trim() ?? "";
  }
}

/**
 * Claude client — uses the Anthropic Messages API.
 */
export class ClaudeClient implements LlmClient {
  constructor(private settings: AiAssistantSettings) {}

  async generateResult(req: LlmRequest): Promise<string> {
    const baseUrl = (this.settings.claudeApiBaseUrl || "https://api.anthropic.com").replace(/\/+$/, "");
    const url = `${baseUrl}/v1/messages`;

    const body = {
      model: this.settings.llmModel || "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: req.systemPrompt,
      messages: [
        { role: "user", content: req.userContent },
      ],
    };

    const response = await requestUrl({
      url,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.settings.claudeApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      throw: true,
    });

    const data = response.json;
    // Anthropic returns content as an array of blocks
    const blocks = data?.content;
    if (Array.isArray(blocks)) {
      return blocks
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("")
        .trim();
    }
    return "";
  }
}

/**
 * Claude proxy client — calls Claude through any OpenAI-compatible /v1/chat/completions
 * endpoint (e.g. OpenRouter, Together, an internal gateway) using Bearer auth.
 */
export class ClaudeProxyClient implements LlmClient {
  constructor(private settings: AiAssistantSettings) {}

  async generateResult(req: LlmRequest): Promise<string> {
    if (!this.settings.llmModel.trim()) {
      throw new Error(
        "Set a model ID for the Claude proxy provider " +
        "(e.g. anthropic/claude-3.7-sonnet for OpenRouter)."
      );
    }

    const baseUrl = this.settings.claudeProxyApiBaseUrl.replace(/\/+$/, "");
    const url = `${baseUrl}/v1/chat/completions`;

    const body = {
      model: this.settings.llmModel,
      messages: [
        { role: "system", content: req.systemPrompt },
        { role: "user", content: req.userContent },
      ],
    };

    const response = await requestUrl({
      url,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.settings.claudeProxyApiKey}`,
      },
      body: JSON.stringify(body),
      throw: true,
    });

    const data = response.json;
    return data?.choices?.[0]?.message?.content?.trim() ?? "";
  }
}

/**
 * Gemini client — uses the Gemini generateContent endpoint.
 */
export class GeminiClient implements LlmClient {
  constructor(private settings: AiAssistantSettings) {}

  async generateResult(req: LlmRequest): Promise<string> {
    const baseUrl = (this.settings.geminiApiBaseUrl || "https://generativelanguage.googleapis.com").replace(/\/+$/, "");
    const model = this.settings.llmModel || "gemini-2.0-flash";
    const url = `${baseUrl}/v1beta/models/${model}:generateContent?key=${this.settings.geminiApiKey}`;

    const body = {
      system_instruction: {
        parts: [{ text: req.systemPrompt }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: req.userContent }],
        },
      ],
    };

    const response = await requestUrl({
      url,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      throw: true,
    });

    const data = response.json;
    const parts = data?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      return parts.map((p: { text: string }) => p.text).join("").trim();
    }
    return "";
  }
}

/**
 * CLI client — spawns a local CLI tool (e.g., `claude`, `gemini`, `llm`) and
 * pipes the combined system+user prompt to stdin. Captures stdout as the result.
 *
 * Requires the plugin to run in a Node-enabled context (isDesktopOnly: true).
 */
export class CliClient implements LlmClient {
  constructor(private settings: AiAssistantSettings) {}

  async generateResult(req: LlmRequest): Promise<string> {
    const command = (this.settings.cliCommand || "").trim();
    if (!command) {
      throw new Error("CLI command is not configured");
    }

    // Naive whitespace split for args. For complex quoting, users can use a
    // wrapper script. This keeps the implementation simple and predictable.
    const args = (this.settings.cliArgs || "")
      .trim()
      .split(/\s+/)
      .filter((s) => s.length > 0);

    const cwd = (this.settings.cliCwd || "").trim() || undefined;
    const timeoutMs = this.settings.timeoutMs || 60000;

    const stdinPayload = req.systemPrompt
      ? `${req.systemPrompt}\n\n${req.userContent}`
      : req.userContent;

    return new Promise<string>((resolve, reject) => {
      let settled = false;
      const child = spawn(command, args, {
        cwd,
        stdio: ["pipe", "pipe", "pipe"],
        shell: false,
      });

      let stdout = "";
      let stderr = "";

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { child.kill("SIGKILL"); } catch { /* ignore */ }
        reject(new Error(`CLI command timed out after ${timeoutMs}ms: ${command}`));
      }, timeoutMs);

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });

      child.on("error", (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error(`Failed to spawn '${command}': ${err.message}`));
      });

      child.on("close", (code: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (code !== 0) {
          const detail = stderr.trim() || stdout.trim() || `exit code ${code}`;
          reject(new Error(`CLI '${command}' failed: ${detail}`));
          return;
        }
        resolve(stdout.trim());
      });

      try {
        child.stdin.write(stdinPayload);
        child.stdin.end();
      } catch (err) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }
}

export function createLlmClient(settings: AiAssistantSettings): LlmClient {
  switch (settings.llmProvider) {
    case "copilot":
      return new CopilotClient(settings);
    case "claude":
      return new ClaudeClient(settings);
    case "claude-proxy":
      return new ClaudeProxyClient(settings);
    case "gemini":
      return new GeminiClient(settings);
    case "cli":
      return new CliClient(settings);
    default: {
      const _exhaustive: never = settings.llmProvider;
      throw new Error(`Unknown LLM provider: ${String(_exhaustive)}`);
    }
  }
}
