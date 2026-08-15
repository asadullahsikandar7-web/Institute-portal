import express from "express";
import { auth } from "../middleware/auth.js";
import { runAgent, isAiConfigured } from "../services/aiService.js";
import { checkAiRateLimit } from "../services/aiRateLimit.js";
import { executeConfirmedAction } from "../services/aiActionExecutor.js";
import { providerManager } from "../services/ai/orchestrator.js";
import AiAction from "../models/AiAction.js";

const router = express.Router();

// Every route here needs *some* authenticated user (student or admin) —
// which tools/actions are available is decided per-request from
// req.user.role, not by gating the whole router to one role.
router.use(auth());

router.get("/status", async (req, res) => {
  // Reports which providers have a key set — never a live network ping
  // here, so loading the AI panel never costs a provider request/quota.
  // Deliberately trimmed to {name, configured} only: priority/model/etc.
  // are provider configuration and stay server-side, per spec.
  const providers = providerManager.getConfiguredSummary().map((p) => ({ name: p.name, configured: p.configured }));
  res.json({ configured: isAiConfigured(), providers });
});

router.post("/chat", async (req, res) => {
  try {
    if (!isAiConfigured()) {
      return res.status(503).json({ error: "ACADEXA AI is temporarily unavailable. Please try again later." });
    }

    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message) return res.status(400).json({ error: "A message is required." });
    if (message.length > 2000) return res.status(400).json({ error: "That message is too long." });

    const history = Array.isArray(req.body?.history)
      ? req.body.history
          .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .slice(-20) // cap context sent per request
      : [];

    const rl = await checkAiRateLimit(req.user.id);
    if (!rl.allowed) {
      return res.status(429).json({ error: "You're sending requests a bit fast — please wait a moment and try again.", retryAfterSeconds: rl.retryAfterSeconds });
    }

    // "auto" (default) lets the orchestrator infer sequential-fallback vs
    // parallel-consensus from the message itself; "parallel" requests it
    // explicitly. Any other value is ignored rather than trusted blindly.
    const requestedMode = req.body?.mode === "parallel" ? "parallel" : "auto";

    const { reply, pendingActions, provider, mode, toolUsed } = await runAgent({
      user: req.user,
      messages: [...history, { role: "user", content: message }],
      mode: requestedMode,
    });

    res.json({ success: true, reply, pendingActions, provider, mode, toolUsed });
  } catch (err) {
    if (err.code === "AI_NOT_CONFIGURED") {
      return res.status(503).json({ error: "ACADEXA AI is temporarily unavailable. Please try again later." });
    }
    console.error("[aiRoute] /chat failed:", err.message);
    res.status(500).json({ error: "ACADEXA AI is temporarily unavailable. Please try again." });
  }
});

// ── Action confirmation (category 3 — write/send) ──────────────────
// The frontend only ever holds an actionId, never the raw parameters —
// everything actually executed here is re-read from the server-stored
// AiAction document, re-checked for ownership, role, and expiry.

router.post("/actions/:id/confirm", async (req, res) => {
  try {
    const action = await AiAction.findById(req.params.id);
    if (!action) return res.status(404).json({ error: "Action not found." });
    if (action.userId !== req.user.id || action.userRole !== req.user.role) {
      return res.status(403).json({ error: "You cannot confirm this action." });
    }
    if (action.status !== "pending") {
      return res.status(400).json({ error: `This action is already ${action.status}.` });
    }
    if (action.expiresAt < new Date()) {
      action.status = "expired";
      await action.save();
      return res.status(400).json({ error: "This action has expired — please ask ACADEXA again." });
    }

    const result = await executeConfirmedAction(action);
    action.status = "confirmed";
    await action.save();
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[aiRoute] confirm failed:", err.message);
    res.status(500).json({ error: "Failed to complete this action. Please try again." });
  }
});

router.post("/actions/:id/cancel", async (req, res) => {
  try {
    const action = await AiAction.findById(req.params.id);
    if (!action) return res.status(404).json({ error: "Action not found." });
    if (action.userId !== req.user.id || action.userRole !== req.user.role) {
      return res.status(403).json({ error: "You cannot cancel this action." });
    }
    if (action.status === "pending") {
      action.status = "cancelled";
      await action.save();
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[aiRoute] cancel failed:", err.message);
    res.status(500).json({ error: "Failed to cancel this action." });
  }
});

export default router;
