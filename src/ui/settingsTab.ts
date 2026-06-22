import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type AiAssistantPlugin from "../main";
import { LlmConnection, LlmProvider, generateConnectionId } from "../settings";

const MODEL_PLACEHOLDERS: Record<LlmProvider, string> = {
  copilot: "e.g. gpt-4.1-mini",
  claude: "e.g. claude-sonnet-4-20250514",
  "claude-proxy": "e.g. anthropic/claude-3.7-sonnet",
  gemini: "e.g. gemini-2.0-flash",
  cli: "",
};

export class AiAssistantSettingTab extends PluginSettingTab {
  plugin: AiAssistantPlugin;

  constructor(app: App, plugin: AiAssistantPlugin) {
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

    // Name
    new Setting(containerEl)
      .setName("Name")
      .setDesc(
        isDefault
          ? "Identifies this connection in templates (ai-llm: Name). Currently the default."
          : "Identifies this connection in templates (ai-llm: Name)."
      )
      .addText(text =>
        text
          .setPlaceholder("e.g. Work Claude")
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
            await this.plugin.saveSettings();
          })
      );

    // Provider
    new Setting(containerEl)
      .setName("Provider")
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
    new Setting(containerEl)
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
      new Setting(containerEl)
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

      new Setting(containerEl)
        .setName("Copilot API key")
        .setDesc("API key / token for Copilot. Required.")
        .addText(text =>
          text
            .setPlaceholder("token...")
            .setValue(conn.apiKey)
            .onChange(async (value) => {
              conn.apiKey = value.trim();
              await this.plugin.saveSettings();
            })
        );
    }

    if (conn.provider === "claude") {
      new Setting(containerEl)
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

      new Setting(containerEl)
        .setName("Claude API key")
        .setDesc("API key for Claude. Required.")
        .addText(text =>
          text
            .setPlaceholder("sk-ant-...")
            .setValue(conn.apiKey)
            .onChange(async (value) => {
              conn.apiKey = value.trim();
              await this.plugin.saveSettings();
            })
        );
    }

    if (conn.provider === "claude-proxy") {
      new Setting(containerEl)
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

      new Setting(containerEl)
        .setName("Claude proxy API key")
        .setDesc("OpenAI-format API key for the proxy. Sent as Authorization: Bearer <key>.")
        .addText(text =>
          text
            .setPlaceholder("sk-...")
            .setValue(conn.apiKey)
            .onChange(async (value) => {
              conn.apiKey = value.trim();
              await this.plugin.saveSettings();
            })
        );
    }

    if (conn.provider === "gemini") {
      new Setting(containerEl)
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

      new Setting(containerEl)
        .setName("Gemini API key")
        .setDesc("API key for Gemini. Required.")
        .addText(text =>
          text
            .setPlaceholder("AI...")
            .setValue(conn.apiKey)
            .onChange(async (value) => {
              conn.apiKey = value.trim();
              await this.plugin.saveSettings();
            })
        );
    }

    if (conn.provider === "cli") {
      new Setting(containerEl)
        .setName("CLI command")
        .setDesc("Binary name (e.g. claude) or absolute path. The prompt text is piped to stdin.")
        .addText(text =>
          text
            .setPlaceholder("claude")
            .setValue(conn.cliCommand)
            .onChange(async (value) => {
              conn.cliCommand = value.trim();
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
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

      new Setting(containerEl)
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

    // Set-as-default + Remove controls
    const controls = new Setting(containerEl);
    controls.addButton(btn => {
      if (isDefault) {
        btn.setButtonText("★ Default").setDisabled(true);
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
          if (this.plugin.settings.defaultConnectionId === conn.id) {
            const first = this.plugin.settings.connections[0];
            if (first) this.plugin.settings.defaultConnectionId = first.id;
          }
          await this.plugin.saveSettings();
          this.display();
        })
    );
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // ── Section A: Connections ─────────────────────────────────────────────────
    this.addSectionHeader(
      "LLM connections",
      "Add one or more named connections. The default is used for 'Ask AI'; templates can override it via ai-llm: <Name>."
    );

    const connections = this.plugin.settings.connections;
    let connIdx = 0;
    for (const conn of connections) {
      if (connIdx > 0) {
        containerEl.createEl("hr");
      }
      this.renderConnection(conn);
      connIdx++;
    }

    new Setting(containerEl)
      .addButton(btn =>
        btn
          .setButtonText("+ Add connection")
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
      .setDesc("Vault-relative path to the folder containing your prompt template files (used by 'Ask AI with template').")
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
      .setDesc("When enabled, all vault note names (minus exclusions) are appended to the prompt so the AI can create [[Note Name]] links.")
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
        new Setting(containerEl)
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
      });

      new Setting(containerEl)
        .addButton(btn =>
          btn
            .setButtonText("+ Add pattern")
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
      .setDesc("Markdown heading inserted above the AI result (e.g. AI Result). Leave empty for no heading.")
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
  }
}
