import express from "express";
import Subject from "../models/Subject.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", auth("admin"), async (req, res) => {
  try {
    const subjects = await Subject.find().sort({ name: 1 });
    res.json(subjects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", auth("admin"), async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ error: "Subject not found" });
    res.json(subject);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", auth("admin"), async (req, res) => {
  try {
    const { name, code, description, creditHours } = req.body;
    if (!name || !code) return res.status(400).json({ error: "name and code are required" });
    const subject = await Subject.create({
      name: name.trim(),
      code: code.trim(),
      description: description || "",
      creditHours: creditHours || undefined,
    });
    res.status(201).json(subject);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: "Subject code already exists" });
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id", auth("admin"), async (req, res) => {
  try {
    const { name, code, description, creditHours, status } = req.body;
    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (code !== undefined) update.code = code.trim();
    if (description !== undefined) update.description = description;
    if (creditHours !== undefined) update.creditHours = creditHours;
    if (status !== undefined) update.status = status;

    const subject = await Subject.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!subject) return res.status(404).json({ error: "Subject not found" });
    res.json(subject);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: "Subject code already exists" });
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", auth("admin"), async (req, res) => {
  try {
    const subject = await Subject.findByIdAndUpdate(req.params.id, { status: "inactive" }, { new: true });
    if (!subject) return res.status(404).json({ error: "Subject not found" });
    res.json({ message: "Subject deactivated", subject });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
