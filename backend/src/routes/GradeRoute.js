// routes/grades.js
import express from "express";
import Grade from "../models/GradeModel.js";
import { auth, adminOnly } from "../middleware/auth.js";

const router = express.Router();

// GET grades for a student
router.get("/:studentId", auth(), async (req, res) => {
  try {
    const requestedId = req.params.studentId;

    if (req.user.role !== "admin" && req.user.id !== requestedId && req.user.studentId !== requestedId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const grades = await Grade.find({ studentId: requestedId }).sort({ date: -1 });
    res.json(grades);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST add grade
router.post("/", adminOnly, async (req, res) => {
  try {
    const { studentId, subject, examName, marks, maxMarks } = req.body;
    if (!studentId || !subject || !examName || marks === undefined)
      return res.status(400).json({ error: "studentId, subject, examName, marks required" });
    const grade = await new Grade({ studentId, subject, examName, marks, maxMarks: maxMarks || 100 }).save();
    res.status(201).json({ grade });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
export default router;