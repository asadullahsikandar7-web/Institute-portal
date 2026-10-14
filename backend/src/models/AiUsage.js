import mongoose from "mongoose";

// One document per AI request, used purely as a sliding-window rate-limit
// ledger (see aiRateLimit.js). DB-backed rather than in-memory for the same
// serverless-statelessness reason as AiAction.
const aiUsageSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    // No `index: true` here: the TTL index below covers createdAt, and a
    // second plain index on the same key stopped the TTL from being created.
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// Auto-expire ledger entries well past any window we'd ever check.
aiUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

const AiUsage = mongoose.models.AiUsage || mongoose.model("AiUsage", aiUsageSchema);
export default AiUsage;
