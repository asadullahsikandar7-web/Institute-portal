// ═══════════════════════════════════════════════════════════════════
//  Shared adapter for every OpenAI-compatible chat-completions provider
//  (Groq, Cerebras, OpenRouter all speak this exact REST shape). One
//  fetch-based implementation rather than three separate SDKs — matches
//  aiTools.js's parameter schemas exactly (plain JSON Schema), so no
//  format conversion is needed here (unlike Gemini's provider, which
//  does need one — see geminiProvider.js).
// ═══════════════════════════════════════════════════════════════════

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === "AbortError") {
      const e = new Error(`Request timed out after ${timeoutMs}ms`);
      e.code = "TIMEOUT";
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function toOpenAiToolDefs(toolDefs) {
  if (!toolDefs?.length) return undefined;
  return toolDefs.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
}

function historyToMessages(systemPrompt, history) {
  return [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
  ];
}

// providerName is only used for error tagging/logging — every provider
// module below supplies its own baseURL/apiKey/model.
export async function openAiCompatibleGenerateWithTools({
  providerName, apiKey, baseURL, model, timeoutMs, systemPrompt, history, toolDefs, executeToolFn, user, temperature = 0.4, maxRounds = 4,
}) {
  const messages = historyToMessages(systemPrompt, history);
  const tools = toOpenAiToolDefs(toolDefs);
  const pendingActions = [];
  const toolTrace = [];

  for (let round = 0; round < maxRounds; round++) {
    const res = await fetchWithTimeout(
      `${baseURL}/chat/completions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, tools, temperature }),
      },
      timeoutMs
    );

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      const err = new Error(`${providerName} HTTP ${res.status}: ${bodyText.slice(0, 300)}`);
      err.status = res.status;
      err.provider = providerName;
      throw err;
    }

    const data = await res.json();
    const msg = data.choices?.[0]?.message;
    if (!msg) {
      const err = new Error(`${providerName} returned an empty response`);
      err.provider = providerName;
      throw err;
    }

    const calls = msg.tool_calls;
    if (!calls || !calls.length) {
      return { text: msg.content || "", pendingActions, toolTrace };
    }

    messages.push({ role: "assistant", content: msg.content || null, tool_calls: calls });

    for (const call of calls) {
      let args = {};
      try {
        args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        args = {};
      }
      const result = await executeToolFn(call.function.name, args, user);
      toolTrace.push({ tool: call.function.name, args });
      if (result?.requiresConfirmation) pendingActions.push({ tool: call.function.name, ...result });
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  return { text: "I gathered the information but ran out of steps to fully respond — could you ask me again, maybe more specifically?", pendingActions, toolTrace };
}

// Cheap, non-generating reachability check — hits /models (metadata) so it
// doesn't burn generation quota just to answer "is this provider up?".
export async function openAiCompatibleCheckHealth({ providerName, apiKey, baseURL, timeoutMs = 6000 }) {
  const start = Date.now();
  try {
    const res = await fetchWithTimeout(`${baseURL}/models`, { headers: { Authorization: `Bearer ${apiKey}` } }, timeoutMs);
    return { ok: res.ok, status: res.status, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, error: err.code === "TIMEOUT" ? "timeout" : "unreachable", latencyMs: Date.now() - start };
  }
}
