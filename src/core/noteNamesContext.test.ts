import { describe, it, expect, vi } from "vitest";
import { matchesExclusionPattern, patternToRegex, buildNoteNamesBlock } from "./noteNamesContext";
import type { TFile } from "obsidian";

// ── patternToRegex / matchesExclusionPattern ──────────────────────────────

describe("matchesExclusionPattern", () => {
  it("Untitled* matches 'Untitled'", () => {
    expect(matchesExclusionPattern("Untitled", "Untitled", ["Untitled*"])).toBe(true);
  });

  it("Untitled* matches 'Untitled 1'", () => {
    expect(matchesExclusionPattern("Untitled 1", "Untitled 1", ["Untitled*"])).toBe(true);
  });

  it("Untitled* matches 'Untitled copy'", () => {
    expect(matchesExclusionPattern("Untitled copy", "Untitled copy", ["Untitled*"])).toBe(true);
  });

  it("Untitled* does not match 'My Untitled draft'", () => {
    expect(matchesExclusionPattern("My Untitled draft", "My Untitled draft", ["Untitled*"])).toBe(false);
  });

  it("Screenshot* matches 'Screenshot 2026-04-20 at 10.03'", () => {
    expect(matchesExclusionPattern("Screenshot 2026-04-20 at 10.03", "Screenshot 2026-04-20 at 10.03", ["Screenshot*"])).toBe(true);
  });

  it("????-??-?? matches '2025-09-25'", () => {
    expect(matchesExclusionPattern("2025-09-25", "2025-09-25", ["????-??-??"])).toBe(true);
  });

  it("????-??-?? does not match '25-09-25' (too short)", () => {
    expect(matchesExclusionPattern("25-09-25", "25-09-25", ["????-??-??"])).toBe(false);
  });

  it("Daily/* matches 'Daily/2025-09-25' as a path pattern", () => {
    expect(matchesExclusionPattern("2025-09-25", "Daily/2025-09-25", ["Daily/*"])).toBe(true);
  });

  it("Daily/* does not match 'Projects/Daily-plan'", () => {
    expect(matchesExclusionPattern("Daily-plan", "Projects/Daily-plan", ["Daily/*"])).toBe(false);
  });

  it("Daily/** matches nested path 'Daily/2025/09-25'", () => {
    expect(matchesExclusionPattern("09-25", "Daily/2025/09-25", ["Daily/**"])).toBe(true);
  });

  it("pattern matching is case-insensitive", () => {
    expect(matchesExclusionPattern("untitled", "untitled", ["UNTITLED*"])).toBe(true);
  });

  it("empty pattern is ignored", () => {
    expect(matchesExclusionPattern("Anything", "Anything", ["", "  "])).toBe(false);
  });

  it("no patterns never excludes", () => {
    expect(matchesExclusionPattern("Project plan", "Project plan", [])).toBe(false);
  });

  it("* does not cross path separator", () => {
    expect(matchesExclusionPattern("note", "Folder/note", ["Folder*"])).toBe(false);
  });
});

// ── buildNoteNamesBlock ───────────────────────────────────────────────────

function makeMockApp(
  files: { path: string; basename: string; aliases?: unknown }[]
) {
  const fileObjects = files.map((f) => ({ path: f.path, basename: f.basename }));
  return {
    vault: {
      getMarkdownFiles: vi.fn().mockReturnValue(fileObjects),
    },
    metadataCache: {
      getFileCache: vi.fn().mockImplementation((file: TFile) => {
        const entry = files.find((f) => f.path === file.path);
        if (!entry || entry.aliases === undefined) return {};
        return { frontmatter: { aliases: entry.aliases } };
      }),
    },
  };
}

