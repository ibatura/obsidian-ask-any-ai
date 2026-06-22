import { AiAssistantSettings, LlmConnection } from "../settings";
import { validateConnection } from "./providerValidation";

export function getDefaultConnection(settings: AiAssistantSettings): LlmConnection | null {
  const byId = settings.connections.find(c => c.id === settings.defaultConnectionId);
  if (byId) return byId;
  if (settings.connections.length > 0) return settings.connections[0] ?? null;
  return null;
}

export interface ResolveResult {
  connection: LlmConnection | null;
  warnings: string[];
}

export function resolveConnection(
  settings: AiAssistantSettings,
  options: { llmName?: string; modelOverride?: string }
): ResolveResult {
  const warnings: string[] = [];
  let isTemplateSelection = false;

  // Step 1: pick connection by name or default
  let chosen: LlmConnection | null;
  if (options.llmName) {
    const nameLower = options.llmName.trim().toLowerCase();
    const found = settings.connections.find(c => c.name.trim().toLowerCase() === nameLower);
    if (found) {
      chosen = found;
      isTemplateSelection = true;
    } else {
      warnings.push(
        `Template specifies connection "${options.llmName}" which is not configured — using the default connection.`
      );
      chosen = getDefaultConnection(settings);
    }
  } else {
    chosen = getDefaultConnection(settings);
  }

  if (!chosen) {
    warnings.push("No LLM connection is configured. Add one in plugin settings.");
    return { connection: null, warnings };
  }

  // Step 2: validate
  const error = validateConnection(chosen);
  if (error) {
    if (isTemplateSelection) {
      warnings.push(
        `Connection "${chosen.name}" has incomplete settings (${error}) — falling back to the default connection.`
      );
      const def = getDefaultConnection(settings);
      if (!def) {
        warnings.push("No LLM connection is configured. Add one in plugin settings.");
        return { connection: null, warnings };
      }
      const defError = validateConnection(def);
      if (defError) {
        warnings.push(
          `Default connection is also misconfigured: ${defError}. Please fix your connections in plugin settings.`
        );
        return { connection: null, warnings };
      }
      // Apply model override to the fallback connection
      const final = options.modelOverride ? { ...def, model: options.modelOverride } : def;
      return { connection: final, warnings };
    } else {
      warnings.push(`${error}. Please fix your connection in plugin settings.`);
      return { connection: null, warnings };
    }
  }

  // Step 3: apply model override to a clone
  const final = options.modelOverride ? { ...chosen, model: options.modelOverride } : chosen;
  return { connection: final, warnings };
}
