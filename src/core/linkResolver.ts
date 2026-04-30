import { App, TFile, CachedMetadata } from "obsidian";

export interface LinkExpansionResult {
  expanded: string;
  unresolved: string[];
}

function parseLinkText(raw: string): { linkpath: string; fragment: string | undefined } {
  const withoutAlias = raw.split("|")[0] ?? raw;
  const hashIdx = withoutAlias.indexOf("#");
  if (hashIdx === -1) {
    return { linkpath: withoutAlias.trim(), fragment: undefined };
  }
  return {
    linkpath: withoutAlias.slice(0, hashIdx).trim(),
    fragment: withoutAlias.slice(hashIdx + 1).trim(),
  };
}

function extractByHeadingPath(content: string, cache: CachedMetadata, fragmentPath: string): string | null {
  if (!cache.headings || cache.headings.length === 0) return null;

  const parts = fragmentPath.split("#");
  let headings = cache.headings;
  let startOffset = 0;
  let endOffset = content.length;

  for (const part of parts) {
    const target = part.toLowerCase();
    const idx = headings.findIndex(h => h.heading.toLowerCase() === target && h.position.start.offset >= startOffset);
    if (idx === -1) return null;

    const h = headings[idx];
    if (!h) return null;
    startOffset = h.position.start.offset;
    endOffset = content.length;

    for (let i = idx + 1; i < headings.length; i++) {
      const next = headings[i];
      if (next && next.level <= h.level) {
        endOffset = next.position.start.offset;
        break;
      }
    }

    // Narrow the available headings for next iteration to those within this section
    headings = headings.filter(
      hh => hh.position.start.offset > startOffset && hh.position.start.offset < endOffset
    );
  }

  return content.slice(startOffset, endOffset).trim();
}

function extractByBlockId(content: string, cache: CachedMetadata, blockId: string): string | null {
  if (!cache.blocks) return null;
  const block = cache.blocks[blockId];
  if (!block) return null;
  return content.slice(block.position.start.offset, block.position.end.offset).trim();
}

async function resolveLink(
  linkpath: string,
  fragment: string | undefined,
  sourcePath: string,
  app: App
): Promise<string | null> {
  const targetFile: TFile | null = linkpath
    ? app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath)
    : (app.vault.getAbstractFileByPath(sourcePath) as TFile | null);

  if (!(targetFile instanceof TFile)) return null;

  const content = await app.vault.read(targetFile);

  if (fragment === undefined) {
    return content;
  }

  const cache: CachedMetadata = app.metadataCache.getFileCache(targetFile) ?? {};

  if (fragment.startsWith("^")) {
    const blockId = fragment.slice(1);
    return extractByBlockId(content, cache, blockId);
  }

  return extractByHeadingPath(content, cache, fragment);
}

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

export async function expandObsidianLinks(
  text: string,
  sourcePath: string,
  app: App
): Promise<LinkExpansionResult> {
  const unresolved: string[] = [];
  const matches: { raw: string; linkpath: string; fragment: string | undefined }[] = [];

  for (const match of text.matchAll(WIKILINK_RE)) {
    const { linkpath, fragment } = parseLinkText(match[1] ?? "");
    matches.push({ raw: match[0], linkpath, fragment });
  }

  // Deduplicate by raw link text
  const seen = new Set<string>();
  const resolutionMap = new Map<string, string>();

  for (const { raw, linkpath, fragment } of matches) {
    if (seen.has(raw)) continue;
    seen.add(raw);

    const resolved = await resolveLink(linkpath, fragment, sourcePath, app);
    if (resolved === null) {
      unresolved.push(raw);
    } else {
      resolutionMap.set(raw, resolved);
    }
  }

  const expanded = text.replace(WIKILINK_RE, (match) => {
    return resolutionMap.has(match) ? resolutionMap.get(match)! : match;
  });

  return { expanded, unresolved };
}
