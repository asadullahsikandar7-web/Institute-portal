import express from "express";
import Section from "../models/Section.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// Supports ?program=&academicSession= since the admin UI always picks a
// section within a chosen program+session, not a flat global list.
router.get("/", auth("admin"), async (req, res) => {
  try {
    const filter = {};
    if (req.query.program) filter.program = req.query.program;
    if (req.query.academicSession) filter.academicSession = req.query.academicSession;
    const sections = await Section.find(filter)
      .populate("program", "name code")
      .populate("academicSession", "name status")
      .sort({ name: 1 });
    res.json(sections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", auth("admin"), async (req, res) => {
  try {
    const section = await Section.findById(req.params.id)
      .populate("program", "name code")
      .populate("academicSession", "name status");
    if (!section) return res.status(404).json({ error: "Section not found" });
    res.json(section);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", auth("admin"), async (req, res) => {
  try {
    const { name, code, program, academicSession, capacity } = req.body;
    if (!name || !code || !program || !academicSession) {
      return res.status(400).json({ error: "name, code, program, academicSession are required" });
    }
    const section = await Section.create({
      name: name.trim(),
      code: code.trim(),
      program,
      academicSession,
      capacity: capacity || undefined,
    });
    res.status(201).json(section);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: "This section code already exists for that program+session" });
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id", auth("admin"), async (req, res) => {
  try {
    const { name, code, capacity, status } = req.body;
    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (code !== undefined) update.code = code.trim();
    if (capacity !== undefined) update.capacity = capacity;
    if (status !== undefined) update.status = status;

    const section = await Section.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!section) return res.status(404).json({ error: "Section not found" });
    res.json(section);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: "This section code already exists for that program+session" });
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", auth("admin"), async (req, res) => {
  try {
    const section = await Section.findByIdAndUpdate(req.params.id, { status: "inactive" }, { new: true });
    if (!section) return res.status(404).json({ error: "Section not found" });
    res.json({ message: "Section deactivated", section });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
