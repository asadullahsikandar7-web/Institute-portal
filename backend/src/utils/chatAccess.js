import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Student from "../models/studentModel.js";

// Shared by both the REST routes and the Socket.IO handlers so access rules
// can't drift out of sync between the two transports.

export function isValidObjectId(id) {
  return typeof id === "string" && mongoose.Types.ObjectId.isValid(id);
}

// Every admin route elsewhere in this app (students, attendance, grades,
// parent messages, ...) treats any authenticated admin as authorized for
// any student's data — there's no per-admin ownership model anywhere in
// the existing app. Chat follows the same rule: a student may only reach
// their own conversation; any admin may reach any conversation.
export async function getConversationForUser(conversationId, user) {
  if (!isValidObjectId(conversationId)) {
    return { error: 400, message: "Invalid conversation id" };
  }
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    return { error: 404, message: "Conversation not found" };
  }
  if (user.role === "student" && String(conversation.student) !== String(user.id)) {
    return { error: 403, message: "You cannot access another student's conversation" };
  }
  if (user.role !== "student" && user.role !== "admin") {
    return { error: 403, message: "Forbidden" };
  }
  return { conversation };
}

// Finds the student's single conversation, creating it on first access.
// `admin` starts unassigned (null) — set to whichever admin replies first,
// purely for display; it never restricts access (see above).
export async function getOrCreateStudentConversation(studentId) {
  let conversation = await Conversation.findOne({ student: studentId });
  if (conversation) return conversation;

  const student = await Student.findById(studentId).select("_id");
  if (!student) return null;

  try {
    conversation = await Conversation.create({ student: studentId });
  } catch (err) {
    // Race: two near-simultaneous requests both tried to create the
    // student's conversation. The unique index on `student` rejects the
    // loser — just re-fetch what the winner created.
    if (err.code === 11000) {
      conversation = await Conversation.findOne({ student: studentId });
    } else {
      throw err;
    }
  }
  return conversation;
}
