// routes/grades.js
const router = require("express").Router();
const Grade  = require("../models/Grade");
const { authMiddleware, adminOnly } = require("../middleware/auth");

// GET grades for a student
router.get("/:studentId", authMiddleware, async (req, res) => {
  try {
    const grades = await Grade.find({ studentId: req.params.studentId }).sort({ date: -1 });
    res.json(grades);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST add grade
router.post("/", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { studentId, subject, examName, marks, maxMarks } = req.body;
    if (!studentId || !subject || !examName || marks === undefined)
      return res.status(400).json({ error: "studentId, subject, examName, marks required" });
    const grade = await new Grade({ studentId, subject, examName, marks, maxMarks: maxMarks || 100 }).save();
    res.status(201).json({ grade });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;