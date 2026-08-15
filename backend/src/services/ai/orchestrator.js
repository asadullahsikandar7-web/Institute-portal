// ═══════════════════════════════════════════════════════════════════
//  ACADEXA AI Orchestrator — the ONLY layer that decides which
//  provider(s) actually handle a request. Nothing else in the app
//  (routes, tools, frontend) knows or cares whether an answer came from
//  Gemini, Groq, Cerebras, or OpenRouter.
// ═══════════════════════════════════════════════════════════════════
import { PROVIDERS } from "./config.js";
import { systemPrompt } from "./prompts.js";
import * as providerManager from "./providerManager.js";

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error(`${label} timed out after ${ms}ms`), { code: "TIMEOUT" })), ms)),
  ]);
}

// Small, explicit heuristic rather than a real classifier — good enough to
// separate "quick factual lookup" from "give me a real analysis", which is
// the only distinction that matters for deciding whether extra provider
// calls (extra quota, extra latency) are worth it.
const COMPLEX_HINTS = /\b(analy[sz]e|compare|improvement plan|detailed|comprehensive|recommend|strategy)\b/i;

export function inferMode(message, requestedMode) {
  if (requestedMode === "parallel") return "parallel";
  if (requestedMode && requestedMode !== "auto") return "auto"; // unrecognized value — don't guess, just run normally
  return COMPLEX_HINTS.test(message || "") ? "parallel" : "auto";
}

async function callProvider(providerName, ctx) {
  const mod = providerManager.getModule(providerName);
  const cfg = PROVIDERS[providerName];
  try {
    const result = await withTimeout(mod.generateWithTools(ctx), cfg.timeoutMs, providerName);
    providerManager.recordSuccess(providerName);
    console.log(`[ACADEXA AI] Provider: ${providerName} | Success${result.toolTrace.length ? ` | Tools: ${result.toolTrace.map((t) => t.tool).join(",")}` : ""}`);
    return { providerName, ...result };
  } catch (err) {
    providerManager.recordFailure(providerName);
    console.error(`[ACADEXA AI] Provider: ${providerName} | Failed: ${err.message}`);
    throw err;
  }
}

async function runSequential(order, ctx) {
  let lastErr;
  for (const providerName of order) {
    try {
      return await callProvider(providerName, ctx);
    } catch (err) {
      lastErr = err;
      // fall through to the next provider in priority order
    }
  }
  throw lastErr || Object.assign(new Error("No AI provider is configured"), { code: "AI_NOT_CONFIGURED" });
}

// Parallel/consensus mode. Tools only ever execute ONCE, through the
// primary provider — this is deliberate: if a write tool (createLeaveRequest,
// sendParentEmail) fired independently from 2-3 providers we'd get 2-3
// duplicate pending actions from one user message. So the primary pass is
// the only one allowed to touch tools; if it happened to trigger a write,
// we stop there rather than layering extra "perspectives" onto a
// now-pending confirmation. Otherwise, the *same* grounded data/answer is
// handed to up to 2 more healthy providers with no tools attached (pure
// prose, can't touch the DB), and we keep the most substantive response —
// no extra AI call spent "synthesizing", per the brief's own guidance not
// to burn quota combining answers unnecessarily.
async function runParallel(order, ctx) {
  // Grounding pass uses the same fallback-until-success as sequential mode
  // — whichever provider actually succeeds first handles tools, not
  // blindly order[0] (an early version of this did that, and a struggling
  // primary provider would fail the *entire* parallel request instead of
  // handing off, exactly the bug sequential mode exists to avoid).
  let primary, primaryIndex = -1, lastErr;
  for (let i = 0; i < order.length; i++) {
    try {
      primary = await callProvider(order[i], ctx);
      primaryIndex = i;
      break;
    } catch (err) {
      lastErr = err;
    }
  }
  if (!primary) throw lastErr || Object.assign(new Error("No AI provider is configured"), { code: "AI_NOT_CONFIGURED" });

  const usedWriteTool = primary.toolTrace.some((t) => ctx.toolDefs.find((td) => td.name === t.tool)?.category === "write");
  const others = usedWriteTool ? [] : order.slice(primaryIndex + 1, primaryIndex + 3);
  if (!others.length) return { ...primary, mode: "parallel", perspectives: [primary.providerName] };

  const groundedHistory = [...ctx.history, { role: "assistant", content: primary.text }];
  const noToolCtx = { ...ctx, history: groundedHistory, toolDefs: [] };

  const settled = await Promise.allSettled(others.map((name) => callProvider(name, noToolCtx)));
  const extras = settled.filter((r) => r.status === "fulfilled").map((r) => r.value);

  const candidates = [primary, ...extras];
  const best = candidates.reduce((a, b) => (b.text.length > a.text.length ? b : a));

  return { ...best, mode: "parallel", perspectives: candidates.map((c) => c.providerName) };
}

/**
 * @param {object} params
 * @param {object} params.user - JWT-verified identity ({id, role, ...})
 * @param {Array<{role,content}>} params.messages - full conversation so far
 * @param {string} [params.mode] - "auto" | "parallel" (from the request; advisory)
 * @param {Array} params.toolDefs - role-filtered tool definitions (plain JSON Schema)
 * @param {Function} params.executeToolFn - (name, args, user) => Promise<result>
 */
export async function run({ user, messages, mode: requestedMode, toolDefs, executeToolFn }) {
  const order = providerManager.getHealthyProviderOrder();
  if (!order.length) throw Object.assign(new Error("No AI provider is configured or all are in cooldown"), { code: "AI_NOT_CONFIGURED" });

  const lastMessage = messages[messages.length - 1]?.content || "";
  const mode = inferMode(lastMessage, requestedMode);
  console.log(`[ACADEXA AI] Mode: ${mode} | Providers available: ${order.join(",")}`);

  const ctx = { systemPrompt: systemPrompt(user), history: messages, toolDefs, executeToolFn, user };
  const result = mode === "parallel" ? await runParallel(order, ctx) : await runSequential(order, ctx);

  return {
    reply: result.text,
    pendingActions: result.pendingActions,
    toolTrace: result.toolTrace,
    provider: result.providerName,
    mode: result.mode || "auto",
    toolUsed: result.toolTrace.length > 0,
  };
}

export function isAnyProviderConfigured() {
  return providerManager.getHealthyProviderOrder().length > 0 || Object.keys(PROVIDERS).some((n) => providerManager.getModule(n).isConfigured());
}

export { providerManager };
