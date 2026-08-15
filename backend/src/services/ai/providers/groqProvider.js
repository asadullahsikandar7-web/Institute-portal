import { PROVIDERS } from "../config.js";
import { openAiCompatibleGenerateWithTools, openAiCompatibleCheckHealth } from "./openaiCompatible.js";

const cfg = PROVIDERS.groq;

export const name = "groq";

export function isConfigured() {
  return !!cfg.apiKey;
}

export async function checkHealth() {
  if (!isConfigured()) return { ok: false, error: "not configured" };
  return openAiCompatibleCheckHealth({ providerName: name, apiKey: cfg.apiKey, baseURL: cfg.baseURL, timeoutMs: 6000 });
}

export async function generateWithTools(args) {
  if (!isConfigured()) throw Object.assign(new Error("Groq is not configured"), { provider: name, code: "NOT_CONFIGURED" });
  return openAiCompatibleGenerateWithTools({ providerName: name, apiKey: cfg.apiKey, baseURL: cfg.baseURL, model: cfg.model, timeoutMs: cfg.timeoutMs, ...args });
}
