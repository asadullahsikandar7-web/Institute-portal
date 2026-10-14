import express from "express";
import { auth } from "../middleware/auth.js";
import { isStudentGroupMember } from "../services/teacherAuth.js";
import Student from "../models/studentModel.js";
import StudentEnrollment from "../models/StudentEnrollment.js";
import TeacherAssignment from "../models/TeacherAssignment.js";
import SubjectAttendance from "../models/SubjectAttendance.js";
import Assignment from "../models/Assignment.js";
import Quiz from "../models/Quiz.js";
import ChatGroup from "../models/ChatGroup.js";
import GroupMessage from "../models/GroupMessage.js";

// Student-side academic surface: "what am I enrolled in and what does it
// contain" (subjects, subject attendance, coursework, quizzes) plus the
// student half of academic chat groups. Every route below derives scope
// from the AUTHENTICATED student's own active StudentEnrollment — never
// from a session/program/section/subject id supplied by the client — so a
// student can only ever see their own section's data. This mirrors
// services/teacherAuth.js's rule on the teacher side: trust the token,
// resolve scope server-side, never trust client-supplied ids for anything
// beyond an opaque resource id to look up (e.g. an assignmentId param).

const router = express.Router();
router.use(auth("student"));

// ═══════════════════════════════════ PROFILE ═══════════════════════════════════
// Mirrors GET /api/teacher/me — lets the frontend restore a persisted
// {token,role} session on page load without re-storing the full student
// object client-side.
router.get("/me", async (req, res) => {
  try {
    const student = await Student.findById(req.user.id);
    if (!student) return res.status(404).json({ error: "Student not found" });
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function findActiveEnrollment(studentId) {
  return StudentEnrollment.findOne({ student: studentId, status: "active" });
}

// The set of active TeacherAssignments covering the student's current
// section — this IS "the subjects I take", since a subject only applies to
// a student through a TeacherAssignment for their exact session+program+section.
async function findActiveAssignments(enrollment, populate) {
  if (!enrollment) return [];
  const q = TeacherAssignment.find({
    academicSession: enrollment.academicSession,
    program: enrollment.program,
    section: enrollment.section,
    status: "active",
  });
  return populate ? q.populate(populate) : q;
}

const SUBJECT_POPULATE = [
  { path: "teacher", select: "name email" },
  { path: "subject", select: "name code" },
  { path: "section", select: "name code" },
  { path: "academicSession", select: "name" },
  { path: "program", select: "name code" },
];

// ═══════════════════════════════════ MY SUBJECTS ═══════════════════════════
router.get("/subjects", async (req, res) => {
  try {
    const enrollment = await findActiveEnrollment(req.user.id);
    if (!enrollment) return res.json([]);
    const assignments = await findActiveAssignments(enrollment, SUBJECT_POPULATE);

    const results = await Promise.all(assignments.map(async ta => {
      const records = await SubjectAttendance.find({ teacherAssignment: ta._id, student: req.user.id }).select("status");
      const present = records.filter(r => r.status === "present").length;
      const total = records.length;
      return {
        teacherAssignmentId: ta._id,
        subject: ta.subject,
        teacher: ta.teacher,
        section: ta.section,
        academicSession: ta.academicSession,
        program: ta.program,
        attendance: { present, total, rate: total ? Math.round((present / total) * 100) : null },
      };
    }));

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Day-by-day history for one subject — teacherAssignmentId scopes it, but is
// only trusted after confirming it's actually one of the student's own
// active assignments (findActiveAssignments above), not an arbitrary id.
router.get("/attendance/history", async (req, res) => {
  try {
    const { teacherAssignmentId } = req.query;
    if (!teacherAssignmentId) return res.status(400).json({ error: "teacherAssignmentId is required" });

    const enrollment = await findActiveEnrollment(req.user.id);
    const assignments = await findActiveAssignments(enrollment);
    const owns = assignments.some(a => a._id.toString() === teacherAssignmentId);
    if (!owns) return res.status(403).json({ error: "Not your subject." });

    const records = await SubjectAttendance.find({ teacherAssignment: teacherAssignmentId, student: req.user.id }).sort({ date: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════ COURSEWORK / QUIZZES ══════════════════
router.get("/coursework", async (req, res) => {
  try {
    const enrollment = await findActiveEnrollment(req.user.id);
    const assignments = await findActiveAssignments(enrollment);
    const items = await Assignment.find({ teacherAssignment: { $in: assignments.map(a => a._id) }, status: "active" })
      .populate({ path: "teacherAssignment", populate: SUBJECT_POPULATE })
      .sort({ dueDate: 1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/quizzes", async (req, res) => {
  try {
    const enrollment = await findActiveEnrollment(req.user.id);
    const assignments = await findActiveAssignments(enrollment);
    const items = await Quiz.find({ teacherAssignment: { $in: assignments.map(a => a._id) }, status: "active" })
      .populate({ path: "teacherAssignment", populate: SUBJECT_POPULATE })
      .sort({ scheduledAt: 1 });
    // The question bank holds each question's correctIndex, so it is never
    // sent from here — only whether one exists (`online`). Students get
    // the questions through /api/lms/student/quizzes/:id/start, which
    // strips the answers.
    res.json(items.map(q => {
      const { questions, ...rest } = q.toObject();
      return { ...rest, online: questions.length > 0 };
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════ ACADEMIC CHAT GROUPS ══════════════════
router.get("/chat-groups", async (req, res) => {
  try {
    const enrollment = await findActiveEnrollment(req.user.id);
    if (!enrollment) return res.json([]);
    const assignments = await findActiveAssignments(enrollment);

    const groups = await ChatGroup.find({
      teacherAssignment: { $in: assignments.map(a => a._id) },
      status: "active",
    }).populate({ path: "teacherAssignment", populate: SUBJECT_POPULATE });

    const visible = [];
    for (const group of groups) {
      if (await isStudentGroupMember(group, req.user.id)) visible.push(group);
    }
    res.json(visible);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function loadAccessibleGroup(req) {
  const group = await ChatGroup.findById(req.params.id).populate({
    path: "teacherAssignment",
    select: "section teacher",
  });
  if (!group || group.status !== "active") return null;
  const member = await isStudentGroupMember(group, req.user.id);
  return member ? group : null;
}

router.get("/chat-groups/:id/messages", async (req, res) => {
  try {
    const group = await loadAccessibleGroup(req);
    if (!group) return res.status(404).json({ error: "Not found" });
    const messages = await GroupMessage.find({ group: group._id }).sort({ createdAt: 1 }).limit(200);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/chat-groups/:id/messages", async (req, res) => {
  try {
    const group = await loadAccessibleGroup(req);
    if (!group) return res.status(404).json({ error: "Not found" });
    if (group.mode === "teacher_only") {
      return res.status(403).json({ error: "This group is announcement-only — students cannot post here." });
    }
    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: "message is required" });
    const doc = await GroupMessage.create({
      group: group._id,
      sender: req.user.id,
      senderModel: "Student",
      message: message.trim(),
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
