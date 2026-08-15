// ═══════════════════════════════════════════════════════════════════
//  ACADEXA AI — centralized multi-provider configuration. This is the
//  ONLY place provider priority/models/timeouts are decided. Nothing
//  here is ever sent to the frontend (see aiRoute.js).
//
//  Env var names below are intentionally NOT the "obvious" ones for
//  Groq/Cerebras/OpenRouter — they match exactly what's already in
//  backend/.env (Groq_API_KEY, care_brass_API_KEY, open_router_API_KEY),
//  preserved as-is rather than renamed.
// ═══════════════════════════════════════════════════════════════════

const num = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};

export const PROVIDERS = {
  gemini: {
    label: "Gemini",
    priority: num(process.env.AI_PRIORITY_GEMINI, 1),
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || "gemini-flash-latest",
    timeoutMs: num(process.env.AI_TIMEOUT_MS, 20000),
  },
  groq: {
    label: "Groq",
    priority: num(process.env.AI_PRIORITY_GROQ, 2),
    apiKey: process.env.Groq_API_KEY,
    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    baseURL: "https://api.groq.com/openai/v1",
    timeoutMs: num(process.env.AI_TIMEOUT_MS, 15000),
  },
  cerebras: {
    label: "Cerebras",
    priority: num(process.env.AI_PRIORITY_CEREBRAS, 3),
    apiKey: process.env.care_brass_API_KEY,
    // Verified live against GET /v1/models on this account — Cerebras's
    // catalog here is gpt-oss-120b / zai-glm-4.7 / gemma-4-31b, not the
    // llama-3.x family; picked the largest for the most reliable tool-calling.
    model: process.env.CEREBRAS_MODEL || "gpt-oss-120b",
    baseURL: "https://api.cerebras.ai/v1",
    timeoutMs: num(process.env.AI_TIMEOUT_MS, 15000),
  },
  openrouter: {
    label: "OpenRouter",
    priority: num(process.env.AI_PRIORITY_OPENROUTER, 4),
    apiKey: process.env.open_router_API_KEY,
    model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct",
    baseURL: "https://openrouter.ai/api/v1",
    timeoutMs: num(process.env.AI_TIMEOUT_MS, 20000),
  },
};

// "auto" = orchestrator picks primary + fallback order by priority among
// whichever providers actually have a key set. A specific name pins that
// one provider only (still subject to it actually being configured).
export const AI_PROVIDER_OVERRIDE = (process.env.AI_PROVIDER || "auto").toLowerCase();

export function isProviderConfigured(name) {
  return !!PROVIDERS[name]?.apiKey;
}

export function getConfiguredProviderNames() {
  return Object.keys(PROVIDERS).filter(isProviderConfigured);
}

// Priority-ordered list of provider names that are actually usable right
// now (have a key). Respects AI_PROVIDER pin when set to a specific name.
export function getProviderOrder() {
  const configured = getConfiguredProviderNames().sort((a, b) => PROVIDERS[a].priority - PROVIDERS[b].priority);
  if (AI_PROVIDER_OVERRIDE !== "auto" && configured.includes(AI_PROVIDER_OVERRIDE)) {
    return [AI_PROVIDER_OVERRIDE, ...configured.filter((n) => n !== AI_PROVIDER_OVERRIDE)];
  }
  return configured;
}
