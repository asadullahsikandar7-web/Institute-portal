// ═══════════════════════════════════════════════════════════════════
//  Owns provider health/circuit-breaker state and the module registry —
//  "easy provider addition/removal" means adding one more entry to
//  MODULES + config.js's PROVIDERS, nothing else needs to change.
// ═══════════════════════════════════════════════════════════════════
import * as gemini from "./providers/geminiProvider.js";
import * as groq from "./providers/groqProvider.js";
import * as cerebras from "./providers/cerebrasProvider.js";
import * as openrouter from "./providers/openrouterProvider.js";
import { PROVIDERS, getProviderOrder } from "./config.js";

const MODULES = { gemini, groq, cerebras, openrouter };

// In-memory circuit breaker — best-effort only. On Vercel this resets on
// every cold start (no persistent state across invocations); worst case a
// recently-failing provider just gets retried a little sooner than ideal,
// never anything unsafe. A DB-backed breaker (like AiAction/AiUsage) would
// be more durable but is overkill for what's purely a performance
// optimization, not a correctness or security requirement.
const COOLDOWN_MS = 60_000;
const FAILURE_THRESHOLD = 3;
const state = {};

function getState(name) {
  return (state[name] ??= { consecutiveFailures: 0, cooldownUntil: 0 });
}

export function recordSuccess(name) {
  state[name] = { consecutiveFailures: 0, cooldownUntil: 0 };
}

export function recordFailure(name) {
  const s = getState(name);
  s.consecutiveFailures += 1;
  if (s.consecutiveFailures >= FAILURE_THRESHOLD) s.cooldownUntil = Date.now() + COOLDOWN_MS;
}

export function isInCooldown(name) {
  return getState(name).cooldownUntil > Date.now();
}

export function getModule(name) {
  return MODULES[name];
}

// Priority-configured providers that are actually configured AND not
// presently in cooldown from repeated recent failures.
export function getHealthyProviderOrder() {
  return getProviderOrder().filter((n) => !isInCooldown(n));
}

export async function checkAllHealth() {
  const names = Object.keys(MODULES);
  const results = await Promise.allSettled(names.map((n) => MODULES[n].checkHealth()));
  return Object.fromEntries(names.map((n, i) => [n, results[i].status === "fulfilled" ? results[i].value : { ok: false, error: "check failed" }]));
}

export function getConfiguredSummary() {
  return Object.keys(PROVIDERS).map((name) => ({
    name,
    label: PROVIDERS[name].label,
    configured: MODULES[name].isConfigured(),
    priority: PROVIDERS[name].priority,
    model: PROVIDERS[name].model,
    inCooldown: isInCooldown(name),
  }));
}
