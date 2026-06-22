import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS } from "./settings";

describe("Settings Defaults", () => {
  it("should have one default connection", () => {
    expect(DEFAULT_SETTINGS.connections).toHaveLength(1);
    expect(DEFAULT_SETTINGS.connections[0].provider).toBe("copilot");
  });

  it("should default the fallback prompt correctly", () => {
    expect(DEFAULT_SETTINGS.llmInlinePrompt).toContain("expert assistant");
  });

  it("should set insertPosition to after-selection by default", () => {
    expect(DEFAULT_SETTINGS.insertPosition).toBe("after-selection");
  });

  it("should have defaultConnectionId matching the first connection", () => {
    expect(DEFAULT_SETTINGS.defaultConnectionId).toBe(DEFAULT_SETTINGS.connections[0].id);
  });

  it("should default llmIncludeInlineSystemPrompt to true", () => {
    expect(DEFAULT_SETTINGS.llmIncludeInlineSystemPrompt).toBe(true);
  });

  it("should have a default llmPromptsFolder", () => {
    expect(DEFAULT_SETTINGS.llmPromptsFolder).toBe("Prompts/AI");
  });

  it("should not contain llmPromptMode", () => {
    expect("llmPromptMode" in DEFAULT_SETTINGS).toBe(false);
  });
});
