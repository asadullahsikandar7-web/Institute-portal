import express from "express";
import SubjectAttendance from "../models/SubjectAttendance.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// Admin oversight only — read-only. Marking attendance is exclusively a
// teacher action, scoped by an active TeacherAssignment (see
// POST /api/teacher/classes/:assignmentId/attendance in
// teacherPortalRoute.js) so it always stays tied to who was actually
// authorized to teach that subject/section on that day.
router.get("/", auth("admin"), async (req, res) => {
  try {
    const { academicSession, program, section, subject, student, date } = req.query;
    const filter = {};
    if (academicSession) filter.academicSession = academicSession;
    if (program) filter.program = program;
    if (section) filter.section = section;
    if (subject) filter.subject = subject;
    if (student) filter.student = student;
    if (date) filter.date = date;

    const records = await SubjectAttendance.find(filter)
      .populate("student", "name rollNo")
      .populate("subject", "name code")
      .populate("section", "name code")
      .populate("markedBy", "name")
      .sort({ date: -1 })
      .limit(500);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
