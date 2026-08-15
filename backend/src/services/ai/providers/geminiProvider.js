// ═══════════════════════════════════════════════════════════════════
//  Gemini provider adapter — relocated from the old (pre-multi-provider)
//  aiService.js verbatim, wrapped behind the same generateWithTools()
//  interface every other provider exposes. This is the only provider
//  that needs schema/contents conversion (Gemini's SDK wants its own
//  Type enum and {parts:[...]} shape instead of plain JSON Schema /
//  OpenAI-style messages).
// ═══════════════════════════════════════════════════════════════════
import { GoogleGenAI, Type } from "@google/genai";
import { PROVIDERS } from "../config.js";

// Retry budget is intentionally small now that Groq/Cerebras/OpenRouter
// exist as siblings: this used to be the only provider, so waiting out a
// long retryDelay was the only option. Now, waiting the ~15-60s Gemini's
// own 429s ask for would starve the orchestrator's outer per-provider
// timeout and just delay handing off to a healthy sibling — so 429 (quota
// exhaustion) fails over immediately rather than retrying, and only 503
// (genuinely transient overload) gets one quick retry, capped short.
const MAX_RETRIES = 2;
const MAX_RETRY_DELAY_MS = 3000;

function parseRetryDelaySeconds(err) {
  try {
    const details = JSON.parse(err.message)?.error?.details;
    const retryInfo = details?.find((d) => d["@type"]?.includes("RetryInfo"));
    const match = /^([\d.]+)s$/.exec(retryInfo?.retryDelay || "");
    return match ? parseFloat(match[1]) : null;
  } catch {
    return null;
  }
}

async function generateWithRetry(ai, request) {
  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await ai.models.generateContent(request);
    } catch (err) {
      lastErr = err;
      const retryable = err.status === 503; // 429 (quota) fails over instead of retrying — see note above
      if (!retryable || attempt === MAX_RETRIES - 1) throw err;
      const delaySeconds = parseRetryDelaySeconds(err);
      const delayMs = delaySeconds != null ? delaySeconds * 1000 : 500 * 2 ** attempt;
      await new Promise((r) => setTimeout(r, Math.min(delayMs, MAX_RETRY_DELAY_MS)));
    }
  }
  throw lastErr;
}

let client = null;
function getClient() {
  const apiKey = PROVIDERS.gemini.apiKey;
  if (!apiKey) return null;
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

const TYPE_MAP = { string: Type.STRING, object: Type.OBJECT, array: Type.ARRAY, number: Type.NUMBER, integer: Type.INTEGER, boolean: Type.BOOLEAN };
function toGeminiSchema(schema) {
  if (!schema || typeof schema !== "object") return schema;
  const out = { ...schema };
  if (out.type) out.type = TYPE_MAP[out.type] || out.type;
  if (out.properties) out.properties = Object.fromEntries(Object.entries(out.properties).map(([k, v]) => [k, toGeminiSchema(v)]));
  if (out.items) out.items = toGeminiSchema(out.items);
  return out;
}

function toGeminiToolDefs(toolDefs) {
  if (!toolDefs?.length) return undefined;
  return [{ functionDeclarations: toolDefs.map((t) => ({ name: t.name, description: t.description, parameters: toGeminiSchema(t.parameters) })) }];
}

function toGeminiContents(history) {
  return history.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
}

export const name = "gemini";

export function isConfigured() {
  return !!PROVIDERS.gemini.apiKey;
}

export async function checkHealth() {
  const ai = getClient();
  if (!ai) return { ok: false, error: "not configured" };
  const start = Date.now();
  try {
    // models.list() is metadata-only — doesn't burn generation quota.
    await ai.models.list();
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, error: err.message?.slice(0, 200), latencyMs: Date.now() - start };
  }
}

export async function generateWithTools({ systemPrompt, history, toolDefs, executeToolFn, user, temperature = 0.4, maxRounds = 4 }) {
  const ai = getClient();
  if (!ai) throw Object.assign(new Error("Gemini is not configured"), { provider: "gemini", code: "NOT_CONFIGURED" });

  const tools = toGeminiToolDefs(toolDefs);
  const contents = toGeminiContents(history);
  const pendingActions = [];
  const toolTrace = [];

  for (let round = 0; round < maxRounds; round++) {
    const response = await generateWithRetry(ai, {
      model: PROVIDERS.gemini.model,
      contents,
      config: { systemInstruction: systemPrompt, tools, temperature },
    });

    const calls = response.functionCalls;
    if (!calls || !calls.length) return { text: response.text || "", pendingActions, toolTrace };

    const modelParts = response.candidates?.[0]?.content?.parts || calls.map((c) => ({ functionCall: { name: c.name, args: c.args } }));
    contents.push({ role: "model", parts: modelParts });

    const responseParts = [];
    for (const call of calls) {
      const result = await executeToolFn(call.name, call.args, user);
      toolTrace.push({ tool: call.name, args: call.args });
      if (result?.requiresConfirmation) pendingActions.push({ tool: call.name, ...result });
      responseParts.push({ functionResponse: { name: call.name, response: { result } } });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  return { text: "I gathered the information but ran out of steps to fully respond — could you ask me again, maybe more specifically?", pendingActions, toolTrace };
}
