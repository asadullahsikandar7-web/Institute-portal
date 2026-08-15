// ═══════════════════════════════════════════════════════════════════
//  AI SERVICE — thin compatibility layer over the multi-provider
//  orchestrator (backend/src/services/ai/). Kept as its own file, with
//  its original runAgent()/isAiConfigured() exports unchanged, so
//  aiRoute.js didn't need a rewrite when the single-provider Gemini
//  implementation that used to live directly in this file was replaced
//  by the Gemini/Groq/Cerebras/OpenRouter orchestrator.
// ═══════════════════════════════════════════════════════════════════
import { getToolsForRole, executeTool } from "./aiTools.js";
import { run as runOrchestrator, isAnyProviderConfigured } from "./ai/orchestrator.js";

/**
 * Runs one agent turn: sends the conversation to the orchestrator (which
 * picks provider(s) per its fallback/parallel strategy), executes any
 * tool calls via aiTools.executeTool — the real permission boundary — and
 * returns the final assistant message plus any pending write-actions.
 */
export async function runAgent({ user, messages, mode }) {
  if (!isAnyProviderConfigured()) {
    const err = new Error("No AI provider is configured");
    err.code = "AI_NOT_CONFIGURED";
    throw err;
  }

  const toolDefs = getToolsForRole(user.role);
  return runOrchestrator({ user, messages, mode, toolDefs, executeToolFn: executeTool });
}

export function isAiConfigured() {
  return isAnyProviderConfigured();
}
