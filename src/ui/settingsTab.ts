import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type AskAnyAiPlugin from "../main";
import { LlmConnection, LlmProvider, generateConnectionId } from "../settings";
import { validateConnection } from "../core/providerValidation";
import { addSecretSetting } from "./secretField";
import { TEMPLATE_PARAM_DOCS, buildExampleFrontmatter } from "./templateReference";

const MODEL_PLACEHOLDERS: Record<LlmProvider, string> = {
  copilot: "e.g. gpt-4.1-mini",
  claude: "e.g. claude-sonnet-4-20250514",
  "claude-proxy": "e.g. anthropic/claude-3.7-sonnet",
  gemini: "e.g. gemini-2.0-flash",
  cli: "",
};

const PROVIDER_LABELS: Record<LlmProvider, string> = {
  copilot: "Copilot",
  claude: "Claude",
  "claude-proxy": "Claude (proxy)",
  gemini: "Gemini",
  cli: "Local CLI",
};

export class AskAnyAiSettingTab extends PluginSettingTab {
  plugin: AskAnyAiPlugin;

  /** Connection ids whose cards are currently expanded, preserved across display() re-renders. */
  private expandedConnectionIds = new Set<string>();

  constructor(app: App, plugin: AskAnyAiPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  private addSectionHeader(name: string, description: string): void {
    new Setting(this.containerEl)
      .setHeading()
      .setName(name)
      .setDesc(description);
  }

  private renderConnection(conn: LlmConnection): void {
    const { containerEl } = this;
    const isDefault = conn.id === this.plugin.settings.defaultConnectionId;

    // Collapsible card
    const card = containerEl.createEl("details", { cls: "ai-conn-card" });
    card.open = this.expandedConnectionIds.has(conn.id);
    card.addEventListener("toggle", () => {
      if (card.open) this.expandedConnectionIds.add(conn.id);
      else this.expandedConnectionIds.delete(conn.id);
    });

    // Summary header: name · provider pill · default badge · warning
    const summary = card.createEl("summary", { cls: "ai-conn-summary" });
    const nameEl = summary.createEl("span", { cls: "ai-conn-name", text: conn.name });
    summary.createEl("span", { cls: "ai-conn-pill", text: PROVIDER_LABELS[conn.provider] });
    if (isDefault) {
      summary.createEl("span", { cls: "ai-conn-badge", text: "★ default" });
    }
    const validationError = validateConnection(conn);
    if (validationError) {
      const warn = summary.createEl("span", { cls: "ai-conn-warning", text: "⚠" });
      warn.setAttr("title", validationError);
    }

    // Name
    new Setting(card)
      .setName("Name")
      .setDesc(
        isDefault
          ? "Identifies this connection in templates (ai-llm: Name). Currently the default."
          : "Identifies this connection in templates (ai-llm: Name)."
      )
      .addText(text =>
        text
          .setPlaceholder("Work Claude")
          .setValue(conn.name)
          .onChange(async (value) => {
            const trimmed = value.trim();
            if (!trimmed) {
              new Notice("Connection name cannot be empty.");
              text.setValue(conn.name);
              return;
            }
            const duplicate = this.plugin.settings.connections.some(
              c => c.id !== conn.id && c.name.trim().toLowerCase() === trimmed.toLowerCase()
            );
            if (duplicate) {
              new Notice(`Name "${trimmed}" is already used by another connection.`);
              text.setValue(conn.name);
              return;
            }
            conn.name = trimmed;
            nameEl.setText(trimmed);
            await this.plugin.saveSettings();
          })
      );

    // Provider
    new Setting(card)
      .setName("Provider")
      .setDesc("The service this connection talks to. Changing it updates the fields below.")
      .addDropdown(drop =>
        drop
          .addOption("copilot", "Copilot")
          .addOption("claude", "Claude")
          .addOption("claude-proxy", "Claude (proxy)")
          .addOption("gemini", "Gemini")
          .addOption("cli", "Local CLI")
          .setValue(conn.provider)
          .onChange(async (value) => {
            conn.provider = value as LlmProvider;
            await this.plugin.saveSettings();
            this.display();
          })
      );

    // Model
    new Setting(card)
      .setName("Default model")
      .setDesc("Override the provider default. Leave empty to use the provider's built-in default.")
      .addText(text =>
        text
          .setPlaceholder(MODEL_PLACEHOLDERS[conn.provider])
          .setValue(conn.model)
          .onChange(async (value) => {
            conn.model = value.trim();
            await this.plugin.saveSettings();
          })
      );

    // Credentials per provider
    if (conn.provider === "copilot") {
      new Setting(card)
        .setName("Copilot API base URL")
        .setDesc("Base URL for the Copilot (or Copilot proxy) endpoint.")
        .addText(text =>
          text
            .setPlaceholder("https://api.githubcopilot.com")
            .setValue(conn.baseUrl)
            .onChange(async (value) => {
              conn.baseUrl = value.trim();
              await this.plugin.saveSettings();
            })
        );

      addSecretSetting(card, {
        name: "Copilot API key",
        desc: "API key / token for Copilot. Required.",
        placeholder: "token...",
        getValue: () => conn.apiKey,
        setValue: async (value) => {
          conn.apiKey = value;
          await this.plugin.saveSettings();
        },
      });
    }

    if (conn.provider === "claude") {
      new Setting(card)
        .setName("Claude API base URL")
        .setDesc("Base URL for the Anthropic Messages API. Leave empty to use the default.")
        .addText(text =>
          text
            .setPlaceholder("https://api.anthropic.com")
            .setValue(conn.baseUrl)
            .onChange(async (value) => {
              conn.baseUrl = value.trim();
              await this.plugin.saveSettings();
            })
        );

      addSecretSetting(card, {
        name: "Claude API key",
        desc: "API key for Claude. Required.",
        placeholder: "sk-ant-...",
        getValue: () => conn.apiKey,
        setValue: async (value) => {
          conn.apiKey = value;
          await this.plugin.saveSettings();
        },
      });
    }

    if (conn.provider === "claude-proxy") {
      new Setting(card)
        .setName("Claude proxy API base URL")
        .setDesc("Base URL of an OpenAI-compatible endpoint that exposes Claude (e.g. OpenRouter, Together, internal gateway).")
        .addText(text =>
          text
            .setPlaceholder("https://openrouter.ai/api")
            .setValue(conn.baseUrl)
            .onChange(async (value) => {
              conn.baseUrl = value.trim();
              await this.plugin.saveSettings();
            })
        );

      addSecretSetting(card, {
        name: "Claude proxy API key",
        desc: "OpenAI-format API key for the proxy. Sent as Authorization: Bearer <key>.",
        placeholder: "sk-...",
        getValue: () => conn.apiKey,
        setValue: async (value) => {
          conn.apiKey = value;
          await this.plugin.saveSettings();
        },
      });
    }

    if (conn.provider === "gemini") {
      new Setting(card)
        .setName("Gemini API base URL")
        .setDesc("Base URL for the Gemini API. Leave empty to use the default.")
        .addText(text =>
          text
            .setPlaceholder("https://generativelanguage.googleapis.com")
            .setValue(conn.baseUrl)
            .onChange(async (value) => {
              conn.baseUrl = value.trim();
              await this.plugin.saveSettings();
            })
        );

      addSecretSetting(card, {
        name: "Gemini API key",
        desc: "API key for Gemini. Required.",
        placeholder: "AI...",
        getValue: () => conn.apiKey,
        setValue: async (value) => {
          conn.apiKey = value;
          await this.plugin.saveSettings();
        },
      });
    }

    if (conn.provider === "cli") {
      new Setting(card)
        .setName("CLI command")
        .setDesc("Binary name (for example, `claude`) or absolute path. The prompt text is piped to stdin.")
        .addText(text =>
          text
            .setPlaceholder("claude")
            .setValue(conn.cliCommand)
            .onChange(async (value) => {
              conn.cliCommand = value.trim();
              await this.plugin.saveSettings();
            })
        );

      new Setting(card)
        .setName("CLI arguments")
        .setDesc("Extra arguments passed to the CLI, space-separated.")
        .addText(text =>
          text
            .setPlaceholder("-p")
            .setValue(conn.cliArgs)
            .onChange(async (value) => {
              conn.cliArgs = value;
              await this.plugin.saveSettings();
            })
        );

      new Setting(card)
        .setName("Working directory")
        .setDesc("Leave empty to inherit from Obsidian; override to run in a specific directory.")
        .addText(text =>
          text
            .setPlaceholder("/path/to/cwd (optional)")
            .setValue(conn.cliCwd)
            .onChange(async (value) => {
              conn.cliCwd = value.trim();
              await this.plugin.saveSettings();
            })
        );
    }

    // Footer: set-as-default + remove
    const controls = new Setting(card);
    controls.settingEl.addClass("ai-conn-footer");
    controls.addButton(btn => {
      if (isDefault) {
        btn.setButtonText("★ default").setDisabled(true);
      } else {
        btn.setButtonText("Set as default").onClick(async () => {
          this.plugin.settings.defaultConnectionId = conn.id;
          await this.plugin.saveSettings();
          this.display();
        });
      }
      return btn;
    });
    controls.addButton(btn =>
      btn
        .setButtonText("Remove")
        .setWarning()
        .onClick(async () => {
          if (this.plugin.settings.connections.length <= 1) {
            new Notice("At least one connection is required.");
            return;
          }
          const idx = this.plugin.settings.connections.findIndex(c => c.id === conn.id);
          this.plugin.settings.connections.splice(idx, 1);
          this.expandedConnectionIds.delete(conn.id);
          if (this.plugin.settings.defaultConnectionId === conn.id) {
            const first = this.plugin.settings.connections[0];
            if (first) this.plugin.settings.defaultConnectionId = first.id;
          }
          await this.plugin.saveSettings();
          this.display();
        })
    );
  }

  private renderTemplateReference(): void {
    const { containerEl } = this;

    const details = containerEl.createEl("details", { cls: "ai-help" });
    details.createEl("summary", {
      cls: "ai-help-summary",
      text: "Template & override reference",
    });

    details.createEl("p", {
      cls: "ai-help-intro",
      text:
        "Add these `ai-*` keys to a prompt template's YAML frontmatter to override the matching global setting for that single run. An invalid value falls back to the global setting with a warning.",
    });

    const pre = details.createEl("pre", { cls: "ai-help-example" });
    pre.createEl("code", { text: buildExampleFrontmatter() });

    const table = details.createEl("table", { cls: "ai-help-table" });
    const headRow = table.createEl("thead").createEl("tr");
    for (const heading of ["Key", "Type", "Overrides setting", "What it does & why", "Example"]) {
      headRow.createEl("th", { text: heading });
    }

    const body = table.createEl("tbody");
    for (const doc of TEMPLATE_PARAM_DOCS) {
      const row = body.createEl("tr");
      row.createEl("td").createEl("code", { text: doc.key });
      row.createEl("td", { text: doc.type });

      const overridesCell = row.createEl("td");
      overridesCell.createEl("strong", { text: doc.overridesSetting });
      overridesCell.createEl("div", { cls: "ai-help-detail", text: doc.overridesDetail });

      row.createEl("td", { text: doc.description });
      row.createEl("td").createEl("code", { text: doc.example });
    }
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // ── Section A: Connections ─────────────────────────────────────────────────
    this.addSectionHeader(
      "LLM connections",
      "Add one or more named connections. The default is used for 'Ask AI'; templates can override it via ai-llm: <Name>."
    );

    for (const conn of this.plugin.settings.connections) {
      this.renderConnection(conn);
    }

    new Setting(containerEl)
      .addButton(btn =>
        btn
          .setButtonText("+ add connection")
          .onClick(async () => {
            const existing = new Set(
              this.plugin.settings.connections.map(c => c.name.toLowerCase())
            );
            let candidate = "New connection";
            let n = 2;
            while (existing.has(candidate.toLowerCase())) {
              candidate = `New connection ${n++}`;
            }
            const conn: LlmConnection = {
              id: generateConnectionId(),
              name: candidate,
              provider: "copilot",
              model: "",
              baseUrl: "",
              apiKey: "",
              cliCommand: "",
              cliArgs: "",
              cliCwd: "",
            };
            this.plugin.settings.connections.push(conn);
            this.expandedConnectionIds.add(conn.id);
            await this.plugin.saveSettings();
            this.display();
          })
      );

    new Setting(containerEl)
      .setName("Request timeout")
      .setDesc("Maximum time in milliseconds to wait for a response. Default: 60000 ms (1 minute).")
      .addText(text =>
        text
          .setPlaceholder("60000")
          .setValue(String(this.plugin.settings.timeoutMs))
          .onChange(async (value) => {
            const parsed = parseInt(value, 10);
            if (!isNaN(parsed) && parsed > 0) {
              this.plugin.settings.timeoutMs = parsed;
              await this.plugin.saveSettings();
            }
          })
      );

    // ── Section C: System prompt & templates ──────────────────────────────────
    this.addSectionHeader(
      "System prompt & templates",
      "Configure the system prompt sent alongside requests. Use 'Ask AI' to send raw text, or 'Ask AI with template' to pick a prompt file from your vault."
    );

    new Setting(containerEl)
      .setName("System prompt")
      .setDesc(
        "Instruction sent to the AI as the system message when the toggle below is enabled. " +
        "For 'Ask AI with template', this is prepended before the chosen template."
      )
      .addTextArea(text =>
        text
          .setPlaceholder("Describe what the AI should produce...")
          .setValue(this.plugin.settings.llmInlinePrompt)
          .onChange(async (value) => {
            this.plugin.settings.llmInlinePrompt = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Include system prompt")
      .setDesc(
        "When enabled, the system prompt above is sent alongside your document selection. " +
        "When disabled, only your document selection is sent (or just the template for 'Ask AI with template')."
      )
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.llmIncludeInlineSystemPrompt)
          .onChange(async (value) => {
            this.plugin.settings.llmIncludeInlineSystemPrompt = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Prompts templates folder")
      .setDesc("Vault-relative path to the folder containing your prompt template files (used by `Ask AI with template`).")
      .addText(text =>
        text
          .setPlaceholder("Prompts templates/AI")
          .setValue(this.plugin.settings.llmPromptsFolder)
          .onChange(async (value) => {
            this.plugin.settings.llmPromptsFolder = value.trim();
            await this.plugin.saveSettings();
          })
      );

    // ── Section D: Vault note names in context ────────────────────────────────
    this.addSectionHeader(
      "Vault note names in context",
      "Enrich the AI context with a list of existing note names so the AI can reference them as [[wiki-links]]."
    );

    new Setting(containerEl)
      .setName("Include vault note names in LLM context")
      .setDesc("When enabled, all vault note names (minus exclusions) are appended to the prompt so the AI can create `[[Note Name]]` links.")
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.includeVaultNoteNames)
          .onChange(async (value) => {
            this.plugin.settings.includeVaultNoteNames = value;
            await this.plugin.saveSettings();
            this.display();
          })
      );

    new Setting(containerEl)
      .setName("Include note aliases")
      .setDesc("When enabled, each note's aliases (from its frontmatter) are listed alongside it in the note-names block. Only has an effect when vault note names are included.")
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.includeNoteAliases)
          .onChange(async (value) => {
            this.plugin.settings.includeNoteAliases = value;
            await this.plugin.saveSettings();
          })
      );

    if (this.plugin.settings.includeVaultNoteNames) {
      new Setting(containerEl)
        .setName("Excluded name patterns")
        .setDesc(
          "Notes whose name or vault path matches any pattern are excluded. " +
          "Supports *, **, and ?. Case-insensitive. " +
          "Patterns without / match the note basename; patterns with / match the vault-relative path."
        );

      const exclusions = this.plugin.settings.vaultNoteNamesExclusions;
      exclusions.forEach((pattern, idx) => {
        const row = new Setting(containerEl)
          .addText(text =>
            text
              .setPlaceholder("Untitled*")
              .setValue(pattern)
              .onChange(async (value) => {
                this.plugin.settings.vaultNoteNamesExclusions[idx] = value;
                await this.plugin.saveSettings();
              })
          )
          .addButton(btn =>
            btn
              .setIcon("trash")
              .setTooltip("Remove pattern")
              .onClick(async () => {
                this.plugin.settings.vaultNoteNamesExclusions.splice(idx, 1);
                await this.plugin.saveSettings();
                this.display();
              })
          );
        row.settingEl.addClass("ai-exclusion-row");
      });

      new Setting(containerEl)
        .addButton(btn =>
          btn
            .setButtonText("+ add pattern")
            .onClick(async () => {
              this.plugin.settings.vaultNoteNamesExclusions.push("");
              await this.plugin.saveSettings();
              this.display();
            })
        );
    }

    // ── Section E: Result Insertion ───────────────────────────────────────────
    this.addSectionHeader(
      "Where to insert results",
      "Configure how and where AI responses appear in your document."
    );

    new Setting(containerEl)
      .setName("Result heading")
      .setDesc("Markdown heading inserted above the AI result (e.g. `AI Result`). Leave empty for no heading.")
      .addText(text =>
        text
          .setPlaceholder("AI Result")
          .setValue(this.plugin.settings.llmResultHeading)
          .onChange(async (value) => {
            this.plugin.settings.llmResultHeading = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Insert position")
      .setDesc("Where to place the AI result in the note.")
      .addDropdown(drop =>
        drop
          .addOption("after-selection", "After selection (or cursor line)")
          .addOption("at-cursor", "At cursor (replaces selection)")
          .addOption("end-of-file", "At end of file")
          .setValue(this.plugin.settings.insertPosition)
          .onChange(async (value) => {
            this.plugin.settings.insertPosition = value as "after-selection" | "at-cursor" | "end-of-file";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Debug")
      .setDesc("When enabled, insert the full request sent to the AI before the AI result.")
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.debug)
          .onChange(async (value) => {
            this.plugin.settings.debug = value;
            await this.plugin.saveSettings();
          })
      );

    // ── Section F: Template & override reference ──────────────────────────────
    this.renderTemplateReference();
  }
}
