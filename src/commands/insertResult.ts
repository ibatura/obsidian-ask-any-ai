import { App, Editor, Notice, TFile } from "obsidian";
import { AskAnyAiSettings, LlmConnection } from "../settings";
import { resolveInlinePrompt } from "../core/promptResolver";
import { expandObsidianLinks } from "../core/linkResolver";
import { buildNoteNamesBlock } from "../core/noteNamesContext";
import { resolveConnection } from "../core/connectionResolver";
import { parseTemplateOverrides, applyOverrides, stripFrontmatter } from "../core/templateOverrides";
import { createLlmClient } from "../core/llmClient";
import { PromptPickerModal } from "../ui/promptPickerModal";
import { showProgressIndicator } from "../ui/progressIndicator";

function getRawInput(editor: Editor): string {
  const selection = editor.getSelection();
  return selection.trim()
    ? selection
    : editor.getLine(editor.getCursor().line);
}

async function runRequest(
  editor: Editor,
  file: TFile,
  app: App,
  settings: AskAnyAiSettings,
  connection: LlmConnection,
  rawInput: string,
  systemPrompt: string,
): Promise<void> {
  const progress = showProgressIndicator("Preparing request...");

  try {
    // Step 1: Expand Obsidian links
    progress.updateStatus("Expanding links...", 10);
    const { expanded, unresolved } = await expandObsidianLinks(rawInput, file.path, app);
    if (unresolved.length > 0) {
      new Notice(`Could not resolve links: ${unresolved.join(", ")}`);
    }

    // Step 2: Append vault note names block if enabled
    let resolvedSystemPrompt = systemPrompt;
    if (settings.includeVaultNoteNames) {
      progress.updateStatus("Building note list...", 25);
      const noteBlock = buildNoteNamesBlock(app, settings.vaultNoteNamesExclusions, settings.includeNoteAliases);
      resolvedSystemPrompt = resolvedSystemPrompt ? `${resolvedSystemPrompt}\n\n${noteBlock}` : noteBlock;
    }

    // Step 3: Call LLM
    progress.updateStatus(`Sending to ${connection.name}...`, 30);
    const client = createLlmClient(connection, settings.timeoutMs);
    progress.updateStatus("Waiting for response...", 50);
    const result = await client.generateResult({ systemPrompt: resolvedSystemPrompt, userContent: expanded });

    if (!result) {
      progress.close();
      new Notice("AI returned empty result");
      return;
    }

    // Step 4: Insert result
    progress.updateStatus("Processing response...", 85);

    let block = "\n\n";

    if (settings.debug) {
      const model = connection.model.trim() || "(default)";
      const systemBlock = resolvedSystemPrompt.trim()
        ? "```text\n" + resolvedSystemPrompt + "\n```"
        : "_(empty)_";
      block +=
        `## AI Request (debug)\n\n` +
        `**Connection:** ${connection.name}\n` +
        `**Provider:** ${connection.provider}\n` +
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

/**
 * "Ask AI" command — sends selected text (or current line) directly to the LLM.
 * Uses the inline system prompt if `llmIncludeInlineSystemPrompt` is enabled,
 * otherwise sends with no system prompt.
 */
export async function insertLlmResultRaw(
  editor: Editor,
  file: TFile | null,
  app: App,
  settings: AskAnyAiSettings,
): Promise<void> {
  if (!file) {
    new Notice("No active file");
    return;
  }

  const rawInput = getRawInput(editor);
  if (!rawInput.trim()) {
    new Notice("Nothing to send to AI agent");
    return;
  }

  const { connection, warnings } = resolveConnection(settings, {});
  if (warnings.length > 0) {
    new Notice(warnings.map((w) => `• ${w}`).join("\n"));
  }
  if (!connection) return;

  const systemPrompt = resolveInlinePrompt(settings);
  await runRequest(editor, file, app, settings, connection, rawInput, systemPrompt);
}

/**
 * "Ask AI with template" command — opens the prompt-file picker, uses the chosen
 * template as the primary system prompt, and optionally prepends the inline prompt
 * when `llmIncludeInlineSystemPrompt` is enabled.
 *
 * Template frontmatter (`ai-*` properties) is parsed and applied as per-run
 * overrides; the frontmatter block itself is stripped before the body is sent
 * to the model.
 */
export async function insertLlmResultWithTemplate(
  editor: Editor,
  file: TFile | null,
  app: App,
  settings: AskAnyAiSettings,
): Promise<void> {
  if (!file) {
    new Notice("No active file");
    return;
  }

  const rawInput = getRawInput(editor);
  if (!rawInput.trim()) {
    new Notice("Nothing to send to AI agent");
    return;
  }

  // Open picker before showing progress so the UI isn't obscured
  const picked = await new PromptPickerModal(app, settings).openAndAwait();
  if (picked === "cancelled") {
    new Notice("Cancelled");
    return;
  }

  // Parse template frontmatter overrides
  const cache = picked ? app.metadataCache.getFileCache(picked) : null;
  const { overrides, llmName, modelOverride, warnings: parseWarnings } = parseTemplateOverrides(cache?.frontmatter ?? null);
  const { effective: effectiveSettings, warnings: applyWarnings } = applyOverrides(settings, overrides);
  const { connection, warnings: resolveWarnings } = resolveConnection(effectiveSettings, { llmName, modelOverride });

  const allWarnings = [...parseWarnings, ...applyWarnings, ...resolveWarnings];
  if (allWarnings.length > 0) {
    new Notice(
      `Template override warnings:\n${allWarnings.map((w) => `• ${w}`).join("\n")}`
    );
    console.warn("[ask-any-ai] Template override warnings:", allWarnings);
  }

  if (!connection) return;

  // Read template and strip frontmatter
  const rawContent = picked ? await app.vault.read(picked) : "";
  const templateContent = stripFrontmatter(rawContent, cache?.frontmatterPosition ?? undefined);

  // Build system prompt using effective settings
  const inlinePrompt = resolveInlinePrompt(effectiveSettings);
  const systemPrompt = inlinePrompt
    ? `${inlinePrompt}\n\n${templateContent}`
    : templateContent;

  await runRequest(editor, file, app, effectiveSettings, connection, rawInput, systemPrompt);
}
