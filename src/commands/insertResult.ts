import { App, Editor, Notice, TFile } from "obsidian";
import { AiAssistantSettings } from "../settings";
import { resolveLlmPrompt } from "../core/promptResolver";
import { expandObsidianLinks } from "../core/linkResolver";
import { buildNoteNamesBlock } from "../core/noteNamesContext";
import { createLlmClient } from "../core/llmClient";
import { PromptPickerModal } from "../ui/promptPickerModal";
import { showProgressIndicator } from "../ui/progressIndicator";

function isValidHttpUrl(s: string): boolean {
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function validateProviderSettings(settings: AiAssistantSettings): string | null {
  switch (settings.llmProvider) {
    case "copilot":
      if (!isValidHttpUrl(settings.copilotApiBaseUrl)) return "Set a valid Copilot API base URL in plugin settings";
      if (!settings.copilotApiKey) return "Set a Copilot API key in plugin settings";
      return null;
    case "claude":
      if (settings.claudeApiBaseUrl && !isValidHttpUrl(settings.claudeApiBaseUrl)) return "Claude API base URL must be http(s)";
      if (!settings.claudeApiKey) return "Set a Claude API key in plugin settings";
      return null;
    case "claude-proxy":
      if (!isValidHttpUrl(settings.claudeProxyApiBaseUrl)) return "Set a valid Claude proxy API base URL in plugin settings";
      if (!settings.claudeProxyApiKey) return "Set a Claude proxy API key in plugin settings";
      return null;
    case "gemini":
      if (settings.geminiApiBaseUrl && !isValidHttpUrl(settings.geminiApiBaseUrl)) return "Gemini API base URL must be http(s)";
      if (!settings.geminiApiKey) return "Set a Gemini API key in plugin settings";
      return null;
    case "cli":
      if (!settings.cliCommand || !settings.cliCommand.trim()) return "Set a CLI command in plugin settings";
      return null;
    default:
      return "Unknown AI provider";
  }
}

export async function insertLlmResultInPlace(
  editor: Editor,
  file: TFile | null,
  app: App,
  settings: AiAssistantSettings
): Promise<void> {
  if (!file) {
    new Notice("No active file");
    return;
  }

  // Step 1: Input scope — selection or current line
  const selection = editor.getSelection();
  const rawInput = selection.trim()
    ? selection
    : editor.getLine(editor.getCursor().line);

  if (!rawInput.trim()) {
    new Notice("Nothing to send to AI Agent");
    return;
  }

  // Step 2: Open prompt picker before showing progress so the UI isn't obscured
  let pickedPromptFile: TFile | null = null;
  if (settings.llmPromptMode === "picker") {
    const picked = await new PromptPickerModal(app, settings).openAndAwait();
    if (picked === "cancelled") {
      new Notice("Cancelled");
      return;
    }
    pickedPromptFile = picked;
  }

  const progress = showProgressIndicator("Preparing request...");

  try {
    // Step 3: Expand Obsidian links
    progress.updateStatus("Expanding links...", 10);
    const { expanded, unresolved } = await expandObsidianLinks(rawInput, file.path, app);
    if (unresolved.length > 0) {
      new Notice(`Could not resolve links: ${unresolved.join(", ")}`);
    }

    // Step 4: Resolve prompt
    progress.updateStatus("Loading system prompt...", 20);
    let systemPrompt: string;
    if (settings.llmPromptMode === "picker") {
      systemPrompt = pickedPromptFile ? await app.vault.read(pickedPromptFile) : "";
    } else {
      systemPrompt = await resolveLlmPrompt(app, settings);
    }

    // Step 4.5: Append vault note names block if enabled
    if (settings.includeVaultNoteNames) {
      progress.updateStatus("Building note list...", 25);
      const noteBlock = buildNoteNamesBlock(app, settings.vaultNoteNamesExclusions);
      systemPrompt = systemPrompt ? `${systemPrompt}\n\n${noteBlock}` : noteBlock;
    }

    // Step 5: Validate provider
    const validationError = validateProviderSettings(settings);
    if (validationError) {
      progress.close();
      new Notice(validationError);
      return;
    }

    // Step 6: Call LLM
    const PROVIDER_LABELS: Record<string, string> = {
      copilot: "Copilot", claude: "Claude", "claude-proxy": "Claude (proxy)", gemini: "Gemini", cli: "CLI",
    };
    const providerLabel = PROVIDER_LABELS[settings.llmProvider] ?? settings.llmProvider;
    progress.updateStatus(`Sending to ${providerLabel}...`, 30);
    const client = createLlmClient(settings);
    progress.updateStatus("Waiting for response...", 50);
    const result = await client.generateResult({ systemPrompt, userContent: expanded });

    if (!result) {
      progress.close();
      new Notice("AI returned empty result");
      return;
    }

    // Step 7: Insert result
    progress.updateStatus("Processing response...", 85);

    let block = "\n\n";

    if (settings.debug) {
      const model = settings.llmModel.trim() || "(default)";
      const systemBlock = systemPrompt.trim()
        ? "```text\n" + systemPrompt + "\n```"
        : "_(empty)_";
      block +=
        `## AI Request (debug)\n\n` +
        `**Provider:** ${settings.llmProvider}\n` +
        `**Model:** ${model}\n\n` +
        `### System prompt\n\n${systemBlock}\n\n` +
        `### User content\n\n\`\`\`text\n${expanded}\n\`\`\`\n\n`;
    }

    const heading = settings.llmResultHeading.trim();
    if (heading) block += `## ${heading}\n\n`;
    block += result + "\n";

    progress.updateStatus("Inserting result...", 95);
    const mode = settings.insertPosition;
    if (mode === "end-of-file") {
      const lastLine = editor.lastLine();
      editor.replaceRange(block, { line: lastLine + 1, ch: 0 });
    } else if (mode === "at-cursor") {
      editor.replaceSelection(block);
    } else {
      const cursor = editor.getCursor("to");
      editor.replaceRange(block, { line: cursor.line + 1, ch: 0 });
    }

    progress.complete();
  } catch (e) {
    console.error(e);
    progress.close();
    new Notice("Error while calling AI, see console");
  }
}
