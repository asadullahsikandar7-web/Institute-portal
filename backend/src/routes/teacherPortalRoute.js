import express from "express";
import { reenterTenant } from "../tenancy/middleware.js";
import { auth } from "../middleware/auth.js";
import {
  loadOwnAssignment,
  requireOwnAssignment,
  filterStudentsInSection,
  resolveGroupMemberIds,
} from "../services/teacherAuth.js";
import Teacher from "../models/Teacher.js";
import TeacherAssignment from "../models/TeacherAssignment.js";
import StudentEnrollment from "../models/StudentEnrollment.js";
import SubjectAttendance from "../models/SubjectAttendance.js";
import Assignment from "../models/Assignment.js";
import Quiz from "../models/Quiz.js";
import AcademicAnnouncement from "../models/AcademicAnnouncement.js";
import Notification from "../models/notificationModel.js";
import ChatGroup from "../models/ChatGroup.js";
import GroupMessage from "../models/GroupMessage.js";
import { computeTeacherAnalytics } from "../services/teacherAnalytics.js";
import { photoUpload, resolveUploadedPhoto } from "../utils/cloudinaryPhotoUpload.js";

// The whole teacher-facing self-service surface lives in this one file
// (rather than one-file-per-resource like the admin academic routes) because
// every route here shares the same nested-under-:assignmentId ownership
// check (requireOwnAssignment) — splitting it up would just duplicate that
// wiring six times for no real separation of concerns. Nothing here is
// reachable without a valid "teacher" JWT (see auth("teacher") below); the
// assignment ownership check on top of that is what makes each route safe
// against a teacher supplying another teacher's ids.

const router = express.Router();
router.use(auth("teacher"));

const ASSIGN_POPULATE = [
  { path: "academicSession", select: "name status" },
  { path: "program", select: "name code" },
  { path: "section", select: "name code" },
  { path: "subject", select: "name code" },
];

// ═══════════════════════════════════ PROFILE ═══════════════════════════════════
router.get("/me", async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id);
    if (!teacher) return res.status(404).json({ error: "Teacher not found" });
    res.json(teacher);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Self-service edit — always req.user.id, never a client-supplied id, so a
