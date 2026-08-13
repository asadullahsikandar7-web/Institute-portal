import express from "express";
import { auth } from "../middleware/auth.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Student from "../models/studentModel.js";
import Admin from "../models/adminModel.js";
import {
  isValidObjectId,
  getConversationForUser,
  getOrCreateStudentConversation,
} from "../utils/chatAccess.js";

const router = express.Router();

// Every route here requires *some* authenticated user (student or admin) —
// unlike most other routes in this app, chat is shared between both roles,
// so we use auth() with no role argument (role-checking happens per-route
// below, since student vs admin need different logic, not just gating).
router.use(auth());

function otherPartyModel(myRole) {
  return myRole === "student" ? "Admin" : "Student";
}

async function buildConversationSummary(conversation, forUser) {
  const unread = await Message.countDocuments({
    conversation: conversation._id,
    receiverModel: forUser.role === "student" ? "Student" : "Admin",
    read: false,
  });
  const student = await Student.findById(conversation.student).select("name rollNo email photo");
  return {
    _id: conversation._id,
    student: student
      ? { _id: student._id, name: student.name, rollNo: student.rollNo, email: student.email, photo: student.photo }
      : null,
    admin: conversation.admin || null,
    lastMessage: conversation.lastMessage,
    lastMessageAt: conversation.lastMessageAt,
    unreadCount: unread,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

// ── Create/fetch a conversation ──
// Student: always their own — studentId is never taken from the body.
// Admin: must specify which student's conversation to open (admins aren't
// tied to a single student anywhere else in this app either).
router.post("/conversations", async (req, res) => {
  try {
    const { user } = req;
    let studentId;
    if (user.role === "student") {
      studentId = user.id;
    } else if (user.role === "admin") {
      studentId = req.body?.studentId;
      if (!isValidObjectId(studentId)) {
        return res.status(400).json({ error: "studentId is required to open a conversation" });
      }
    } else {
      return res.status(403).json({ error: "Forbidden" });
    }

    const conversation = await getOrCreateStudentConversation(studentId);
    if (!conversation) return res.status(404).json({ error: "Student not found" });

    res.status(201).json(await buildConversationSummary(conversation, user));
  } catch (err) {
    console.error("Create conversation error:", err);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

// ── List conversations ──
// Student: their single conversation (as a one-item list, for a uniform shape).
// Admin: every conversation, most recently active first.
router.get("/conversations", async (req, res) => {
  try {
    const { user } = req;
    if (user.role === "student") {
      const conversation = await getOrCreateStudentConversation(user.id);
      if (!conversation) return res.status(404).json({ error: "Student not found" });
      return res.json([await buildConversationSummary(conversation, user)]);
    }

    if (user.role === "admin") {
      const conversations = await Conversation.find().sort({ lastMessageAt: -1, createdAt: -1 });
      const summaries = await Promise.all(conversations.map(c => buildConversationSummary(c, user)));
      return res.json(summaries);
    }

    res.status(403).json({ error: "Forbidden" });
  } catch (err) {
    console.error("List conversations error:", err);
    res.status(500).json({ error: "Failed to load conversations" });
  }
});

// ── Message history for a conversation ──
router.get("/conversations/:id/messages", async (req, res) => {
  try {
    const { conversation, error, message } = await getConversationForUser(req.params.id, req.user);
    if (error) return res.status(error).json({ error: message });

    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
    const query = { conversation: conversation._id };
    if (req.query.before && !Number.isNaN(Date.parse(req.query.before))) {
      query.createdAt = { $lt: new Date(req.query.before) };
    }

    const page = await Message.find(query).sort({ createdAt: -1 }).limit(limit);
    res.json(page.reverse());
  } catch (err) {
    console.error("Load messages error:", err);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

// ── Send a message (REST fallback — also used when no live socket) ──
router.post("/messages", async (req, res) => {
  try {
    const conversationId = req.body?.conversationId;
    const text = typeof req.body?.message === "string" ? req.body.message.trim() : "";

    if (!text) return res.status(400).json({ error: "Message cannot be empty" });
    if (text.length > 4000) return res.status(400).json({ error: "Message is too long" });

    const { conversation, error, message: errMsg } = await getConversationForUser(conversationId, req.user);
    if (error) return res.status(error).json({ error: errMsg });

    const senderModel = req.user.role === "student" ? "Student" : "Admin";
    const receiverModel = otherPartyModel(req.user.role);
    const receiver = receiverModel === "Student" ? conversation.student : conversation.admin;

    // The admin side of a brand-new conversation has no assigned admin yet —
    // a student's very first message has nowhere fixed to "receive" until an
    // admin replies, so we use a null receiver in that case; any admin can
    // still see it via the conversation, not via being a specific receiver.
    const doc = await Message.create({
      conversation: conversation._id,
      sender: req.user.id,
      senderModel,
      receiver: receiver || null,
      receiverModel,
      message: text,
    });

    conversation.lastMessage = text;
    conversation.lastMessageAt = doc.createdAt;
    if (senderModel === "Admin" && !conversation.admin) {
      conversation.admin = req.user.id;
    }
    await conversation.save();

    // Broadcast to any connected sockets — attached only when server.js is
    // running as a standalone/always-on process (see server.js). On Vercel
    // this is undefined and the message simply won't be pushed live; it's
    // still saved and will appear on next fetch.
    const io = req.app.get("io");
    if (io) {
      io.to(`conversation:${conversation._id}`).emit("receive_message", doc);
      if (senderModel === "Student") {
        io.to("admins").emit("conversation_updated", {
          conversationId: conversation._id,
          lastMessage: conversation.lastMessage,
          lastMessageAt: conversation.lastMessageAt,
        });
      }
    }

    res.status(201).json(doc);
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ── Mark a single message read (matches the spec'd endpoint) ──
router.patch("/messages/:id/read", async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid message id" });
    const msg = await Message.findById(req.params.id);
    if (!msg) return res.status(404).json({ error: "Message not found" });

    // A student can only mark messages actually addressed to them; any admin
    // may mark any admin-directed message (same access model as everywhere
    // else — see chatAccess.js).
    const myModel = req.user.role === "student" ? "Student" : "Admin";
    const isMyMessage =
      msg.receiverModel === myModel &&
      (myModel === "Admin" || String(msg.receiver) === String(req.user.id));
    if (!isMyMessage) {
      return res.status(403).json({ error: "You cannot mark this message read" });
    }

    msg.read = true;
    await msg.save();

    const io = req.app.get("io");
    if (io) io.to(`conversation:${msg.conversation}`).emit("message_read", { messageId: msg._id, conversationId: msg.conversation });

    res.json(msg);
  } catch (err) {
    console.error("Mark read error:", err);
    res.status(500).json({ error: "Failed to mark message read" });
  }
});

// ── Bulk mark-as-read for a whole conversation (used when opening a chat) ──
router.patch("/conversations/:id/read", async (req, res) => {
  try {
    const { conversation, error, message } = await getConversationForUser(req.params.id, req.user);
    if (error) return res.status(error).json({ error: message });

    const myModel = req.user.role === "student" ? "Student" : "Admin";
    await Message.updateMany(
      { conversation: conversation._id, receiverModel: myModel, read: false },
      { $set: { read: true } }
    );

    const io = req.app.get("io");
    if (io) io.to(`conversation:${conversation._id}`).emit("message_read", { conversationId: conversation._id, all: true, reader: req.user.role });

    res.json({ ok: true });
  } catch (err) {
    console.error("Mark conversation read error:", err);
    res.status(500).json({ error: "Failed to mark conversation read" });
  }
});

export default router;
