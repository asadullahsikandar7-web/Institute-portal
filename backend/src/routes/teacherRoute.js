import express from "express";
import bcrypt from "bcryptjs";
import Teacher from "../models/Teacher.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// Admin-facing management of Teacher accounts — distinct from the
// teacher-facing self-service routes (teacherAttendanceRoute.js etc.),
// which live under /api/teacher/*.

router.get("/", auth("admin"), async (req, res) => {
  try {
    const teachers = await Teacher.find().sort({ createdAt: -1 });
    res.json(teachers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", auth("admin"), async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.status(404).json({ error: "Teacher not found" });
    res.json(teacher);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", auth("admin"), async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email, password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const teacher = await Teacher.create({
      name: name.trim(),
      email: email.trim(),
      password: hashedPassword,
      phone: phone || "",
    });
    const out = teacher.toObject();
    delete out.password;
    res.status(201).json(out);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: "A teacher with this email already exists" });
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id", auth("admin"), async (req, res) => {
  try {
    const { name, phone, isActive, password } = req.body;
    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (phone !== undefined) update.phone = phone;
    if (isActive !== undefined) update.isActive = isActive;
    if (password !== undefined) {
      if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
      update.password = await bcrypt.hash(password, 10);
    }

    const teacher = await Teacher.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!teacher) return res.status(404).json({ error: "Teacher not found" });
    res.json(teacher);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Spec explicitly asks for activate/deactivate, not hard delete.
router.delete("/:id", auth("admin"), async (req, res) => {
  try {
    const teacher = await Teacher.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!teacher) return res.status(404).json({ error: "Teacher not found" });
    res.json({ message: "Teacher deactivated", teacher });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
