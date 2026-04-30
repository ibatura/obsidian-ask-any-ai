import { describe, it, expect, vi, beforeEach } from "vitest";
import { insertLlmResultInPlace } from "./insertResult";
import { AiAssistantSettings } from "../settings";
import { Notice } from "obsidian";

let mockOpenAndAwait = vi.fn().mockResolvedValue(null as null);

vi.mock("../ui/progressIndicator", () => ({
  showProgressIndicator: vi.fn(() => ({
    updateStatus: vi.fn(),
    complete: vi.fn(),
    close: vi.fn(),
  })),
}));

vi.mock("../ui/promptPickerModal", () => ({
  PromptPickerModal: vi.fn(function (this: { openAndAwait: typeof mockOpenAndAwait }) {
    this.openAndAwait = mockOpenAndAwait;
  }),
}));

vi.mock("../core/linkResolver", () => ({
  expandObsidianLinks: vi.fn().mockResolvedValue({ expanded: "", unresolved: [] }),
}));

vi.mock("../core/noteNamesContext", () => ({
  buildNoteNamesBlock: vi.fn().mockReturnValue("## Vault notes available for linking\n\n"),
}));

const { expandObsidianLinks } = await import("../core/linkResolver");

describe("Insert Result Command", () => {
  let mockEditor: {
    getSelection: ReturnType<typeof vi.fn>;
    getLine: ReturnType<typeof vi.fn>;
    lastLine: ReturnType<typeof vi.fn>;
    getCursor: ReturnType<typeof vi.fn>;
    replaceRange: ReturnType<typeof vi.fn>;
    replaceSelection: ReturnType<typeof vi.fn>;
  };
  let mockApp: {
    vault: {
      read: ReturnType<typeof vi.fn>;
      getFiles: ReturnType<typeof vi.fn>;
      getAbstractFileByPath: ReturnType<typeof vi.fn>;
    };
    metadataCache: {
      getFirstLinkpathDest: ReturnType<typeof vi.fn>;
      getFileCache: ReturnType<typeof vi.fn>;
    };
  };
  let mockFile: { path: string };
  let mockSettings: AiAssistantSettings;

  beforeEach(() => {
    vi.clearAllMocks();

    mockEditor = {
      getSelection: vi.fn().mockReturnValue(""),
      getLine: vi.fn().mockReturnValue("current line text"),
      lastLine: vi.fn().mockReturnValue(10),
      getCursor: vi.fn().mockReturnValue({ line: 5, ch: 10 }),
      replaceRange: vi.fn(),
      replaceSelection: vi.fn(),
    };
    mockFile = { path: "test.md" };
    mockApp = {
      vault: {
        read: vi.fn(),
        getFiles: vi.fn().mockReturnValue([]),
        getMarkdownFiles: vi.fn().mockReturnValue([]),
        getAbstractFileByPath: vi.fn(),
      },
      metadataCache: {
        getFirstLinkpathDest: vi.fn().mockReturnValue(null),
        getFileCache: vi.fn().mockReturnValue({}),
      },
    };
    mockSettings = {
      insertPosition: "after-selection",
      llmResultHeading: "AI Result",
      llmProvider: "cli",
      llmModel: "",
      timeoutMs: 60000,
      copilotApiBaseUrl: "",
      copilotApiKey: "",
      claudeApiBaseUrl: "",
      claudeApiKey: "",
      geminiApiBaseUrl: "",
      geminiApiKey: "",
      cliCommand: "echo",
      cliArgs: "",
      cliCwd: "",
      llmPromptMode: "none",
      llmInlinePrompt: "You are an expert assistant.",
      llmIncludeInlineSystemPrompt: true,
      llmPromptsFolder: "",
      includeVaultNoteNames: false,
      vaultNoteNamesExclusions: ["Untitled*", "Screenshot*"],
    } as AiAssistantSettings;

    (expandObsidianLinks as ReturnType<typeof vi.fn>).mockResolvedValue({
      expanded: "current line text",
      unresolved: [],
    });
  });

  it("shows notice and exits when no file provided", async () => {
    await insertLlmResultInPlace(mockEditor as any, null, mockApp as any, mockSettings);
    expect(mockEditor.replaceRange).not.toHaveBeenCalled();
    expect(mockEditor.replaceSelection).not.toHaveBeenCalled();
  });

  it("falls back to current line when selection is empty", async () => {
    mockEditor.getSelection.mockReturnValue("");
    mockEditor.getLine.mockReturnValue("current line text");

    await insertLlmResultInPlace(mockEditor as any, mockFile as any, mockApp as any, mockSettings);

    expect(mockEditor.getLine).toHaveBeenCalled();
  });

  it("uses selection when non-empty", async () => {
    mockEditor.getSelection.mockReturnValue("selected text");
    (expandObsidianLinks as ReturnType<typeof vi.fn>).mockResolvedValue({
      expanded: "selected text",
      unresolved: [],
    });

    await insertLlmResultInPlace(mockEditor as any, mockFile as any, mockApp as any, mockSettings);

    expect(mockEditor.getLine).not.toHaveBeenCalled();
  });

  it("shows 'Nothing to send' notice and aborts when both selection and line are empty", async () => {
    mockEditor.getSelection.mockReturnValue("   ");
    mockEditor.getLine.mockReturnValue("   ");

    await insertLlmResultInPlace(mockEditor as any, mockFile as any, mockApp as any, mockSettings);

    expect(expandObsidianLinks).not.toHaveBeenCalled();
    expect(mockEditor.replaceRange).not.toHaveBeenCalled();
  });

  it("shows notice for unresolved links but continues", async () => {
    mockEditor.getSelection.mockReturnValue("See [[Missing]]");
    (expandObsidianLinks as ReturnType<typeof vi.fn>).mockResolvedValue({
      expanded: "See [[Missing]]",
      unresolved: ["[[Missing]]"],
    });

    await insertLlmResultInPlace(mockEditor as any, mockFile as any, mockApp as any, mockSettings);
    // Command continues (provider validation fires next since cliCommand is set)
  });

  it("aborts when picker mode is cancelled", async () => {
    mockOpenAndAwait = vi.fn().mockResolvedValue("cancelled");

    mockSettings.llmPromptMode = "picker";
    mockEditor.getSelection.mockReturnValue("some text");
    (expandObsidianLinks as ReturnType<typeof vi.fn>).mockResolvedValue({
      expanded: "some text",
      unresolved: [],
    });

    await insertLlmResultInPlace(mockEditor as any, mockFile as any, mockApp as any, mockSettings);

    expect(mockEditor.replaceRange).not.toHaveBeenCalled();
    expect(mockEditor.replaceSelection).not.toHaveBeenCalled();
  });
});
