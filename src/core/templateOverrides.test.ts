import { describe, it, expect } from "vitest";
import {
  parseTemplateOverrides,
  applyOverrides,
  stripFrontmatter,
} from "./templateOverrides";
import { AiAssistantSettings } from "../settings";

function makeSettings(overrides: Partial<AiAssistantSettings> = {}): AiAssistantSettings {
  return {
    llmProvider: "copilot",
    llmModel: "gpt-4.1-mini",
    timeoutMs: 60000,
    copilotApiBaseUrl: "https://api.githubcopilot.com",
    copilotApiKey: "tok-123",
    claudeApiBaseUrl: "",
    claudeApiKey: "",
    claudeProxyApiBaseUrl: "",
    claudeProxyApiKey: "",
    geminiApiBaseUrl: "",
    geminiApiKey: "",
    cliCommand: "echo",
    cliArgs: "",
    cliCwd: "",
    llmInlinePrompt: "You are an assistant.",
    llmIncludeInlineSystemPrompt: true,
    llmPromptsFolder: "Prompts/AI",
    llmResultHeading: "AI Result",
    insertPosition: "after-selection",
    includeVaultNoteNames: false,
    includeNoteAliases: false,
    vaultNoteNamesExclusions: ["Untitled*"],
    debug: false,
    ...overrides,
  };
}

// ── parseTemplateOverrides ────────────────────────────────────────────────────

