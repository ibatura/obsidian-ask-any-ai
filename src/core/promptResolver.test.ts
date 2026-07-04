import { describe, it, expect } from "vitest";
import { resolveInlinePrompt } from "./promptResolver";
import { AskAnyAiSettings } from "../settings";

describe("resolveInlinePrompt", () => {
  const baseSettings: Partial<AskAnyAiSettings> = {
    llmInlinePrompt: "inline prompt test",
    llmIncludeInlineSystemPrompt: true,
  };

  it("returns the inline prompt when toggle is on", () => {
    const settings = { ...baseSettings, llmIncludeInlineSystemPrompt: true } as AskAnyAiSettings;
    expect(resolveInlinePrompt(settings)).toBe("inline prompt test");
  });

  it("returns empty string when toggle is off", () => {
    const settings = { ...baseSettings, llmIncludeInlineSystemPrompt: false } as AskAnyAiSettings;
    expect(resolveInlinePrompt(settings)).toBe("");
  });

  it("falls back to default prompt when llmInlinePrompt is empty and toggle is on", () => {
    const settings = { llmInlinePrompt: "", llmIncludeInlineSystemPrompt: true } as AskAnyAiSettings;
    expect(resolveInlinePrompt(settings)).toContain("expert assistant");
  });

  it("returns empty string when llmInlinePrompt is empty and toggle is off", () => {
    const settings = { llmInlinePrompt: "", llmIncludeInlineSystemPrompt: false } as AskAnyAiSettings;
    expect(resolveInlinePrompt(settings)).toBe("");
  });
});
