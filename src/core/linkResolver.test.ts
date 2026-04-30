import { describe, it, expect, vi, beforeEach } from "vitest";
import { expandObsidianLinks } from "./linkResolver";
import { TFile } from "obsidian";

function makeFile(path: string): TFile {
  const f = new TFile();
  f.path = path;
  return f;
}

function makeHeading(heading: string, level: number, offset: number) {
  return { heading, level, position: { start: { offset } } };
}

describe("expandObsidianLinks", () => {
  let mockApp: {
    metadataCache: {
      getFirstLinkpathDest: ReturnType<typeof vi.fn>;
      getFileCache: ReturnType<typeof vi.fn>;
    };
    vault: {
      read: ReturnType<typeof vi.fn>;
      getAbstractFileByPath: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    mockApp = {
      metadataCache: {
        getFirstLinkpathDest: vi.fn(),
        getFileCache: vi.fn(),
      },
      vault: {
        read: vi.fn(),
        getAbstractFileByPath: vi.fn(),
      },
    };
  });

  it("leaves text unchanged when no links present", async () => {
    const { expanded, unresolved } = await expandObsidianLinks("plain text", "source.md", mockApp as any);
    expect(expanded).toBe("plain text");
    expect(unresolved).toHaveLength(0);
  });

  it("expands [[Note]] to full file content", async () => {
    const file = makeFile("Note.md");
    mockApp.metadataCache.getFirstLinkpathDest.mockReturnValue(file);
    mockApp.vault.read.mockResolvedValue("# Note\n\nFull content.");
    mockApp.metadataCache.getFileCache.mockReturnValue({});

    const { expanded, unresolved } = await expandObsidianLinks("See [[Note]]", "source.md", mockApp as any);
    expect(expanded).toBe("See # Note\n\nFull content.");
    expect(unresolved).toHaveLength(0);
  });

  it("expands [[Note|Alias]] to full file content (alias ignored)", async () => {
    const file = makeFile("Note.md");
    mockApp.metadataCache.getFirstLinkpathDest.mockReturnValue(file);
    mockApp.vault.read.mockResolvedValue("Content here.");
    mockApp.metadataCache.getFileCache.mockReturnValue({});

    const { expanded } = await expandObsidianLinks("[[Note|My Alias]]", "source.md", mockApp as any);
    expect(expanded).toBe("Content here.");
  });

  it("leaves link unchanged and records unresolved when file not found", async () => {
    mockApp.metadataCache.getFirstLinkpathDest.mockReturnValue(null);

    const { expanded, unresolved } = await expandObsidianLinks("[[Missing Note]]", "source.md", mockApp as any);
    expect(expanded).toBe("[[Missing Note]]");
    expect(unresolved).toContain("[[Missing Note]]");
  });

  it("expands [[Note#Heading]] to only that section", async () => {
    const file = makeFile("Note.md");
    mockApp.metadataCache.getFirstLinkpathDest.mockReturnValue(file);

    const content = "## Intro\n\nIntro text.\n\n## Decisions\n\n- Ship v0.2\n- Drop legacy\n\n## Other\n\nOther text.";
    mockApp.vault.read.mockResolvedValue(content);
    mockApp.metadataCache.getFileCache.mockReturnValue({
      headings: [
        makeHeading("Intro", 2, 0),
        makeHeading("Decisions", 2, content.indexOf("## Decisions")),
        makeHeading("Other", 2, content.indexOf("## Other")),
      ],
    });

    const { expanded } = await expandObsidianLinks("[[Note#Decisions]]", "source.md", mockApp as any);
    expect(expanded).toContain("## Decisions");
    expect(expanded).toContain("- Ship v0.2");
    expect(expanded).not.toContain("## Other");
  });

  it("returns null and marks unresolved when heading not found", async () => {
    const file = makeFile("Note.md");
    mockApp.metadataCache.getFirstLinkpathDest.mockReturnValue(file);
    mockApp.vault.read.mockResolvedValue("## Existing\n\nContent.");
    mockApp.metadataCache.getFileCache.mockReturnValue({
      headings: [makeHeading("Existing", 2, 0)],
    });

    const { expanded, unresolved } = await expandObsidianLinks("[[Note#Missing Heading]]", "source.md", mockApp as any);
    expect(expanded).toBe("[[Note#Missing Heading]]");
    expect(unresolved).toContain("[[Note#Missing Heading]]");
  });

  it("expands [[Note#^blockid]] to only that block", async () => {
    const file = makeFile("Note.md");
    mockApp.metadataCache.getFirstLinkpathDest.mockReturnValue(file);

    const content = "Line one.\n\nThe block text here. ^myblock\n\nLine three.";
    const blockStart = content.indexOf("The block");
    const blockEnd = content.indexOf("\n\nLine three.");
    mockApp.vault.read.mockResolvedValue(content);
    mockApp.metadataCache.getFileCache.mockReturnValue({
      blocks: {
        myblock: { position: { start: { offset: blockStart }, end: { offset: blockEnd } } },
      },
    });

    const { expanded } = await expandObsidianLinks("[[Note#^myblock]]", "source.md", mockApp as any);
    expect(expanded).toContain("The block text here.");
    expect(expanded).not.toContain("Line one.");
    expect(expanded).not.toContain("Line three.");
  });

  it("does not recursively expand links inside expanded content", async () => {
    const file = makeFile("Note.md");
    mockApp.metadataCache.getFirstLinkpathDest.mockReturnValue(file);
    mockApp.vault.read.mockResolvedValue("Contains [[InnerNote]] inside.");
    mockApp.metadataCache.getFileCache.mockReturnValue({});

    const { expanded } = await expandObsidianLinks("[[Note]]", "source.md", mockApp as any);
    // InnerNote link inside expanded text should NOT be expanded
    expect(expanded).toBe("Contains [[InnerNote]] inside.");
  });

  it("expands same-file link [[#Heading]] using sourcePath", async () => {
    const sourceFile = makeFile("source.md");
    mockApp.vault.getAbstractFileByPath.mockReturnValue(sourceFile);

    const content = "## Intro\n\nIntro text.\n\n## Target\n\nTarget content.\n";
    mockApp.vault.read.mockResolvedValue(content);
    mockApp.metadataCache.getFileCache.mockReturnValue({
      headings: [
        makeHeading("Intro", 2, 0),
        makeHeading("Target", 2, content.indexOf("## Target")),
      ],
    });

    const { expanded } = await expandObsidianLinks("See [[#Target]]", "source.md", mockApp as any);
    expect(expanded).toContain("## Target");
    expect(expanded).toContain("Target content.");
    expect(expanded).not.toContain("Intro text.");
  });

  it("replaces empty file content with empty string", async () => {
    const file = makeFile("Empty.md");
    mockApp.metadataCache.getFirstLinkpathDest.mockReturnValue(file);
    mockApp.vault.read.mockResolvedValue("");
    mockApp.metadataCache.getFileCache.mockReturnValue({});

    const { expanded, unresolved } = await expandObsidianLinks("[[Empty]]", "source.md", mockApp as any);
    expect(expanded).toBe("");
    expect(unresolved).toHaveLength(0);
  });

  it("expands multiple different links in a single text", async () => {
    const fileA = makeFile("A.md");
    const fileB = makeFile("B.md");

    mockApp.metadataCache.getFirstLinkpathDest
      .mockImplementation((linkpath: string) => linkpath === "A" ? fileA : fileB);
    mockApp.vault.read
      .mockImplementation((f: TFile) => Promise.resolve(f.path === "A.md" ? "Content A" : "Content B"));
    mockApp.metadataCache.getFileCache.mockReturnValue({});

    const { expanded } = await expandObsidianLinks("[[A]] and [[B]]", "source.md", mockApp as any);
    expect(expanded).toBe("Content A and Content B");
  });
});
