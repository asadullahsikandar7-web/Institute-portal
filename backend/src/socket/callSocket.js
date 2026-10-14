import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import Teacher from "../models/Teacher.js";
import Student from "../models/studentModel.js";
import { loadOwnAssignment, isStudentAssignedTo } from "../services/teacherAuth.js";
import { isLocalDevHost } from "../utils/originCheck.js";
import { scopeSocket } from "../tenancy/sockets.js";

// ═══════════════════════════════════════════════════════════════════
//  CLASS CALL SIGNALING — WebRTC mesh, one room per TeacherAssignment
//  ("the whole class", the same granularity as ChatGroup/SubjectAttendance
//  — never a 1:1 room). This module only ever relays SDP/ICE between
//  already-mutually-authorized participants; the actual audio/video never
//  passes through this server (mesh peers connect directly to each other).
//
//  A SEPARATE Socket.IO namespace from chatSocket.js (its own auth
//  middleware, own event names, own room keyspace) — deliberately not
//  bolted onto the existing chat socket, so this addition can't perturb
//  the already-working chat/typing/read-receipt behavior there. Same
//  constraint as chatSocket.js applies: needs a persistent httpServer,
//  so it's only attached in the non-Vercel branch of server.js.
//
//  Mesh join order (avoids "glare" — two peers both offering each other
//  at once): the NEWLY joining peer always initiates the offer to every
//  peer already in the room; existing peers only ever answer. Since only
//  one peer can be "the one that just joined" at a time, this fully
//  determines who offers to whom with no coordination needed.
// ═══════════════════════════════════════════════════════════════════
dotenv.config();
const SECRET = process.env.JWT_SECRET || "super_secret_key";

// roomId -> Map<socketId, { userId, role, name, audio, video }>
const rooms = new Map();

function roomId(teacherAssignmentId) {
  return `class-call:${teacherAssignmentId}`;
}

function participantsOf(id) {
  const room = rooms.get(id);
  return room ? [...room.entries()].map(([socketId, p]) => ({ socketId, ...p })) : [];
}

export function attachCallSocket(httpServer, { allowedOrigins }) {
  const io = new Server(httpServer, {
    path: "/socket.io-calls/",
    cors: {
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.has(origin)) return callback(null, true);
        try {
          const url = new URL(origin);
          if (isLocalDevHost(url.hostname)) return callback(null, true);
        } catch {
          // fall through to reject below
        }
        callback(new Error("Socket.IO CORS: origin not allowed"));
      },
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(" ")[1];
      if (!token) return next(new Error("Missing token"));
      const decoded = jwt.verify(token, SECRET);
      if (decoded.role !== "teacher" && decoded.role !== "student") {
        return next(new Error("Invalid role"));
      }
      socket.user = decoded;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    scopeSocket(socket); // every handler below runs inside this socket's institute
    const { user } = socket;
    let joinedRoomId = null;

    socket.on("join-room", async ({ teacherAssignmentId } = {}, ack) => {
      const fail = (error) => { if (typeof ack === "function") ack({ ok: false, error }); };
      try {
        if (typeof teacherAssignmentId !== "string") return fail("teacherAssignmentId is required");
        if (joinedRoomId) return fail("Already in a call — leave it first.");

        // Re-verified here even though the client only got this id from a
        // page it was already authorized to see — never trust a client-
        // supplied id on its own, the same rule as every REST route in
        // this app. A teacher must OWN the assignment; a student must
        // currently be assigned to it (their own section, active term).
        let name;
        if (user.role === "teacher") {
          const assignment = await loadOwnAssignment(user.id, teacherAssignmentId);
          if (!assignment) return fail("You are not assigned to this class.");
          const teacher = await Teacher.findById(user.id).select("name");
          name = teacher?.name || "Teacher";
        } else {
          const assignment = await isStudentAssignedTo(user.id, teacherAssignmentId);
          if (!assignment) return fail("This isn't one of your classes.");
          const student = await Student.findById(user.id).select("name");
          name = student?.name || "Student";
        }

        const id = roomId(teacherAssignmentId);
        const existing = participantsOf(id);

        if (!rooms.has(id)) rooms.set(id, new Map());
        rooms.get(id).set(socket.id, { userId: user.id, role: user.role, name, audio: true, video: true, screenSharing: false });
        socket.join(id);
        joinedRoomId = id;

        // Existing members learn about the newcomer so their UI can show a
        // tile for them immediately (audio/video streams arrive slightly
        // later, once the offer/answer/ICE exchange below completes).
        socket.to(id).emit("peer-joined", { socketId: socket.id, name, role: user.role, audio: true, video: true, screenSharing: false });

        ack?.({ ok: true, selfId: socket.id, participants: existing });
      } catch (err) {
        console.error("[callSocket] join-room error:", err.message);
        fail("Failed to join the call.");
      }
    });

    // Pure relays — the server never inspects/modifies SDP or ICE payloads,
    // it only checks the sender is actually in the room it claims to be
    // signaling within (via joinedRoomId), and forwards to the exact
    // target socket, never a broadcast.
    socket.on("offer", ({ to, sdp } = {}) => {
      if (!joinedRoomId || typeof to !== "string") return;
      io.to(to).emit("offer", { from: socket.id, sdp });
    });
    socket.on("answer", ({ to, sdp } = {}) => {
      if (!joinedRoomId || typeof to !== "string") return;
      io.to(to).emit("answer", { from: socket.id, sdp });
    });
    socket.on("ice-candidate", ({ to, candidate } = {}) => {
      if (!joinedRoomId || typeof to !== "string") return;
      io.to(to).emit("ice-candidate", { from: socket.id, candidate });
    });

    socket.on("media-state", ({ audio, video, screenSharing } = {}) => {
      if (!joinedRoomId) return;
      const room = rooms.get(joinedRoomId);
      const p = room?.get(socket.id);
      if (!p) return;
      if (typeof audio === "boolean") p.audio = audio;
      if (typeof video === "boolean") p.video = video;
      if (typeof screenSharing === "boolean") p.screenSharing = screenSharing;
      socket.to(joinedRoomId).emit("peer-media-state", { socketId: socket.id, audio: p.audio, video: p.video, screenSharing: p.screenSharing });
    });

    function leaveCurrentRoom() {
      if (!joinedRoomId) return;
      const room = rooms.get(joinedRoomId);
      room?.delete(socket.id);
      if (room && room.size === 0) rooms.delete(joinedRoomId);
      socket.to(joinedRoomId).emit("peer-left", { socketId: socket.id });
      socket.leave(joinedRoomId);
      joinedRoomId = null;
    }

    socket.on("leave-room", () => leaveCurrentRoom());
    socket.on("disconnect", () => leaveCurrentRoom());
  });

  return io;
}