// teacher can only ever edit their own record. Scoped to name only for now
// (no email/password here) since that's the only field this was asked for.
router.patch("/me", async (req, res) => {
  try {
    const { name } = req.body;
    if (name === undefined) return res.status(400).json({ error: "Nothing to update." });
    const trimmed = String(name).trim();
    if (trimmed.length < 2) return res.status(400).json({ error: "Name must be at least 2 characters." });

    const teacher = await Teacher.findByIdAndUpdate(req.user.id, { name: trimmed }, { new: true }).select("-password");
    res.json({ message: "Profile updated", teacher });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/me/photo", photoUpload.single("photo"), reenterTenant, async (req, res) => {
  try {
    const photo = await resolveUploadedPhoto(req);
    const teacher = await Teacher.findByIdAndUpdate(req.user.id, { photo }, { new: true }).select("-password");
    res.json({ message: "Photo updated", teacher });
  } catch (err) {
    res.status(err.message?.includes("too large") ? 413 : 400).json({ error: err.message });
  }
});

router.delete("/me/photo", async (req, res) => {
  try {
    const teacher = await Teacher.findByIdAndUpdate(req.user.id, { photo: null }, { new: true }).select("-password");
    res.json({ message: "Photo removed", teacher });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════ CLASSES (= this teacher's assignments) ═══
router.get("/classes", async (req, res) => {
  try {
    const assignments = await TeacherAssignment.find({ teacher: req.user.id, status: "active" })
      .populate(ASSIGN_POPULATE)
      .sort({ createdAt: -1 });
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/classes/:assignmentId", requireOwnAssignment(), async (req, res) => {
  res.json(req.teacherAssignment);
});

router.get("/classes/:assignmentId/students", requireOwnAssignment(), async (req, res) => {
  try {
    const enrollments = await StudentEnrollment.find({ section: req.teacherAssignment.section._id, status: "active" })
      .populate("student", "name rollNo email photo");
    // Sorted here, not via .sort() on the query — "student" is just an
    // ObjectId on the underlying StudentEnrollment collection until
    // populate() resolves it client-side, so a Mongo-side sort on
    // "student.name" would silently no-op against the raw field.
    const students = enrollments
      .filter(e => e.student)
      .map(e => ({ enrollmentId: e._id, ...e.student.toObject() }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════ ANALYTICS ═════════════════════════════════
// Scoped entirely to this teacher's own active classes — never schoolwide.
// The admin's /api/analytics stays the "upper management" aggregate view;
// this is the teacher's own performance/class/subject breakdown, only ever
// built from TeacherAssignment rows owned by req.user.id.
router.get("/analytics", async (req, res) => {
  try {
    res.json(await computeTeacherAnalytics(req.user.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════ ATTENDANCE ═══════════════════════════════
router.get("/classes/:assignmentId/attendance", requireOwnAssignment(), async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "date query param is required (YYYY-MM-DD)" });

    const ta = req.teacherAssignment;
    const [enrollments, records] = await Promise.all([
      StudentEnrollment.find({ section: ta.section._id, status: "active" }).populate("student", "name rollNo photo"),
      SubjectAttendance.find({ teacherAssignment: ta._id, date }),
    ]);
    const statusByStudent = new Map(records.map(r => [r.student.toString(), r.status]));
    const students = enrollments
      .filter(e => e.student)
      .map(e => ({
        studentId: e.student._id,
        name: e.student.name,
        rollNo: e.student.rollNo,
        photo: e.student.photo,
        status: statusByStudent.get(e.student._id.toString()) || "unmarked",
      }));
    res.json({ date, students });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/classes/:assignmentId/attendance", requireOwnAssignment(), async (req, res) => {
  try {
    const { date, records } = req.body;
    if (!date) return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: "records must be a non-empty array of {student, status}" });
    }
    const validStatuses = new Set(["present", "absent", "leave"]);
    const clean = records.filter(r => r && r.student && validStatuses.has(r.status));

    const ta = req.teacherAssignment;
    const allowedIds = await filterStudentsInSection(clean.map(r => r.student), ta.section._id);
    const allowedSet = new Set(allowedIds.map(id => id.toString()));
    const toWrite = clean.filter(r => allowedSet.has(r.student.toString()));

    if (toWrite.length === 0) {
      return res.status(400).json({ error: "No valid, in-section students with a valid status were provided." });
    }

    const ops = toWrite.map(r => ({
      updateOne: {
        filter: {
          student: r.student,
          academicSession: ta.academicSession._id,
          program: ta.program._id,
          section: ta.section._id,
          subject: ta.subject._id,
          date,
        },
        update: {
          $set: {
            status: r.status,
            markedBy: req.user.id,
            teacherAssignment: ta._id,
          },
        },
        upsert: true,
      },
    }));
    await SubjectAttendance.bulkWrite(ops);

    res.json({ marked: toWrite.length, skipped: records.length - toWrite.length, date });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/classes/:assignmentId/attendance/history", requireOwnAssignment(), async (req, res) => {
  try {
    const { studentId, from, to } = req.query;
    const ta = req.teacherAssignment;

    if (studentId) {
      const allowed = await filterStudentsInSection([studentId], ta.section._id);
      if (allowed.length === 0) return res.status(403).json({ error: "That student is not in this class." });
    }

    const filter = { teacherAssignment: ta._id };
    if (studentId) filter.student = studentId;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to) filter.date.$lte = to;
    }

    const records = await SubjectAttendance.find(filter).populate("student", "name rollNo").sort({ date: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════ COURSEWORK (Assignments) ═════════════════
router.get("/classes/:assignmentId/coursework", requireOwnAssignment(), async (req, res) => {
  try {
    const items = await Assignment.find({ teacherAssignment: req.teacherAssignment._id }).sort({ dueDate: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/classes/:assignmentId/coursework", requireOwnAssignment(), async (req, res) => {
  try {
    const { title, description, dueDate, totalMarks, attachments } = req.body;
    if (!title || !dueDate) return res.status(400).json({ error: "title and dueDate are required" });
    const item = await Assignment.create({
      teacherAssignment: req.teacherAssignment._id,
      createdBy: req.user.id,
      title: title.trim(),
      description: description || "",
      dueDate: new Date(dueDate),
      totalMarks: totalMarks ?? null,
      attachments: Array.isArray(attachments) ? attachments : [],
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ownership for single-resource coursework/quiz routes is checked by
// loading the doc, then re-verifying the teacher still owns+is-active-on
// the TeacherAssignment it was created under — not just by createdBy, since
// createdBy alone wouldn't catch a teacher whose assignment was since
// deactivated by admin.
async function loadOwnCoursework(req) {
  const item = await Assignment.findById(req.params.id);
  if (!item) return null;
  const ta = await loadOwnAssignment(req.user.id, item.teacherAssignment);
  return ta ? item : null;
}

router.patch("/coursework/:id", async (req, res) => {
  try {
    const item = await loadOwnCoursework(req);
    if (!item) return res.status(404).json({ error: "Not found" });
    const { title, description, dueDate, totalMarks, attachments, status } = req.body;
    if (title !== undefined) item.title = title.trim();
    if (description !== undefined) item.description = description;
    if (dueDate !== undefined) item.dueDate = new Date(dueDate);
    if (totalMarks !== undefined) item.totalMarks = totalMarks;
    if (attachments !== undefined) item.attachments = attachments;
    if (status !== undefined) item.status = status;
    await item.save();
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/coursework/:id", async (req, res) => {
  try {
    const item = await loadOwnCoursework(req);
    if (!item) return res.status(404).json({ error: "Not found" });
    await item.deleteOne();
    res.json({ message: "Assignment deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════ QUIZZES ═══════════════════════════════════
router.get("/classes/:assignmentId/quizzes", requireOwnAssignment(), async (req, res) => {
  try {
    const items = await Quiz.find({ teacherAssignment: req.teacherAssignment._id }).sort({ scheduledAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/classes/:assignmentId/quizzes", requireOwnAssignment(), async (req, res) => {
  try {
    const { title, description, scheduledAt, durationMinutes, totalMarks } = req.body;
    if (!title || !scheduledAt) return res.status(400).json({ error: "title and scheduledAt are required" });
    const item = await Quiz.create({
      teacherAssignment: req.teacherAssignment._id,
      createdBy: req.user.id,
      title: title.trim(),
      description: description || "",
      scheduledAt: new Date(scheduledAt),
      durationMinutes: durationMinutes ?? null,
      totalMarks: totalMarks ?? null,
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function loadOwnQuiz(req) {
  const item = await Quiz.findById(req.params.id);
  if (!item) return null;
  const ta = await loadOwnAssignment(req.user.id, item.teacherAssignment);
  return ta ? item : null;
}

router.patch("/quizzes/:id", async (req, res) => {
  try {
    const item = await loadOwnQuiz(req);
    if (!item) return res.status(404).json({ error: "Not found" });
    const { title, description, scheduledAt, durationMinutes, totalMarks, status } = req.body;
    if (title !== undefined) item.title = title.trim();
    if (description !== undefined) item.description = description;
    if (scheduledAt !== undefined) item.scheduledAt = new Date(scheduledAt);
    if (durationMinutes !== undefined) item.durationMinutes = durationMinutes;
    if (totalMarks !== undefined) item.totalMarks = totalMarks;
    if (status !== undefined) item.status = status;
    await item.save();
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/quizzes/:id", async (req, res) => {
  try {
    const item = await loadOwnQuiz(req);
    if (!item) return res.status(404).json({ error: "Not found" });
    await item.deleteOne();
    res.json({ message: "Quiz deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════ ANNOUNCEMENTS ═════════════════════════════
router.get("/classes/:assignmentId/announcements", requireOwnAssignment(), async (req, res) => {
  try {
    const items = await AcademicAnnouncement.find({ teacherAssignment: req.teacherAssignment._id }).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fans out to the EXISTING Notification collection (one doc per actively
// enrolled student) so students see this through the app's current, already
// working Announcements/Notifications UI with no frontend changes — see the
// comment on AcademicAnnouncement.js for why this record also exists.
router.post("/classes/:assignmentId/announcements", requireOwnAssignment(), async (req, res) => {
  try {
    const { title, message } = req.body;
    if (!title || !message) return res.status(400).json({ error: "title and message are required" });

    const ta = req.teacherAssignment;
    const [teacher, enrollments] = await Promise.all([
      Teacher.findById(req.user.id).select("name"),
      StudentEnrollment.find({ section: ta.section._id, status: "active" }).select("student"),
    ]);

    const announcement = await AcademicAnnouncement.create({
      teacherAssignment: ta._id,
      createdBy: req.user.id,
      title: title.trim(),
      message,
      recipientCount: enrollments.length,
    });

    if (enrollments.length > 0) {
      const now = new Date();
      await Notification.insertMany(
        enrollments.map(e => ({
          recipientId: e.student,
          recipientType: "student",
          title: title.trim(),
          message,
          type: "announcement",
          sender: teacher?.name || "Teacher",
          sentAt: now,
        }))
      );
    }

    res.status(201).json(announcement);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════ CHAT GROUPS ═══════════════════════════════
router.get("/classes/:assignmentId/chat-group", requireOwnAssignment(), async (req, res) => {
  try {
    let group = await ChatGroup.findOne({ teacherAssignment: req.teacherAssignment._id });
    if (!group) {
      group = await ChatGroup.create({ teacherAssignment: req.teacherAssignment._id, createdBy: req.user.id });
    }
    // Reuse the already-populated assignment from requireOwnAssignment rather
    // than a second populate query — resolveGroupMemberIds only needs .section.
    group = group.toObject();
    group.teacherAssignment = req.teacherAssignment;
    const memberIds = await resolveGroupMemberIds(group);
    res.json({ ...group, memberIds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Loads a group and confirms the caller's teacher owns the active
// assignment it belongs to — the same ownership guarantee every other
// single-resource route in this file provides.
async function loadOwnGroup(req) {
  const group = await ChatGroup.findById(req.params.id);
  if (!group) return null;
  const ta = await loadOwnAssignment(req.user.id, group.teacherAssignment);
  if (!ta) return null;
  return { group, ta };
}

router.patch("/chat-groups/:id", async (req, res) => {
  try {
    const loaded = await loadOwnGroup(req);
    if (!loaded) return res.status(404).json({ error: "Not found" });
    const { group, ta } = loaded;

    const { mode, members } = req.body;
    if (mode !== undefined) {
      if (!["teacher_only", "teacher_selected", "teacher_all"].includes(mode)) {
        return res.status(400).json({ error: "Invalid mode" });
      }
      group.mode = mode;
    }
    if (members !== undefined) {
      group.members = await filterStudentsInSection(members, ta.section._id);
    }
    await group.save();
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/chat-groups/:id/messages", async (req, res) => {
  try {
    const loaded = await loadOwnGroup(req);
    if (!loaded) return res.status(404).json({ error: "Not found" });
    const messages = await GroupMessage.find({ group: loaded.group._id }).sort({ createdAt: 1 }).limit(200);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/chat-groups/:id/messages", async (req, res) => {
  try {
    const loaded = await loadOwnGroup(req);
    if (!loaded) return res.status(404).json({ error: "Not found" });
    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: "message is required" });
    const doc = await GroupMessage.create({
      group: loaded.group._id,
      sender: req.user.id,
      senderModel: "Teacher",
      message: message.trim(),
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
