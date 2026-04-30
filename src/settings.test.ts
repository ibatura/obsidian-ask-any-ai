import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS } from "./settings";

describe("Settings Defaults", () => {
  it("should have copilot as the default provider", () => {
    expect(DEFAULT_SETTINGS.llmProvider).toBe("copilot");
  });

  it("should default the fallback prompt correctly", () => {
    expect(DEFAULT_SETTINGS.llmInlinePrompt).toContain("expert assistant");
  });

  it("should set insertPosition to after-selection by default", () => {
    expect(DEFAULT_SETTINGS.insertPosition).toBe("after-selection");
  });

  it("should expose the correct provider options", () => {
    const providers: Array<typeof DEFAULT_SETTINGS.llmProvider> = ["copilot", "claude", "gemini", "cli"];
    expect(providers).toContain(DEFAULT_SETTINGS.llmProvider);
  });

  it("should default llmPromptMode to picker", () => {
    expect(DEFAULT_SETTINGS.llmPromptMode).toBe("picker");
  });

  it("should accept none, inline, and picker as valid prompt modes", () => {
    const validModes: Array<typeof DEFAULT_SETTINGS.llmPromptMode> = ["none", "inline", "picker"];
    expect(validModes).toContain(DEFAULT_SETTINGS.llmPromptMode);
  });

  it("should default llmIncludeInlineSystemPrompt to true", () => {
    expect(DEFAULT_SETTINGS.llmIncludeInlineSystemPrompt).toBe(true);
  });
});
