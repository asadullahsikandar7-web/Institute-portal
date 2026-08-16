import express from "express";
import AcademicSession from "../models/AcademicSession.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", auth("admin"), async (req, res) => {
  try {
    const sessions = await AcademicSession.find().sort({ startDate: -1 });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", auth("admin"), async (req, res) => {
  try {
    const session = await AcademicSession.findById(req.params.id);
    if (!session) return res.status(404).json({ error: "Academic session not found" });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", auth("admin"), async (req, res) => {
  try {
    const { name, startDate, endDate, status } = req.body;
    if (!name || !startDate || !endDate) {
      return res.status(400).json({ error: "name, startDate, endDate are required" });
    }
    const session = await AcademicSession.create({
      name: name.trim(),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: status || "active",
      createdBy: req.user.id,
    });
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id", auth("admin"), async (req, res) => {
  try {
    const { name, startDate, endDate, status } = req.body;
    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (startDate !== undefined) update.startDate = new Date(startDate);
    if (endDate !== undefined) update.endDate = new Date(endDate);
    if (status !== undefined) update.status = status;

    const session = await AcademicSession.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!session) return res.status(404).json({ error: "Academic session not found" });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Soft delete only — deactivate rather than hard-delete, since a session
// may already have Programs/Sections/TeacherAssignments/Enrollments
// referencing it that must not be silently orphaned.
router.delete("/:id", auth("admin"), async (req, res) => {
  try {
    const session = await AcademicSession.findByIdAndUpdate(req.params.id, { status: "archived" }, { new: true });
    if (!session) return res.status(404).json({ error: "Academic session not found" });
    res.json({ message: "Academic session archived", session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
