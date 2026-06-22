import { LlmConnection } from "../settings";
import { requestUrl } from "obsidian";
import { spawn } from "child_process";

export interface LlmRequest {
  systemPrompt: string;
  userContent: string;
}

export interface LlmClient {
  generateResult(req: LlmRequest): Promise<string>;
}

export class CopilotClient implements LlmClient {
  constructor(private connection: LlmConnection) {}

  async generateResult(req: LlmRequest): Promise<string> {
    const baseUrl = this.connection.baseUrl.replace(/\/+$/, "");
    const url = `${baseUrl}/v1/chat/completions`;
    const body = {
      model: this.connection.model || "gpt-4.1-mini",
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
        Authorization: `Bearer ${this.connection.apiKey}`,
      },
      body: JSON.stringify(body),
      throw: true,
    });
    const data = response.json;
    return data?.choices?.[0]?.message?.content?.trim() ?? "";
  }
}

export class ClaudeClient implements LlmClient {
  constructor(private connection: LlmConnection) {}

  async generateResult(req: LlmRequest): Promise<string> {
    const baseUrl = (this.connection.baseUrl || "https://api.anthropic.com").replace(/\/+$/, "");
    const url = `${baseUrl}/v1/messages`;
    const body = {
      model: this.connection.model || "claude-sonnet-4-20250514",
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
        "x-api-key": this.connection.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      throw: true,
    });
    const data = response.json;
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

export class ClaudeProxyClient implements LlmClient {
  constructor(private connection: LlmConnection) {}

  async generateResult(req: LlmRequest): Promise<string> {
    if (!this.connection.model.trim()) {
      throw new Error(
        "Set a model ID for the Claude proxy provider " +
        "(e.g. anthropic/claude-3.7-sonnet for OpenRouter)."
      );
    }
    const baseUrl = this.connection.baseUrl.replace(/\/+$/, "");
    const url = `${baseUrl}/v1/chat/completions`;
    const body = {
      model: this.connection.model,
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
        Authorization: `Bearer ${this.connection.apiKey}`,
      },
      body: JSON.stringify(body),
      throw: true,
    });
    const data = response.json;
    return data?.choices?.[0]?.message?.content?.trim() ?? "";
  }
}

export class GeminiClient implements LlmClient {
  constructor(private connection: LlmConnection) {}

  async generateResult(req: LlmRequest): Promise<string> {
    const baseUrl = (this.connection.baseUrl || "https://generativelanguage.googleapis.com").replace(/\/+$/, "");
    const model = this.connection.model || "gemini-2.5-flash";
    const url = `${baseUrl}/v1beta/models/${model}:generateContent?key=${this.connection.apiKey}`;
const body: Record<string, unknown> = {
      contents: [
        {
          role: "user",
          parts: [{ text: req.userContent }],
        },
      ],
    };
    if (req.systemPrompt) {
      body.system_instruction = { parts: [{ text: req.systemPrompt }] };
    }
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

export class CliClient implements LlmClient {
  constructor(private connection: LlmConnection, private timeoutMs: number) {}

  async generateResult(req: LlmRequest): Promise<string> {
    const command = (this.connection.cliCommand || "").trim();
    if (!command) {
      throw new Error("CLI command is not configured");
    }

    const args = (this.connection.cliArgs || "")
      .trim()
      .split(/\s+/)
      .filter((s) => s.length > 0);

    const cwd = (this.connection.cliCwd || "").trim() || undefined;
    const timeoutMs = this.timeoutMs || 60000;

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

      child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
      child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });

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

export function createLlmClient(connection: LlmConnection, timeoutMs: number): LlmClient {
  switch (connection.provider) {
    case "copilot": return new CopilotClient(connection);
    case "claude": return new ClaudeClient(connection);
    case "claude-proxy": return new ClaudeProxyClient(connection);
    case "gemini": return new GeminiClient(connection);
    case "cli": return new CliClient(connection, timeoutMs);
    default: {
      const _exhaustive: never = connection.provider;
      throw new Error(`Unknown LLM provider: ${String(_exhaustive)}`);
    }
  }
}
