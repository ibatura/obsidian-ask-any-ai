import { describe, it, expect } from "vitest";
import {
  parseTemplateOverrides,
  applyOverrides,
  stripFrontmatter,
} from "./templateOverrides";
import { AskAnyAiSettings, LlmConnection, generateConnectionId } from "../settings";

function makeConn(overrides: Partial<LlmConnection> = {}): LlmConnection {
  return {
    id: generateConnectionId(),
    name: "Default",
    provider: "cli",
    model: "",
    baseUrl: "",
    apiKey: "",
    cliCommand: "echo",
    cliArgs: "",
    cliCwd: "",
    ...overrides,
  };
}

function makeSettings(overrides: Partial<AskAnyAiSettings> = {}): AskAnyAiSettings {
  const conn = makeConn();
  return {
    connections: [conn],
    defaultConnectionId: conn.id,
    timeoutMs: 60000,
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
    const { overrides, llmName, modelOverride, warnings } = parseTemplateOverrides({
      "ai-llm": "Work Claude",
      "ai-model": "claude-sonnet-4-20250514",
      "ai-result-heading": "Translation",
      "ai-insert-position": "end-of-file",
      "ai-debug": true,
      "ai-include-inline-prompt": false,
      "ai-include-note-names": true,
      "ai-include-note-aliases": true,
    });

    expect(warnings).toHaveLength(0);
    expect(llmName).toBe("Work Claude");
    expect(modelOverride).toBe("claude-sonnet-4-20250514");
    expect(overrides).toEqual({
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

  it("surfaces ai-llm as llmName", () => {
    const { llmName, warnings } = parseTemplateOverrides({ "ai-llm": "My Connection" });
    expect(warnings).toHaveLength(0);
    expect(llmName).toBe("My Connection");
  });

  it("warns and omits empty ai-llm value", () => {
    const { llmName, warnings } = parseTemplateOverrides({ "ai-llm": "   " });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"ai-llm"');
    expect(llmName).toBeUndefined();
  });

  it("surfaces ai-model as modelOverride", () => {
    const { modelOverride, warnings } = parseTemplateOverrides({ "ai-model": "gpt-4o" });
    expect(warnings).toHaveLength(0);
    expect(modelOverride).toBe("gpt-4o");
  });

  it("warns about ai-provider as an unknown key", () => {
    const { overrides, warnings } = parseTemplateOverrides({ "ai-provider": "claude" });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"ai-provider"');
    expect(Object.keys(overrides)).toHaveLength(0);
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
      "ai-provider": "claude",       // unknown key → warning
      "ai-insert-position": "top",   // invalid value → warning
      "ai-debug": "yes",             // non-boolean → warning
      "ai-unknown-key": "foo",       // unknown key → warning
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
    expect(effective.connections).toBe(global.connections); // connections untouched
  });

  it("preserves connections and defaultConnectionId unchanged", () => {
    const global = makeSettings();
    const { effective } = applyOverrides(global, { llmResultHeading: "New Heading" });
    expect(effective.connections).toBe(global.connections);
    expect(effective.defaultConnectionId).toBe(global.defaultConnectionId);
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
    const content = "---\nai-model: foo\n---\nBody content";
    const fmEnd = "---\nai-model: foo\n---".length;
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
