// routes/grades.js
import express from "express";
import Grade from "../models/GradeModel.js";
import { auth } from "../middleware/auth.js";
import { findTeacherAssignmentForStudent } from "../services/teacherAuth.js";

const router = express.Router();

// GET grades for a student — admin (any student), the student themselves,
// or a teacher who actually teaches that student in one of their sections.
router.get("/:studentId", auth(), async (req, res) => {
  try {
    const requestedId = req.params.studentId;

    if (req.user.role === "admin") {
      // full access
    } else if (req.user.role === "student") {
      if (req.user.id !== requestedId && req.user.studentId !== requestedId) {
        return res.status(403).json({ error: "Forbidden" });
      }
    } else if (req.user.role === "teacher") {
      const owns = await findTeacherAssignmentForStudent(req.user.id, requestedId);
      if (!owns) return res.status(403).json({ error: "Forbidden" });
    } else {
      return res.status(403).json({ error: "Forbidden" });
    }

    const grades = await Grade.find({ studentId: requestedId }).sort({ date: -1 });
    res.json(grades);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST add grade — admin may record for anyone; a teacher may only record a
// grade for their own subject, for a student in one of their own sections.
router.post("/", auth(), async (req, res) => {
  try {
    const { studentId, subject, examName, marks, maxMarks } = req.body;
    if (!studentId || !subject || !examName || marks === undefined)
      return res.status(400).json({ error: "studentId, subject, examName, marks required" });

    if (req.user.role === "admin") {
      // full access
    } else if (req.user.role === "teacher") {
      const owns = await findTeacherAssignmentForStudent(req.user.id, studentId, subject);
      if (!owns) return res.status(403).json({ error: "You do not teach this subject to this student." });
    } else {
      return res.status(403).json({ error: "Forbidden" });
    }

    const grade = await new Grade({ studentId, subject, examName, marks, maxMarks: maxMarks || 100 }).save();
    res.status(201).json({ grade });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
export default router;