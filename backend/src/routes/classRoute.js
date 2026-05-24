import express from "express";
import Class from "../models/classModel.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// Get all classes
router.get("/", async (req, res) => {
  try {
    const classes = await Class.find()
      .populate("students", "name rollNo email")
      .sort({ scheduleDay: 1, scheduleTime: 1 });

    res.json(classes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch classes" });
  }
});

// Get single class by ID
router.get("/:id", async (req, res) => {
  try {
    const classData = await Class.findById(req.params.id)
      .populate("students", "name rollNo email");

    if (!classData) {
      return res.status(404).json({ error: "Class not found" });
    }

    res.json(classData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch class" });
  }
});

// Create class (Admin only)
router.post("/", auth("admin"), async (req, res) => {
  try {
    const classData = new Class(req.body);
    await classData.save();
    res.status(201).json(classData);
  } catch (err) {
    console.error(err);
    
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      res.status(400).json({ error: `Class ${field} already exists` });
    } else if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map(e => e.message).join(", ");
      res.status(400).json({ error: messages });
    } else {
      res.status(500).json({ error: "Failed to create class: " + err.message });
    }
  }
});

// Update class (Admin only)
router.patch("/:id", auth("admin"), async (req, res) => {
  try {
    const classData = await Class.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate("students", "name rollNo email");

    if (!classData) {
      return res.status(404).json({ error: "Class not found" });
    }

    res.json(classData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update class" });
  }
});

// Delete class (Admin only)
router.delete("/:id", auth("admin"), async (req, res) => {
  try {
    await Class.findByIdAndDelete(req.params.id);
    res.json({ message: "Class deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete class" });
  }
});

// Add students to class
router.patch("/:id/students", auth("admin"), async (req, res) => {
  try {
    const { studentIds } = req.body;

    const classData = await Class.findByIdAndUpdate(
      req.params.id,
      { students: studentIds },
      { new: true }
    ).populate("students", "name rollNo email");

    res.json(classData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add students to class" });
  }
});
export default router;