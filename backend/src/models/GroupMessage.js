import mongoose from "mongoose";

// Deliberately a separate collection from Message.js (the existing 1:1
// student<->admin chat) rather than extending it — that model's
// sender/receiver pair encodes a two-party conversation and has no concept
// of group membership; bolting group semantics onto it would risk the
// existing private chat's access rules (chatAccess.js) in order to serve a
// feature that works completely differently. Group access control instead
// lives in resolveGroupMemberIds (services/teacherAuth.js).
const groupMessageSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: "ChatGroup", required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: "senderModel" },
    senderModel: { type: String, required: true, enum: ["Teacher", "Student"] },
    message: { type: String, required: true, trim: true, minlength: 1, maxlength: 4000 },
  },
  { timestamps: true }
);

groupMessageSchema.index({ group: 1, createdAt: 1 });

const GroupMessage = mongoose.models.GroupMessage || mongoose.model("GroupMessage", groupMessageSchema);
export default GroupMessage;
