import mongoose from "mongoose";

// sender/receiver can be either a Student or an Admin, so they use Mongoose's
// dynamic ref (refPath) instead of a fixed `ref`, with a companion *Model
// field recording which collection to resolve against.
const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "senderModel",
    },
    senderModel: {
      type: String,
      required: true,
      enum: ["Student", "Admin"],
    },
    // Not required: a student's message before any admin has replied yet
    // has receiverModel:"Admin" but no specific admin assigned (any admin
    // may see it — see chatAccess.js), so receiver is legitimately null.
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "receiverModel",
      default: null,
    },
    receiverModel: {
      type: String,
      required: true,
      enum: ["Student", "Admin"],
    },
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 4000,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: 1 });

const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);
export default Message;
