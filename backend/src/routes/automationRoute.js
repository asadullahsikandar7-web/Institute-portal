import express from "express";
import crypto from "crypto";
import { auth } from "../middleware/auth.js";
import { h, httpError } from "../utils/crudRouter.js";
import { AutomationLog, RULES, ruleStates, runRule, runAllInstitutes } from "../services/automations.js";
import { AutomationRule } from "../services/automations.js";

const router = express.Router();

// Scheduler hook for serverless hosting (Vercel Cron calls this with
// "Authorization: Bearer $CRON_SECRET"). Refuses everything when no
// CRON_SECRET is configured.
router.get("/cron", h(async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const given = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const ok = secret && given.length === secret.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) throw httpError(401, "Unauthorized");
  res.json({ ran: await runAllInstitutes() });
}));

router.use(auth("admin"));

router.get("/", h(async (req, res) => {
  const [rules, recent] = await Promise.all([ruleStates(), AutomationLog.aggregate([{ $match: { at: { $gte: new Date(Date.now() - 30 * 86400000) } } }, { $group: { _id: "$rule", n: { $sum: 1 } } }])]);
  const by = new Map(recent.map(r => [r._id, r.n]));
  res.json(rules.map(r => ({ ...r, actionsLast30Days: by.get(r.key) || 0 })));
}));

router.patch("/:key", h(async (req, res) => {
  if (!RULES.some(r => r.key === req.params.key)) throw httpError(404, "Unknown automation");
  const update = {};
  if (req.body.enabled !== undefined) update.enabled = !!req.body.enabled;
  if (req.body.email !== undefined) update.email = !!req.body.email;
  await AutomationRule.findOneAndUpdate({ key: req.params.key }, update, { upsert: true, setDefaultsOnInsert: true });
  res.json((await ruleStates()).find(r => r.key === req.params.key));
}));

router.post("/:key/run", h(async (req, res) => {
  if (!RULES.some(r => r.key === req.params.key)) throw httpError(404, "Unknown automation");
  res.json(await runRule(req.params.key, { force: true }));
}));

export default router;
