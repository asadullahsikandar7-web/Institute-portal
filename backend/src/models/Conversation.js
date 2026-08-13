import mongoose from "mongoose";

// One conversation per student. `admin` records whichever admin most
// recently replied — purely informational, since (matching every other
// admin route in this app, e.g. studentRoute/parentMessageRoute) any
// authenticated admin is authorized to view and reply to any conversation.
// There's no per-admin data partitioning anywhere else in the app, so
// chat doesn't invent one either.
const conversationSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      unique: true,
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    lastMessage: {
      type: String,
      default: "",
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const Conversation =
  mongoose.models.Conversation || mongoose.model("Conversation", conversationSchema);
export default Conversation;
