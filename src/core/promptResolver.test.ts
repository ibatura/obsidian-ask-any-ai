import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveLlmPrompt } from "./promptResolver";
import { AiAssistantSettings } from "../settings";

describe("Prompt Resolver", () => {
  let mockApp: object;
  const dummySettings: Partial<AiAssistantSettings> = {
    llmInlinePrompt: "inline prompt test",
  };

  beforeEach(() => {
    mockApp = {};
  });

  it("returns inline prompt when mode is 'inline'", async () => {
    const settings = { ...dummySettings, llmPromptMode: "inline" } as AiAssistantSettings;
    const prompt = await resolveLlmPrompt(mockApp as any, settings);
    expect(prompt).toBe("inline prompt test");
  });

  it("returns empty string when mode is 'none'", async () => {
    const settings = { ...dummySettings, llmPromptMode: "none" } as AiAssistantSettings;
    const prompt = await resolveLlmPrompt(mockApp as any, settings);
    expect(prompt).toBe("");
  });

  it("returns inline prompt as fallback when mode is 'picker'", async () => {
    const settings = { ...dummySettings, llmPromptMode: "picker" } as AiAssistantSettings;
    const prompt = await resolveLlmPrompt(mockApp as any, settings);
    expect(prompt).toBe("inline prompt test");
  });

  it("uses default inline prompt when llmInlinePrompt is empty", async () => {
    const settings = { llmInlinePrompt: "", llmPromptMode: "inline" } as AiAssistantSettings;
    const prompt = await resolveLlmPrompt(mockApp as any, settings);
    expect(prompt).toContain("expert assistant");
  });

  it("returns inline prompt when mode is 'inline' and toggle is true", async () => {
    const settings = { ...dummySettings, llmPromptMode: "inline", llmIncludeInlineSystemPrompt: true } as AiAssistantSettings;
    const prompt = await resolveLlmPrompt(mockApp as any, settings);
    expect(prompt).toBe("inline prompt test");
  });

  it("returns empty string when mode is 'inline' and toggle is false", async () => {
    const settings = { ...dummySettings, llmPromptMode: "inline", llmIncludeInlineSystemPrompt: false } as AiAssistantSettings;
    const prompt = await resolveLlmPrompt(mockApp as any, settings);
    expect(prompt).toBe("");
  });

  it("toggle has no effect when mode is 'picker'", async () => {
    const settings = { ...dummySettings, llmPromptMode: "picker", llmIncludeInlineSystemPrompt: false } as AiAssistantSettings;
    const prompt = await resolveLlmPrompt(mockApp as any, settings);
    expect(prompt).toBe("inline prompt test");
  });

  it("toggle has no effect when mode is 'none'", async () => {
    const settings = { ...dummySettings, llmPromptMode: "none", llmIncludeInlineSystemPrompt: false } as AiAssistantSettings;
    const prompt = await resolveLlmPrompt(mockApp as any, settings);
    expect(prompt).toBe("");
  });
});
