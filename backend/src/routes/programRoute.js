import express from "express";
import Program from "../models/Program.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", auth("admin"), async (req, res) => {
  try {
    const programs = await Program.find().populate("academicSession", "name status").sort({ name: 1 });
    res.json(programs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", auth("admin"), async (req, res) => {
  try {
    const program = await Program.findById(req.params.id).populate("academicSession", "name status");
    if (!program) return res.status(404).json({ error: "Program not found" });
    res.json(program);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", auth("admin"), async (req, res) => {
  try {
    const { name, code, description, academicSession, requiredCredits, durationTerms } = req.body;
    if (!name || !code) return res.status(400).json({ error: "name and code are required" });
    const program = await Program.create({
      name: name.trim(),
      code: code.trim(),
      description: description || "",
      academicSession: academicSession || null,
      requiredCredits: requiredCredits || null,
      durationTerms: durationTerms || null,
    });
    res.status(201).json(program);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: "Program code already exists" });
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id", auth("admin"), async (req, res) => {
  try {
    const { name, code, description, status, academicSession, requiredCredits, durationTerms } = req.body;
    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (code !== undefined) update.code = code.trim();
    if (description !== undefined) update.description = description;
    if (status !== undefined) update.status = status;
    if (academicSession !== undefined) update.academicSession = academicSession || null;
    if (requiredCredits !== undefined) update.requiredCredits = requiredCredits === "" || requiredCredits === null ? null : Number(requiredCredits);
    if (durationTerms !== undefined) update.durationTerms = durationTerms === "" || durationTerms === null ? null : Number(durationTerms);

    const program = await Program.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!program) return res.status(404).json({ error: "Program not found" });
    res.json(program);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: "Program code already exists" });
    res.status(500).json({ error: err.message });
  }
});

// Safe deletion — deactivate, never hard-delete a Program that may already
// have Sections/Enrollments/TeacherAssignments referencing it.
router.delete("/:id", auth("admin"), async (req, res) => {
  try {
    const program = await Program.findByIdAndUpdate(req.params.id, { status: "inactive" }, { new: true });
    if (!program) return res.status(404).json({ error: "Program not found" });
    res.json({ message: "Program deactivated", program });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