describe("buildNoteNamesBlock", () => {
  it("contains heading and instruction", () => {
    const app = makeMockApp([{ path: "Note.md", basename: "Note" }]);
    const block = buildNoteNamesBlock(app as any, []);
    expect(block).toContain("## Vault notes available for linking");
    expect(block).toContain("Do not invent links to notes that are not in this list.");
  });

  it("lists note basenames sorted alphabetically", () => {
    const app = makeMockApp([
      { path: "Zebra.md", basename: "Zebra" },
      { path: "Apple.md", basename: "Apple" },
      { path: "Mango.md", basename: "Mango" },
    ]);
    const block = buildNoteNamesBlock(app as any, []);
    const lines = block.split("\n").filter((l) => l.startsWith("- "));
    expect(lines).toEqual(["- Apple", "- Mango", "- Zebra"]);
  });

  it("excludes files matching default patterns", () => {
    const app = makeMockApp([
      { path: "Project plan.md", basename: "Project plan" },
      { path: "Untitled.md", basename: "Untitled" },
      { path: "Untitled 2.md", basename: "Untitled 2" },
      { path: "Screenshot 1.md", basename: "Screenshot 1" },
    ]);
    const block = buildNoteNamesBlock(app as any, ["Untitled*", "Screenshot*"]);
    expect(block).toContain("- Project plan");
    expect(block).not.toContain("Untitled");
    expect(block).not.toContain("Screenshot");
  });

  it("uses vault path for ambiguous basenames", () => {
    const app = makeMockApp([
      { path: "Work/Meeting notes.md", basename: "Meeting notes" },
      { path: "Personal/Meeting notes.md", basename: "Meeting notes" },
      { path: "Project plan.md", basename: "Project plan" },
    ]);
    const block = buildNoteNamesBlock(app as any, []);
    expect(block).toContain("- Personal/Meeting notes");
    expect(block).toContain("- Work/Meeting notes");
    expect(block).not.toMatch(/^- Meeting notes$/m);
    expect(block).toContain("- Project plan");
  });

  it("returns block with empty list when all notes excluded", () => {
    const app = makeMockApp([
      { path: "Untitled.md", basename: "Untitled" },
      { path: "Untitled 2.md", basename: "Untitled 2" },
    ]);
    const block = buildNoteNamesBlock(app as any, ["Untitled*"]);
    expect(block).toContain("## Vault notes available for linking");
    const listLines = block.split("\n").filter((l) => l.startsWith("- "));
    expect(listLines).toHaveLength(0);
  });

  it("returns block with empty list when vault has no notes", () => {
    const app = makeMockApp([]);
    const block = buildNoteNamesBlock(app as any, []);
    expect(block).toContain("## Vault notes available for linking");
    const listLines = block.split("\n").filter((l) => l.startsWith("- "));
    expect(listLines).toHaveLength(0);
  });

  it("output is byte-for-byte identical when includeAliases is false", () => {
    const app = makeMockApp([
      { path: "Note.md", basename: "Note", aliases: ["my-note"] },
    ]);
    const withoutFlag = buildNoteNamesBlock(app as any, []);
    const withFalse = buildNoteNamesBlock(app as any, [], false);
    expect(withFalse).toBe(withoutFlag);
    expect(withFalse).not.toContain("aka:");
  });
});

describe("buildNoteNamesBlock — aliases", () => {
  it("appends aliases when includeAliases is true and note has a YAML-list alias", () => {
    const app = makeMockApp([
      { path: "Project Plan.md", basename: "Project Plan", aliases: ["roadmap", "q3-plan"] },
    ]);
    const block = buildNoteNamesBlock(app as any, [], true);
    expect(block).toContain("- Project Plan (aka: roadmap, q3-plan)");
  });

  it("appends alias when note has a single-string alias", () => {
    const app = makeMockApp([
      { path: "Meeting Notes.md", basename: "Meeting Notes", aliases: "minutes" },
    ]);
    const block = buildNoteNamesBlock(app as any, [], true);
    expect(block).toContain("- Meeting Notes (aka: minutes)");
  });

  it("renders notes without aliases unchanged", () => {
    const app = makeMockApp([
      { path: "Plain.md", basename: "Plain" },
      { path: "Aliased.md", basename: "Aliased", aliases: ["alias-a"] },
    ]);
    const block = buildNoteNamesBlock(app as any, [], true);
    expect(block).toContain("- Aliased (aka: alias-a)");
    expect(block).toContain("- Plain");
    expect(block).not.toContain("Plain (aka:");
  });

  it("uses extended linking instruction when aliases are enabled", () => {
    const app = makeMockApp([{ path: "Note.md", basename: "Note", aliases: ["n"] }]);
    const block = buildNoteNamesBlock(app as any, [], true);
    expect(block).toContain("aliases in parentheses may also be referenced");
  });

  it("uses original linking instruction when aliases are disabled", () => {
    const app = makeMockApp([{ path: "Note.md", basename: "Note" }]);
    const block = buildNoteNamesBlock(app as any, [], false);
    expect(block).toContain("Do not invent links to notes that are not in this list.");
    expect(block).not.toContain("aliases in parentheses");
  });

  it("exclusions still apply when aliases are enabled", () => {
    const app = makeMockApp([
      { path: "Untitled.md", basename: "Untitled", aliases: ["draft"] },
      { path: "Note.md", basename: "Note" },
    ]);
    const block = buildNoteNamesBlock(app as any, ["Untitled*"], true);
    expect(block).not.toContain("Untitled");
    expect(block).toContain("- Note");
  });

  it("trims and drops empty alias strings", () => {
    const app = makeMockApp([
      { path: "Note.md", basename: "Note", aliases: ["  ", "valid", ""] },
    ]);
    const block = buildNoteNamesBlock(app as any, [], true);
    expect(block).toContain("- Note (aka: valid)");
  });
});