describe("parseTemplateOverrides", () => {
  it("returns empty overrides for null frontmatter", () => {
    const { overrides, warnings } = parseTemplateOverrides(null);
    expect(overrides).toEqual({});
    expect(warnings).toHaveLength(0);
  });

  it("returns empty overrides for undefined frontmatter", () => {
    const { overrides, warnings } = parseTemplateOverrides(undefined);
    expect(overrides).toEqual({});
    expect(warnings).toHaveLength(0);
  });

  it("ignores non-ai- keys silently", () => {
    const { overrides, warnings } = parseTemplateOverrides({ tags: ["a"], title: "My template" });
    expect(overrides).toEqual({});
    expect(warnings).toHaveLength(0);
  });

  it("parses a fully valid override set", () => {
    const { overrides, warnings } = parseTemplateOverrides({
      "ai-model": "claude-sonnet-4-20250514",
      "ai-provider": "claude",
      "ai-result-heading": "Translation",
      "ai-insert-position": "end-of-file",
      "ai-debug": true,
      "ai-include-inline-prompt": false,
      "ai-include-note-names": true,
      "ai-include-note-aliases": true,
    });

    expect(warnings).toHaveLength(0);
    expect(overrides).toEqual({
      llmModel: "claude-sonnet-4-20250514",
      llmProvider: "claude",
      llmResultHeading: "Translation",
      insertPosition: "end-of-file",
      debug: true,
      llmIncludeInlineSystemPrompt: false,
      includeVaultNoteNames: true,
      includeNoteAliases: true,
    });
  });

  it("allows empty string for ai-result-heading", () => {
    const { overrides, warnings } = parseTemplateOverrides({ "ai-result-heading": "" });
    expect(warnings).toHaveLength(0);
    expect(overrides.llmResultHeading).toBe("");
  });

  it("warns and omits invalid ai-provider value", () => {
    const { overrides, warnings } = parseTemplateOverrides({ "ai-provider": "openai" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"ai-provider"');
    expect(overrides.llmProvider).toBeUndefined();
  });

  it("warns and omits invalid ai-insert-position value", () => {
    const { overrides, warnings } = parseTemplateOverrides({ "ai-insert-position": "top" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"ai-insert-position"');
    expect(overrides.insertPosition).toBeUndefined();
  });

  it("warns and omits non-boolean for ai-debug", () => {
    const { overrides, warnings } = parseTemplateOverrides({ "ai-debug": "yes" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"ai-debug"');
    expect(overrides.debug).toBeUndefined();
  });

  it("warns and omits non-boolean for ai-include-note-names", () => {
    const { overrides, warnings } = parseTemplateOverrides({ "ai-include-note-names": 1 });
    expect(warnings).toHaveLength(1);
    expect(overrides.includeVaultNoteNames).toBeUndefined();
  });

  it("warns and omits non-boolean for ai-include-note-aliases", () => {
    const { overrides, warnings } = parseTemplateOverrides({ "ai-include-note-aliases": "true" });
    expect(warnings).toHaveLength(1);
    expect(overrides.includeNoteAliases).toBeUndefined();
  });

  it("warns about unknown ai- key and ignores it", () => {
    const { overrides, warnings } = parseTemplateOverrides({ "ai-unknown-key": "value" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"ai-unknown-key"');
    expect(Object.keys(overrides)).toHaveLength(0);
  });

  it("accumulates multiple warnings in one call", () => {
    const { overrides, warnings } = parseTemplateOverrides({
      "ai-provider": "openai",
      "ai-insert-position": "top",
      "ai-debug": "yes",
      "ai-unknown-key": "foo",
    });
    expect(warnings).toHaveLength(4);
    expect(Object.keys(overrides)).toHaveLength(0);
  });
});

// ── applyOverrides ────────────────────────────────────────────────────────────

describe("applyOverrides", () => {
  it("returns a clone of global when overrides is empty", () => {
    const global = makeSettings();
    const { effective, warnings } = applyOverrides(global, {});
    expect(effective).toEqual(global);
    expect(effective).not.toBe(global); // shallow clone
    expect(warnings).toHaveLength(0);
  });

  it("does not mutate the global settings object", () => {
    const global = makeSettings();
    const { effective } = applyOverrides(global, { llmResultHeading: "Translation" });
    expect(global.llmResultHeading).toBe("AI Result");
    expect(effective.llmResultHeading).toBe("Translation");
  });

  it("applies valid scalar overrides", () => {
    const global = makeSettings();
    const { effective, warnings } = applyOverrides(global, {
      insertPosition: "end-of-file",
      debug: true,
      llmResultHeading: "Translation",
    });
    expect(warnings).toHaveLength(0);
    expect(effective.insertPosition).toBe("end-of-file");
    expect(effective.debug).toBe(true);
    expect(effective.llmResultHeading).toBe("Translation");
    expect(effective.llmProvider).toBe("copilot"); // unchanged
  });

  it("applies provider override when credentials are present", () => {
    const global = makeSettings({ claudeApiKey: "sk-ant-123" });
    const { effective, warnings } = applyOverrides(global, {
      llmProvider: "claude",
      llmModel: "claude-haiku-4-5-20251001",
    });
    expect(warnings).toHaveLength(0);
    expect(effective.llmProvider).toBe("claude");
    expect(effective.llmModel).toBe("claude-haiku-4-5-20251001");
  });

  it("reverts provider and model when credentials are missing", () => {
    const global = makeSettings({ llmProvider: "copilot", copilotApiKey: "tok-123", copilotApiBaseUrl: "https://api.githubcopilot.com" });
    const { effective, warnings } = applyOverrides(global, {
      llmProvider: "claude",
      llmModel: "claude-sonnet-4",
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("no configured credentials");
    expect(effective.llmProvider).toBe("copilot");
    expect(effective.llmModel).toBe("gpt-4.1-mini");
  });

  it("reverts model too when only model is overridden but effective provider has no credentials", () => {
    // Override model for a provider that currently has no creds set up
    const global = makeSettings({ llmProvider: "claude", claudeApiKey: "" });
    const { effective, warnings } = applyOverrides(global, { llmModel: "claude-opus-4-8" });
    expect(warnings).toHaveLength(1);
    expect(effective.llmModel).toBe("gpt-4.1-mini"); // reverted to global
  });

  it("allows overriding model alone when effective provider has credentials", () => {
    const global = makeSettings({ claudeApiKey: "sk-ant-123", llmProvider: "claude" });
    const { effective, warnings } = applyOverrides(global, { llmModel: "claude-haiku-4-5-20251001" });
    expect(warnings).toHaveLength(0);
    expect(effective.llmModel).toBe("claude-haiku-4-5-20251001");
    expect(effective.llmProvider).toBe("claude");
  });
});

// ── stripFrontmatter ─────────────────────────────────────────────────────────

describe("stripFrontmatter", () => {
  it("returns content unchanged when no frontmatter position provided", () => {
    const content = "# My Note\n\nSome content.";
    expect(stripFrontmatter(content)).toBe(content);
    expect(stripFrontmatter(content, undefined)).toBe(content);
  });

  it("strips frontmatter using the provided end offset", () => {
    // "---\nai-model: foo\n---\nBody content"
    //  0123456789...
    const content = "---\nai-model: foo\n---\nBody content";
    // "---" is at 18..20, so offset of end of "---" closing is 21 (the \n follows at 21)
    // Let's compute: "---\nai-model: foo\n---" = 3+1+14+1+3 = 22 chars, indices 0-21
    // end.offset = 22 means we slice from index 22
    const fmEnd = "---\nai-model: foo\n---".length; // 22
    expect(stripFrontmatter(content, { end: { offset: fmEnd } })).toBe("Body content");
  });

  it("strips the leading newline after the closing ---", () => {
    const content = "---\nkey: val\n---\n\nActual body";
    const fmEnd = "---\nkey: val\n---".length; // 16
    // slice from 16 gives "\n\nActual body", strip first \n → "\nActual body"
    expect(stripFrontmatter(content, { end: { offset: fmEnd } })).toBe("\nActual body");
  });

  it("returns empty string when content is only frontmatter", () => {
    const content = "---\nkey: val\n---";
    const fmEnd = content.length;
    expect(stripFrontmatter(content, { end: { offset: fmEnd } })).toBe("");
  });
});
