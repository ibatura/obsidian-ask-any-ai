/**
 * Single source of truth for the in-settings "Template & override reference".
 * Each entry documents one `ai-*` frontmatter key understood by
 * src/core/templateOverrides.ts. Pure data — no Obsidian import — so it can be
 * unit-tested and reused to render both the table and the example block.
 */
export interface TemplateParamDoc {
  /** The frontmatter key, e.g. "ai-model". */
  key: string;
  /** Accepted value type (and allowed values for enums). */
  type: string;
  /** Display name of the global setting this key overrides. */
  overridesSetting: string;
  /** What that setting controls and its default when the key is omitted. */
  overridesDetail: string;
  /** What the key does and why a user would reach for it. */
  description: string;
  /** A minimal example value (a YAML scalar). */
  example: string;
}

export const TEMPLATE_PARAM_DOCS: TemplateParamDoc[] = [
  {
    key: "ai-llm",
    type: "string (a connection name)",
    overridesSetting: "Active LLM connection",
    overridesDetail:
      "Which named connection runs the template. Default: the connection marked ★ Default in LLM connections.",
    description:
      "Routes this template to a specific connection instead of the default — e.g. always run it on a local CLI or a particular cloud model. An unknown name falls back to the default connection with a warning.",
    example: "Work Claude",
  },
  {
    key: "ai-model",
    type: "string",
    overridesSetting: "Default model (of the chosen connection)",
    overridesDetail:
      "The model id sent to the provider. Default: the connection's Default model, or the provider's built-in default when that is empty.",
    description:
      "Overrides the model for this run only — e.g. use a larger model for a heavier template — without editing the connection.",
    example: "claude-sonnet-4-20250514",
  },
  {
    key: "ai-result-heading",
    type: "string",
    overridesSetting: "Result heading",
    overridesDetail:
      'Markdown heading inserted above the result. Default: "AI Result". An empty string inserts no heading.',
    description:
      "Sets the heading shown above this template's output, or removes it for templates that should blend into the note.",
    example: "Summary",
  },
  {
    key: "ai-insert-position",
    type: "at-cursor | after-selection | end-of-file",
    overridesSetting: "Insert position",
    overridesDetail:
      "Where the result is placed in the note. Default: after-selection.",
    description:
      "Controls placement of this template's result. An invalid value falls back to the global setting with a warning.",
    example: "end-of-file",
  },
  {
    key: "ai-debug",
    type: "boolean (true/false)",
    overridesSetting: "Debug",
    overridesDetail:
      "Whether the full request sent to the AI is inserted before the result. Default: false.",
    description:
      "Turn on for a single template while authoring or troubleshooting to see exactly what was sent.",
    example: "true",
  },
  {
    key: "ai-include-inline-prompt",
    type: "boolean (true/false)",
    overridesSetting: "Include system prompt",
    overridesDetail:
      "Whether the global system prompt is sent alongside the request. Default: true.",
    description:
      "Set false for self-contained templates that should not receive the global system prompt.",
    example: "false",
  },
  {
    key: "ai-include-note-names",
    type: "boolean (true/false)",
    overridesSetting: "Include vault note names in LLM context",
    overridesDetail:
      "Whether the list of vault note names is appended to the prompt. Default: false.",
    description:
      "Enable for templates that should cross-link to existing notes via [[wiki-links]].",
    example: "true",
  },
  {
    key: "ai-include-note-aliases",
    type: "boolean (true/false)",
    overridesSetting: "Include note aliases",
    overridesDetail:
      "Whether each note's aliases are listed next to its name. Default: false. Only has an effect when note names are included.",
    description:
      "Enable so the AI can match and link notes by their aliases as well as their names.",
    example: "true",
  },
];

/** Build a copy-paste YAML frontmatter block listing every documented key. */
export function buildExampleFrontmatter(): string {
  const lines = ["---"];
  for (const doc of TEMPLATE_PARAM_DOCS) {
    lines.push(`${doc.key}: ${doc.example}`);
  }
  lines.push("---");
  return lines.join("\n");
}
