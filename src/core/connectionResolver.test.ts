import { describe, it, expect } from "vitest";
import { getDefaultConnection, resolveConnection } from "./connectionResolver";
import { AiAssistantSettings, LlmConnection, generateConnectionId } from "../settings";

function makeConn(overrides: Partial<LlmConnection> = {}): LlmConnection {
  return {
    id: generateConnectionId(),
    name: "Test",
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

function makeSettings(
  connections: LlmConnection[],
  defaultId?: string,
  extra: Partial<AiAssistantSettings> = {}
): AiAssistantSettings {
  return {
    connections,
    defaultConnectionId: defaultId ?? connections[0]?.id ?? "",
    timeoutMs: 60000,
    llmInlinePrompt: "",
    llmIncludeInlineSystemPrompt: true,
    llmPromptsFolder: "",
    llmResultHeading: "AI Result",
    insertPosition: "after-selection",
    includeVaultNoteNames: false,
    includeNoteAliases: false,
    vaultNoteNamesExclusions: [],
    debug: false,
    ...extra,
  };
}

// ── getDefaultConnection ──────────────────────────────────────────────────────

describe("getDefaultConnection", () => {
  it("returns the connection matching defaultConnectionId", () => {
    const a = makeConn({ name: "A" });
    const b = makeConn({ name: "B" });
    const settings = makeSettings([a, b], b.id);
    expect(getDefaultConnection(settings)).toBe(b);
  });

  it("falls back to first connection when id does not match", () => {
    const a = makeConn({ name: "A" });
    const settings = makeSettings([a], "nonexistent-id");
    expect(getDefaultConnection(settings)).toBe(a);
  });

  it("returns null when connection list is empty", () => {
    const settings = makeSettings([], "anything");
    expect(getDefaultConnection(settings)).toBeNull();
  });
});

// ── resolveConnection ─────────────────────────────────────────────────────────

describe("resolveConnection", () => {
  it("resolves the default connection when no llmName given", () => {
    const conn = makeConn({ name: "My CLI", cliCommand: "echo" });
    const settings = makeSettings([conn]);
    const { connection, warnings } = resolveConnection(settings, {});
    expect(connection).toBe(conn);
    expect(warnings).toHaveLength(0);
  });

  it("resolves connection by exact name (case-insensitive)", () => {
    const a = makeConn({ name: "Work Claude", provider: "claude", apiKey: "sk-ant-123" });
    const b = makeConn({ name: "Default", cliCommand: "echo" });
    const settings = makeSettings([b, a], b.id);
    const { connection, warnings } = resolveConnection(settings, { llmName: "work CLAUDE" });
    expect(connection?.name).toBe("Work Claude");
    expect(warnings).toHaveLength(0);
  });

  it("warns and falls back to default for unknown connection name", () => {
    const def = makeConn({ name: "Default", cliCommand: "echo" });
    const settings = makeSettings([def]);
    const { connection, warnings } = resolveConnection(settings, { llmName: "nonexistent" });
    expect(connection).toBe(def);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"nonexistent"');
  });

  it("applies model override to a clone without mutating the stored connection", () => {
    const conn = makeConn({ cliCommand: "echo", model: "original" });
    const settings = makeSettings([conn]);
    const { connection } = resolveConnection(settings, { modelOverride: "overridden" });
    expect(connection?.model).toBe("overridden");
    expect(conn.model).toBe("original"); // original untouched
    expect(connection).not.toBe(conn); // different object
  });

  it("returns null with warning when default connection has bad credentials", () => {
    const bad = makeConn({ provider: "copilot", baseUrl: "", apiKey: "" });
    const settings = makeSettings([bad]);
    const { connection, warnings } = resolveConnection(settings, {});
    expect(connection).toBeNull();
    expect(warnings).toHaveLength(1);
  });

  it("falls back to default when template-selected connection has bad credentials", () => {
    const bad = makeConn({ name: "Bad", provider: "copilot", baseUrl: "", apiKey: "" });
    const good = makeConn({ name: "Good", cliCommand: "echo" });
    const settings = makeSettings([bad, good], good.id);
    const { connection, warnings } = resolveConnection(settings, { llmName: "Bad" });
    expect(connection?.name).toBe("Good");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"Bad"');
  });

  it("returns null when both template-selected and default have bad credentials", () => {
    const bad1 = makeConn({ name: "A", provider: "copilot", baseUrl: "", apiKey: "" });
    const bad2 = makeConn({ name: "B", provider: "copilot", baseUrl: "", apiKey: "" });
    const settings = makeSettings([bad2, bad1], bad2.id);
    const { connection, warnings } = resolveConnection(settings, { llmName: "A" });
    expect(connection).toBeNull();
    expect(warnings.length).toBeGreaterThanOrEqual(2);
  });

  it("returns null with warning when connection list is empty", () => {
    const settings = makeSettings([], "");
    const { connection, warnings } = resolveConnection(settings, {});
    expect(connection).toBeNull();
    expect(warnings).toHaveLength(1);
  });

  it("applies model override to fallback connection", () => {
    const bad = makeConn({ name: "Bad", provider: "copilot", baseUrl: "", apiKey: "" });
    const good = makeConn({ name: "Good", cliCommand: "echo", model: "" });
    const settings = makeSettings([bad, good], good.id);
    const { connection } = resolveConnection(settings, { llmName: "Bad", modelOverride: "gpt-x" });
    expect(connection?.model).toBe("gpt-x");
    expect(good.model).toBe(""); // good connection unmodified
  });
});
