import express from "express";
import TeacherAssignment from "../models/TeacherAssignment.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

const POPULATE = [
  { path: "teacher", select: "name email" },
  { path: "academicSession", select: "name status" },
  { path: "program", select: "name code" },
  { path: "section", select: "name code" },
  { path: "subject", select: "name code" },
];

// Supports ?teacher= so a caller can see one teacher's full assignment list
// (used by the admin UI's "view this teacher's assignments" and reusable
// by a future teacher-facing self-service read).
router.get("/", auth("admin"), async (req, res) => {
  try {
    const filter = {};
    if (req.query.teacher) filter.teacher = req.query.teacher;
    const assignments = await TeacherAssignment.find(filter).populate(POPULATE).sort({ createdAt: -1 });
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", auth("admin"), async (req, res) => {
  try {
    const assignment = await TeacherAssignment.findById(req.params.id).populate(POPULATE);
    if (!assignment) return res.status(404).json({ error: "Teacher assignment not found" });
    res.json(assignment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", auth("admin"), async (req, res) => {
  try {
    const { teacher, academicSession, program, section, subject } = req.body;
    if (!teacher || !academicSession || !program || !section || !subject) {
      return res.status(400).json({ error: "teacher, academicSession, program, section, subject are all required" });
    }
    const assignment = await TeacherAssignment.create({
      teacher, academicSession, program, section, subject,
      assignedBy: req.user.id,
    });
    const populated = await assignment.populate(POPULATE);
    res.status(201).json(populated);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: "This exact teacher+session+program+section+subject assignment already exists" });
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id", auth("admin"), async (req, res) => {
  try {
    const { status } = req.body;
    if (status === undefined) return res.status(400).json({ error: "Nothing to update." });
    const assignment = await TeacherAssignment.findByIdAndUpdate(req.params.id, { status }, { new: true }).populate(POPULATE);
    if (!assignment) return res.status(404).json({ error: "Teacher assignment not found" });
    res.json(assignment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// "Remove assignments safely" — deactivate, keep the historical record of
// who taught what and when.
router.delete("/:id", auth("admin"), async (req, res) => {
  try {
    const assignment = await TeacherAssignment.findByIdAndUpdate(req.params.id, { status: "inactive" }, { new: true });
    if (!assignment) return res.status(404).json({ error: "Teacher assignment not found" });
    res.json({ message: "Teacher assignment deactivated", assignment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
