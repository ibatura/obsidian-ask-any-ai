import { describe, it, expect } from "vitest";
import { migrateSettings } from "./settingsMigration";

describe("migrateSettings", () => {
  it("returns empty object for null input", () => {
    expect(migrateSettings(null)).toEqual({});
  });

  it("returns empty object for undefined input", () => {
    expect(migrateSettings(undefined)).toEqual({});
  });

  it("passes through data that already has connections", () => {
    const connections = [{ id: "abc", name: "Test", provider: "cli" }];
    const input = { connections, defaultConnectionId: "abc", timeoutMs: 30000 };
    const result = migrateSettings(input);
    expect(result.connections).toEqual(connections);
    expect(result.defaultConnectionId).toBe("abc");
    expect(result.timeoutMs).toBe(30000);
  });

  it("converts legacy copilot settings to one connection", () => {
    const input = {
      llmProvider: "copilot",
      llmModel: "gpt-4.1-mini",
      copilotApiBaseUrl: "https://api.githubcopilot.com",
      copilotApiKey: "tok-123",
    };
    const result = migrateSettings(input);
    const connections = result.connections as any[];
    expect(connections).toHaveLength(1);
    const conn = connections[0];
    expect(conn.provider).toBe("copilot");
    expect(conn.name).toBe("Copilot");
    expect(conn.model).toBe("gpt-4.1-mini");
    expect(conn.baseUrl).toBe("https://api.githubcopilot.com");
    expect(conn.apiKey).toBe("tok-123");
    expect(result.defaultConnectionId).toBe(conn.id);
  });

  it("converts legacy cli settings to one connection", () => {
    const input = {
      llmProvider: "cli",
      llmModel: "",
      cliCommand: "my-tool",
      cliArgs: "--flag",
      cliCwd: "/home/user",
    };
    const result = migrateSettings(input);
    const conn = (result.connections as any[])[0];
    expect(conn.provider).toBe("cli");
    expect(conn.name).toBe("Local CLI");
    expect(conn.cliCommand).toBe("my-tool");
    expect(conn.cliArgs).toBe("--flag");
    expect(conn.cliCwd).toBe("/home/user");
    expect(conn.baseUrl).toBe("");
    expect(conn.apiKey).toBe("");
  });

  it("converts legacy claude settings to one connection", () => {
    const input = {
      llmProvider: "claude",
      claudeApiKey: "sk-ant-abc",
      claudeApiBaseUrl: "https://api.anthropic.com",
    };
    const result = migrateSettings(input);
    const conn = (result.connections as any[])[0];
    expect(conn.provider).toBe("claude");
    expect(conn.name).toBe("Claude");
    expect(conn.apiKey).toBe("sk-ant-abc");
    expect(conn.baseUrl).toBe("https://api.anthropic.com");
  });

  it("removes all legacy fields after migration", () => {
    const input = {
      llmProvider: "copilot",
      llmModel: "gpt-4",
      copilotApiBaseUrl: "https://x.com",
      copilotApiKey: "tok",
      claudeApiBaseUrl: "",
      claudeApiKey: "",
      claudeProxyApiBaseUrl: "",
      claudeProxyApiKey: "",
      geminiApiBaseUrl: "",
      geminiApiKey: "",
      cliCommand: "echo",
      cliArgs: "",
      cliCwd: "",
    };
    const result = migrateSettings(input);
    const legacyFields = [
      "llmProvider", "llmModel",
      "copilotApiBaseUrl", "copilotApiKey",
      "claudeApiBaseUrl", "claudeApiKey",
      "claudeProxyApiBaseUrl", "claudeProxyApiKey",
      "geminiApiBaseUrl", "geminiApiKey",
      "cliCommand", "cliArgs", "cliCwd",
    ];
    for (const field of legacyFields) {
      expect(result).not.toHaveProperty(field);
    }
  });

  it("removes llmPromptMode from legacy data", () => {
    const result = migrateSettings({ llmPromptMode: "inline", llmProvider: "cli", cliCommand: "echo" });
    expect(result).not.toHaveProperty("llmPromptMode");
  });

  it("removes llmPromptMode even without legacy provider fields", () => {
    const connections = [{ id: "x", name: "Test", provider: "cli" }];
    const result = migrateSettings({ llmPromptMode: "none", connections, defaultConnectionId: "x" });
    expect(result).not.toHaveProperty("llmPromptMode");
    expect(result.connections).toEqual(connections);
  });

  it("preserves non-migration fields", () => {
    const input = {
      llmProvider: "cli",
      cliCommand: "echo",
      timeoutMs: 30000,
      llmResultHeading: "My Result",
      debug: true,
    };
    const result = migrateSettings(input);
    expect(result.timeoutMs).toBe(30000);
    expect(result.llmResultHeading).toBe("My Result");
    expect(result.debug).toBe(true);
  });

  it("generated connection id is unique per call", () => {
    const inputA = { llmProvider: "copilot", copilotApiKey: "a" };
    const inputB = { llmProvider: "copilot", copilotApiKey: "b" };
    const a = migrateSettings(inputA).connections as any[];
    const b = migrateSettings(inputB).connections as any[];
    expect(a[0].id).not.toBe(b[0].id);
  });
});
