import AiUsage from "../models/AiUsage.js";

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 12; // ~1 every 5s sustained, bursts allowed

// Simple sliding-window limiter, DB-backed so it holds up across Vercel's
// serverless cold starts (an in-memory counter would silently reset on
// every fresh instance). Not trying to be a general-purpose rate limiter —
// just "a reasonable protection strategy" per the brief, scoped to AI use.
export async function checkAiRateLimit(userId) {
  const since = new Date(Date.now() - WINDOW_MS);
  const recentCount = await AiUsage.countDocuments({ userId, createdAt: { $gte: since } });
  if (recentCount >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, retryAfterSeconds: 30 };
  }
  await AiUsage.create({ userId });
  return { allowed: true };
}
