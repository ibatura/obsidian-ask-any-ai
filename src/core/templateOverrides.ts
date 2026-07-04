import { AskAnyAiSettings } from "../settings";

const ALLOWED_INSERT_POSITIONS = ["at-cursor", "after-selection", "end-of-file"] as const;

export type TemplateOverrides = Partial<
  Pick<
    AskAnyAiSettings,
    | "llmResultHeading"
    | "insertPosition"
    | "debug"
    | "llmIncludeInlineSystemPrompt"
    | "includeVaultNoteNames"
    | "includeNoteAliases"
  >
>;

export interface ParseResult {
  overrides: TemplateOverrides;
  llmName?: string;
  modelOverride?: string;
  warnings: string[];
}

export interface ApplyResult {
  effective: AskAnyAiSettings;
  warnings: string[];
}

type FrontmatterPosition = { end: { offset: number } };

const AI_KEY_TO_SETTING: Record<string, keyof TemplateOverrides> = {
  "ai-result-heading": "llmResultHeading",
  "ai-insert-position": "insertPosition",
  "ai-debug": "debug",
  "ai-include-inline-prompt": "llmIncludeInlineSystemPrompt",
  "ai-include-note-names": "includeVaultNoteNames",
  "ai-include-note-aliases": "includeNoteAliases",
};

const BOOLEAN_KEYS = new Set([
  "ai-debug",
  "ai-include-inline-prompt",
  "ai-include-note-names",
  "ai-include-note-aliases",
]);

export function parseTemplateOverrides(
  frontmatter: Record<string, unknown> | null | undefined
): ParseResult {
  const overrides: TemplateOverrides = {};
  const warnings: string[] = [];
  let llmName: string | undefined;
  let modelOverride: string | undefined;

  if (!frontmatter) return { overrides, warnings };

  for (const [key, value] of Object.entries(frontmatter)) {
    if (!key.startsWith("ai-")) continue;

    if (key === "ai-llm") {
      if (typeof value !== "string" || !value.trim()) {
        warnings.push(`Invalid value for "ai-llm": expected a non-empty string. Using the default connection.`);
      } else {
        llmName = value.trim();
      }
      continue;
    }

    if (key === "ai-model") {
      if (typeof value !== "string") {
        warnings.push(`Invalid value for "ai-model": expected a string. Using global setting.`);
      } else {
        modelOverride = value;
      }
      continue;
    }

    if (!(key in AI_KEY_TO_SETTING)) {
      warnings.push(`Unknown template property "${key}" — ignored.`);
      continue;
    }

    if (key === "ai-insert-position") {
      if (!ALLOWED_INSERT_POSITIONS.includes(value as (typeof ALLOWED_INSERT_POSITIONS)[number])) {
        warnings.push(
          `Invalid value for "${key}": "${String(value)}" — expected one of ${ALLOWED_INSERT_POSITIONS.join(", ")}. Using global setting.`
        );
      } else {
        overrides.insertPosition = value as "at-cursor" | "after-selection" | "end-of-file";
      }
      continue;
    }

    if (BOOLEAN_KEYS.has(key)) {
      if (typeof value !== "boolean") {
        warnings.push(
          `Invalid value for "${key}": "${String(value)}" — expected a boolean (true/false). Using global setting.`
        );
      } else {
        (overrides as Record<string, unknown>)[AI_KEY_TO_SETTING[key]!] = value;
      }
      continue;
    }

    // ai-result-heading: any string
    if (typeof value !== "string") {
      warnings.push(`Invalid value for "${key}": expected a string. Using global setting.`);
    } else {
      (overrides as Record<string, unknown>)[AI_KEY_TO_SETTING[key]!] = value;
    }
  }

  return { overrides, llmName, modelOverride, warnings };
}

export function applyOverrides(
  global: AskAnyAiSettings,
  overrides: TemplateOverrides
): ApplyResult {
  const effective: AskAnyAiSettings = { ...global, ...overrides };
  return { effective, warnings: [] };
}

export function stripFrontmatter(
  content: string,
  frontmatterPosition?: FrontmatterPosition
): string {
  if (!frontmatterPosition) return content;
  // frontmatterPosition.end.offset is the character offset of the closing '---'
  // Advance past it and skip the following newline
  const rest = content.slice(frontmatterPosition.end.offset);
  return rest.startsWith("\n") ? rest.slice(1) : rest;
}
