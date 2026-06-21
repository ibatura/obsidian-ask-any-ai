import { App, TFile } from "obsidian";

const LINKING_INSTRUCTION =
  "When your response mentions any of the notes listed below, wrap the reference as an Obsidian wiki-link using double square brackets, e.g. [[Note Name]]. Do not invent links to notes that are not in this list.";

const LINKING_INSTRUCTION_WITH_ALIASES =
  "When your response mentions any of the notes listed below, wrap the reference as an Obsidian wiki-link using double square brackets, e.g. [[Note Name]]. Notes shown with aliases in parentheses may also be referenced by those aliases. Do not invent links to notes that are not in this list.";

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

function normalizeAliases(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .filter((v): v is string => typeof v === "string")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
}

export function buildNoteNamesBlock(app: App, exclusions: string[], includeAliases = false): string {
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

  const entries: string[] = filtered.map((f) => {
    const displayName =
      (basenameCounts.get(f.basename.toLowerCase()) ?? 1) > 1
        ? f.path.replace(/\.md$/, "")
        : f.basename;

    if (includeAliases) {
      const rawAliases = app.metadataCache.getFileCache(f)?.frontmatter?.aliases;
      const aliases = normalizeAliases(rawAliases);
      if (aliases.length > 0) {
        return `${displayName} (aka: ${aliases.join(", ")})`;
      }
    }

    return displayName;
  });

  entries.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  const listSection = entries.map((n) => `- ${n}`).join("\n");
  const linkingInstruction = includeAliases ? LINKING_INSTRUCTION_WITH_ALIASES : LINKING_INSTRUCTION;

  return [
    "## Vault notes available for linking",
    "",
    linkingInstruction,
    "",
    listSection,
  ].join("\n");
}
