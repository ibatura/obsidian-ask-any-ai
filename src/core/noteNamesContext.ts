import { App, TFile } from "obsidian";

const LINKING_INSTRUCTION =
  "When your response mentions any of the notes listed below, wrap the reference as an Obsidian wiki-link using double square brackets, e.g. [[Note Name]]. Do not invent links to notes that are not in this list.";

export function patternToRegex(pattern: string): RegExp {
  let regexStr = "";
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i]!;
    if (ch === "*" && pattern[i + 1] === "*") {
      regexStr += ".*";
      i += 2;
    } else if (ch === "*") {
      regexStr += "[^/]*";
      i++;
    } else if (ch === "?") {
      regexStr += "[^/]";
      i++;
    } else {
      regexStr += ch.replace(/[\\^$.|+()[\]{}]/g, "\\$&");
      i++;
    }
  }
  return new RegExp(`^${regexStr}$`, "i");
}

export function matchesExclusionPattern(
  basename: string,
  vaultPathNoExt: string,
  patterns: string[]
): boolean {
  for (const raw of patterns) {
    const pattern = raw.trim();
    if (!pattern) continue;
    const testStr = pattern.includes("/") ? vaultPathNoExt : basename;
    if (patternToRegex(pattern).test(testStr)) return true;
  }
  return false;
}

export function buildNoteNamesBlock(app: App, exclusions: string[]): string {
  const files: TFile[] = app.vault.getMarkdownFiles();

  const filtered = files.filter((f) => {
    const pathNoExt = f.path.replace(/\.md$/, "");
    return !matchesExclusionPattern(f.basename, pathNoExt, exclusions);
  });

  // Detect ambiguous basenames
  const basenameCounts = new Map<string, number>();
  for (const f of filtered) {
    const key = f.basename.toLowerCase();
    basenameCounts.set(key, (basenameCounts.get(key) ?? 0) + 1);
  }

  const names: string[] = filtered.map((f) =>
    (basenameCounts.get(f.basename.toLowerCase()) ?? 1) > 1
      ? f.path.replace(/\.md$/, "")
      : f.basename
  );

  names.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  const listSection = names.map((n) => `- ${n}`).join("\n");

  return [
    "## Vault notes available for linking",
    "",
    LINKING_INSTRUCTION,
    "",
    listSection,
  ].join("\n");
}
