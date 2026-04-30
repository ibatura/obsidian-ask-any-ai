import { describe, it, expect, vi } from 'vitest';
import { createLlmClient } from './llmClient';
import { AiAssistantSettings } from '../settings';

describe("LLM Client Factory", () => {
  const baseSettings: Partial<AiAssistantSettings> = {
    timeoutMs: 30000
  };

  it("should create Copilot client when provider is copilot", () => {
    const settings = { ...baseSettings, llmProvider: "copilot" } as AiAssistantSettings;
    const client = createLlmClient(settings);
    expect(client.constructor.name).toBe("CopilotClient");
  });

  it("should create Claude client when provider is claude", () => {
    const settings = { ...baseSettings, llmProvider: "claude" } as AiAssistantSettings;
    const client = createLlmClient(settings);
    expect(client.constructor.name).toBe("ClaudeClient");
  });

  it("should create Gemini client when provider is gemini", () => {
    const settings = { ...baseSettings, llmProvider: "gemini" } as AiAssistantSettings;
    const client = createLlmClient(settings);
    expect(client.constructor.name).toBe("GeminiClient");
  });

  it("should create CLI client when provider is cli", () => {
    const settings = { ...baseSettings, llmProvider: "cli" } as AiAssistantSettings;
    const client = createLlmClient(settings);
    expect(client.constructor.name).toBe("CliClient");
  });
});
