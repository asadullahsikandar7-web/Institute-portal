import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import Message from "../models/Message.js";
import { getConversationForUser } from "../utils/chatAccess.js";

// See the matching comment in ../routes/auth.js — this must land on the
// exact same secret used to sign REST tokens (../routes/auth.js), so it
// can't rely on this module happening to be imported after something else
// that already called dotenv.config().
dotenv.config();
const SECRET = process.env.JWT_SECRET || "super_secret_key";

// Attaches Socket.IO to an existing http.Server. Only ever called from the
// branch of server.js that also calls app.listen() — i.e. a real, always-on
// process (local dev, or a non-Vercel host in production). See server.js
// and README notes for why this can't run on Vercel's serverless functions.
export function attachChatSocket(httpServer, { allowedOrigins }) {
  const io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.has(origin)) return callback(null, true);
        try {
          const url = new URL(origin);
          if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return callback(null, true);
        } catch {
          // fall through to reject below
        }
        callback(new Error("Socket.IO CORS: origin not allowed"));
      },
      credentials: true,
    },
  });

  // Authenticate the socket handshake with the same JWT used for REST —
  // no second auth system, per the existing app's token shape (`id`,
  // `role`, and for students also `studentId`, matching src/routes/auth.js).
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(" ")[1];
      if (!token) return next(new Error("Missing token"));
      const decoded = jwt.verify(token, SECRET);
      if (decoded.role !== "student" && decoded.role !== "admin") {
        return next(new Error("Invalid role"));
      }
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    const { user } = socket;

    // Admins collectively see every conversation (see chatAccess.js), so
    // they auto-join a broad room used for conversation-list live updates
    // (new message previews/unread counts) even for chats they haven't
    // opened. Students only ever have one conversation, joined explicitly.
    if (user.role === "admin") {
      socket.join("admins");
    }

    socket.on("join_conversation", async (conversationId, ack) => {
      const { conversation, error, message } = await getConversationForUser(conversationId, user).catch(e => ({ error: 500, message: e.message }));
      if (error) {
        if (typeof ack === "function") ack({ ok: false, error: message });
        return;
      }
      socket.join(`conversation:${conversation._id}`);
      if (typeof ack === "function") ack({ ok: true });
    });

    socket.on("leave_conversation", (conversationId) => {
      if (typeof conversationId === "string") socket.leave(`conversation:${conversationId}`);
    });

    socket.on("send_message", async (payload, ack) => {
      try {
        const conversationId = payload?.conversationId;
        const text = typeof payload?.message === "string" ? payload.message.trim() : "";
        if (!text) return typeof ack === "function" && ack({ ok: false, error: "Message cannot be empty" });
        if (text.length > 4000) return typeof ack === "function" && ack({ ok: false, error: "Message is too long" });

        const { conversation, error, message } = await getConversationForUser(conversationId, user);
        if (error) return typeof ack === "function" && ack({ ok: false, error: message });

        const senderModel = user.role === "student" ? "Student" : "Admin";
        const receiverModel = user.role === "student" ? "Admin" : "Student";
        const receiver = receiverModel === "Student" ? conversation.student : conversation.admin;

        const doc = await Message.create({
          conversation: conversation._id,
          sender: user.id,
          senderModel,
          receiver: receiver || null,
          receiverModel,
          message: text,
        });

        conversation.lastMessage = text;
        conversation.lastMessageAt = doc.createdAt;
        if (senderModel === "Admin" && !conversation.admin) {
          conversation.admin = user.id;
        }
        await conversation.save();

        io.to(`conversation:${conversation._id}`).emit("receive_message", doc);
        if (senderModel === "Student") {
          io.to("admins").emit("conversation_updated", {
            conversationId: conversation._id,
            lastMessage: conversation.lastMessage,
            lastMessageAt: conversation.lastMessageAt,
          });
        }

        if (typeof ack === "function") ack({ ok: true, message: doc });
      } catch (err) {
        console.error("send_message error:", err.message);
        if (typeof ack === "function") ack({ ok: false, error: "Failed to send message" });
      }
    });

    socket.on("typing", async ({ conversationId } = {}) => {
      if (typeof conversationId !== "string") return;
      socket.to(`conversation:${conversationId}`).emit("typing", { conversationId, role: user.role });
    });

    socket.on("stop_typing", async ({ conversationId } = {}) => {
      if (typeof conversationId !== "string") return;
      socket.to(`conversation:${conversationId}`).emit("stop_typing", { conversationId, role: user.role });
    });

    socket.on("message_read", async ({ conversationId, all } = {}) => {
      if (typeof conversationId !== "string") return;
      const { conversation, error } = await getConversationForUser(conversationId, user);
      if (error) return;

      const myModel = user.role === "student" ? "Student" : "Admin";
      await Message.updateMany(
        { conversation: conversation._id, receiverModel: myModel, read: false },
        { $set: { read: true } }
      );
      io.to(`conversation:${conversation._id}`).emit("message_read", {
        conversationId: conversation._id,
        all: true,
        reader: user.role,
      });
    });
  });

  return io;
}
