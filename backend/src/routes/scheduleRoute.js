import express from "express";
import { auth } from "../middleware/auth.js";
import TimetableEntry from "../models/TimetableEntry.js";
import TeacherAssignment from "../models/TeacherAssignment.js";
import StudentEnrollment from "../models/StudentEnrollment.js";
import { findConflictsForCandidate, hasAnyConflict } from "../services/timetableConflicts.js";

// The REAL, relational class schedule — Program/Section/Subject/Room/
// TeacherAssignment backed, with day/time overlap conflict checks on every
// write. Deliberately a separate collection/route from the legacy
// classModel.js + /api/timetable (free-text teacher/room strings, no
// conflict checking, no link to the real academic hierarchy) — that system
// stays exactly as it is for whatever already depends on it; this is not a
// migration of it.

const router = express.Router();
router.use(auth());

const POPULATE = [
  { path: "program", select: "name code" },
  { path: "section", select: "name code" },
  { path: "subject", select: "name code" },
  { path: "teacher", select: "name email" },
  { path: "room", select: "name type building" },
  { path: "academicSession", select: "name status" },
];

// ═══════════════════════════════════ ADMIN — full schedule ═════════════════
router.get("/", auth("admin"), async (req, res) => {
  try {
    const { day, teacher, subject, section, room, academicSession } = req.query;
    const filter = {};
    if (day) filter.day = day;
    if (teacher) filter.teacher = teacher;
    if (subject) filter.subject = subject;
    if (section) filter.section = section;
    if (room) filter.room = room;
    if (academicSession) filter.academicSession = academicSession;

    const entries = await TimetableEntry.find(filter).populate(POPULATE).sort({ day: 1, startTime: 1 });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════ TEACHER — own schedule only ═══════════
// Scoped to req.user.id via the denormalized `teacher` field — never a
// client-supplied teacherId. A TBA slot (teacher: null) never appears here
// for anyone, by construction.
router.get("/mine", auth("teacher"), async (req, res) => {
  try {
    const entries = await TimetableEntry.find({ teacher: req.user.id }).populate(POPULATE).sort({ day: 1, startTime: 1 });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════ STUDENT — own section only ════════════
// Scoped to the authenticated student's own ACTIVE StudentEnrollment — same
// rule as every other student-facing route in this app (see
// studentAcademicRoute.js): resolve scope server-side from the token,
// never trust a program/section id supplied by the client.
router.get("/student", auth("student"), async (req, res) => {
  try {
    const enrollment = await StudentEnrollment.findOne({ student: req.user.id, status: "active" });
    if (!enrollment) return res.json([]);
    const entries = await TimetableEntry.find({
      academicSession: enrollment.academicSession,
      program: enrollment.program,
      section: enrollment.section,
    }).populate(POPULATE).sort({ day: 1, startTime: 1 });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════ ADMIN — create / update / delete ══════
async function resolveTeacherFromAssignment(teacherAssignmentId) {
  if (!teacherAssignmentId) return null;
  const ta = await TeacherAssignment.findById(teacherAssignmentId).select("teacher");
  return ta ? ta.teacher : null;
}

router.post("/", auth("admin"), async (req, res) => {
  try {
    const { academicSession, program, section, subject, teacherAssignment, room, day, startTime, endTime, type } = req.body;
    if (!academicSession || !program || !section || !subject || !room || !day || !startTime || !endTime || !type) {
      return res.status(400).json({ error: "academicSession, program, section, subject, room, day, startTime, endTime, type are required" });
    }

    const teacher = await resolveTeacherFromAssignment(teacherAssignment);
    const candidate = { section, subject, teacher, room, day, startTime, endTime };

    const existing = await TimetableEntry.find({ academicSession, day }).select("teacher room section subject day startTime endTime");
    const conflicts = findConflictsForCandidate(candidate, existing);
    if (hasAnyConflict(conflicts)) {
      return res.status(409).json({ error: "This slot conflicts with an existing entry.", conflicts });
    }

    const entry = await TimetableEntry.create({
      academicSession, program, section, subject,
      teacherAssignment: teacherAssignment || null,
      teacher, room, day, startTime, endTime, type,
    });
    const populated = await entry.populate(POPULATE);
    res.status(201).json(populated);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "An identical schedule entry already exists." });
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id", auth("admin"), async (req, res) => {
  try {
    const entry = await TimetableEntry.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: "Not found" });

    const { teacherAssignment, room, day, startTime, endTime, type } = req.body;
    if (teacherAssignment !== undefined) {
      entry.teacherAssignment = teacherAssignment || null;
      entry.teacher = await resolveTeacherFromAssignment(teacherAssignment);
    }
    if (room !== undefined) entry.room = room;
    if (day !== undefined) entry.day = day;
    if (startTime !== undefined) entry.startTime = startTime;
    if (endTime !== undefined) entry.endTime = endTime;
    if (type !== undefined) entry.type = type;

    const existing = await TimetableEntry.find({ academicSession: entry.academicSession, day: entry.day })
      .select("teacher room section subject day startTime endTime");
    const conflicts = findConflictsForCandidate(entry, existing, entry._id);
    if (hasAnyConflict(conflicts)) {
      return res.status(409).json({ error: "This change conflicts with an existing entry.", conflicts });
    }

    await entry.save();
    const populated = await entry.populate(POPULATE);
    res.json(populated);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "An identical schedule entry already exists." });
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", auth("admin"), async (req, res) => {
  try {
    const deleted = await TimetableEntry.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Schedule entry deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
