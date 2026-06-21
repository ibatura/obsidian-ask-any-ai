import { AiAssistantSettings, LlmProvider } from "../settings";
import { validateProviderSettings } from "./providerValidation";

const ALLOWED_PROVIDERS: LlmProvider[] = ["copilot", "claude", "claude-proxy", "gemini", "cli"];
const ALLOWED_INSERT_POSITIONS = ["at-cursor", "after-selection", "end-of-file"] as const;

export type TemplateOverrides = Partial<
  Pick<
    AiAssistantSettings,
    | "llmModel"
    | "llmProvider"
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
  warnings: string[];
}

export interface ApplyResult {
  effective: AiAssistantSettings;
  warnings: string[];
}

type FrontmatterPosition = { end: { offset: number } };

const AI_KEY_TO_SETTING: Record<string, keyof TemplateOverrides> = {
  "ai-model": "llmModel",
  "ai-provider": "llmProvider",
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

  if (!frontmatter) return { overrides, warnings };

  for (const [key, value] of Object.entries(frontmatter)) {
    if (!key.startsWith("ai-")) continue;

    if (!(key in AI_KEY_TO_SETTING)) {
      warnings.push(`Unknown template property "${key}" — ignored.`);
      continue;
    }

    if (key === "ai-provider") {
      if (!ALLOWED_PROVIDERS.includes(value as LlmProvider)) {
        warnings.push(
          `Invalid value for "${key}": "${value}" — expected one of ${ALLOWED_PROVIDERS.join(", ")}. Using global setting.`
        );
      } else {
        overrides.llmProvider = value as LlmProvider;
      }
      continue;
    }

    if (key === "ai-insert-position") {
      if (!ALLOWED_INSERT_POSITIONS.includes(value as (typeof ALLOWED_INSERT_POSITIONS)[number])) {
        warnings.push(
          `Invalid value for "${key}": "${value}" — expected one of ${ALLOWED_INSERT_POSITIONS.join(", ")}. Using global setting.`
        );
      } else {
        overrides.insertPosition = value as "at-cursor" | "after-selection" | "end-of-file";
      }
      continue;
    }

    if (BOOLEAN_KEYS.has(key)) {
      if (typeof value !== "boolean") {
        warnings.push(
          `Invalid value for "${key}": "${value}" — expected a boolean (true/false). Using global setting.`
        );
      } else {
        (overrides as Record<string, unknown>)[AI_KEY_TO_SETTING[key]!] = value;
      }
      continue;
    }

    // ai-model and ai-result-heading: any string
    if (typeof value !== "string") {
      warnings.push(`Invalid value for "${key}": expected a string. Using global setting.`);
    } else {
      (overrides as Record<string, unknown>)[AI_KEY_TO_SETTING[key]!] = value;
    }
  }

  return { overrides, warnings };
}

export function applyOverrides(
  global: AiAssistantSettings,
  overrides: TemplateOverrides
): ApplyResult {
  const warnings: string[] = [];
  const effective: AiAssistantSettings = { ...global, ...overrides };

  // If provider or model was overridden, validate credentials for the effective provider
  if (overrides.llmProvider !== undefined || overrides.llmModel !== undefined) {
    const credError = validateProviderSettings(effective);
    if (credError) {
      warnings.push(
        `Template specifies provider "${effective.llmProvider}" but it has no configured credentials — reverting to global provider. (${credError})`
      );
      effective.llmProvider = global.llmProvider;
      effective.llmModel = global.llmModel;
    }
  }

  return { effective, warnings };
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
