import mongoose from "mongoose";

// A server-prepared, server-verified pending action awaiting explicit user
// confirmation (leave request, parent email, ...). The frontend only ever
// holds this document's _id — never the raw parameters — so a confirm
// request can't be forged by editing values in the browser; the backend
// re-reads and re-validates everything stored here at confirm time.
//
// Stored in MongoDB rather than in-memory: on Vercel, the request that
// prepares an action and the request that confirms it can land on two
// different serverless instances with no shared memory (the same reason
// Socket.IO can't run there either — see chatSocket.js notes).
const aiActionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    userRole: { type: String, required: true, enum: ["student", "admin"] },
    type: {
      type: String,
      required: true,
      enum: ["create_leave_request", "send_parent_email", "send_parent_emails_bulk"],
    },
    params: { type: mongoose.Schema.Types.Mixed, required: true },
    preview: { type: mongoose.Schema.Types.Mixed, required: true },
    status: { type: String, enum: ["pending", "confirmed", "cancelled", "expired"], default: "pending" },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// TTL index — Mongo automatically deletes documents once expiresAt passes,
// so unconfirmed actions don't linger forever.
aiActionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AiAction = mongoose.models.AiAction || mongoose.model("AiAction", aiActionSchema);
export default AiAction;
