import { describe, it, expect } from 'vitest';
import { createLlmClient } from './llmClient';
import { LlmConnection, generateConnectionId } from '../settings';

function makeConn(provider: LlmConnection["provider"]): LlmConnection {
  return {
    id: generateConnectionId(),
    name: "Test",
    provider,
    model: "",
    baseUrl: "",
    apiKey: "",
    cliCommand: "echo",
    cliArgs: "",
    cliCwd: "",
  };
}

describe("LLM Client Factory", () => {
  it("should create Copilot client when provider is copilot", () => {
    const client = createLlmClient(makeConn("copilot"), 30000);
    expect(client.constructor.name).toBe("CopilotClient");
  });

  it("should create Claude client when provider is claude", () => {
    const client = createLlmClient(makeConn("claude"), 30000);
    expect(client.constructor.name).toBe("ClaudeClient");
  });

  it("should create Gemini client when provider is gemini", () => {
    const client = createLlmClient(makeConn("gemini"), 30000);
    expect(client.constructor.name).toBe("GeminiClient");
  });

  it("should create CLI client when provider is cli", () => {
    const client = createLlmClient(makeConn("cli"), 30000);
    expect(client.constructor.name).toBe("CliClient");
  });
});
