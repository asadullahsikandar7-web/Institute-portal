import express from "express";
import bcrypt from "bcryptjs";
import Student from "../models/studentModel.js";
import { auth } from "../middleware/auth.js";
import multer from "multer";
import path from "path";

const router = express.Router();

// ── Get all students (Admin only) ──
router.get("/", auth("admin"), async (req, res) => {
  try {
    const students = await Student.find().select("-password").sort({ createdAt: -1 });
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Add student (Admin only) ──
router.post("/", auth("admin"), async (req, res) => {
  try {
    const { name, email, rollNo, password, parentName, parentEmail } = req.body;
    if (!name || !email || !rollNo || !password)
      return res.status(400).json({ error: "name, email, rollNo, password are required" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const student = new Student({
      name, email, rollNo,
      password: hashedPassword,
      parentName:  parentName  || "",
      parentEmail: parentEmail || "",
    });

    await student.save();
    const out = student.toObject();
    delete out.password;
    res.status(201).json(out);
  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ error: "Roll number already exists" });
    res.status(500).json({ error: err.message });
  }
});

// ── Upload / update student photo (Admin only) ──
// Body: { photo: "data:image/jpeg;base64,..." }
router.patch("/:id/photo", auth("admin"), async (req, res) => {
  try {
    const { photo } = req.body;
    if (!photo) return res.status(400).json({ error: "photo field is required" });
    if (!photo.startsWith("data:image/"))
      return res.status(400).json({ error: "photo must be a base64 image data URL" });
    if (photo.length > 2_800_000)
      return res.status(413).json({ error: "Photo too large. Max ~2 MB." });

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { photo },
      { new: true }
    ).select("-password");

    if (!student) return res.status(404).json({ error: "Student not found" });
    res.json({ message: "Photo updated", student });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Remove photo (Admin only) ──
router.delete("/:id/photo", auth("admin"), async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { photo: null },
      { new: true }
    ).select("-password");
    if (!student) return res.status(404).json({ error: "Student not found" });
    res.json({ message: "Photo removed", student });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Delete student (Admin only) ──
router.delete("/:id", auth("admin"), async (req, res) => {
  try {
    await Student.findByIdAndDelete(req.params.id);
    res.json({ message: "Student deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
export default router;