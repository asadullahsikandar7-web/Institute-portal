import express from "express";
import Class from "../models/classModel.js";
import { auth } from "../middleware/auth.js";
import { sendMail } from "../utils/mailer.js";
import { classNoticeTemplate } from "../utils/emailTemplates.js";

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

// Get classes scheduled for tomorrow
router.get("/tomorrow", auth(), async (req, res) => {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayName = tomorrow.toLocaleDateString("en-US", { weekday: "long" });

    const classes = await Class.find({ scheduleDay: dayName })
      .sort({ scheduleTime: 1 })
      .lean();

    res.json({
      date: tomorrow.toISOString().split("T")[0],
      day: dayName,
      classes: classes.map(cls => ({ ...cls, day: cls.scheduleDay }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch tomorrow's classes" });
  }
});

// Update tomorrow details for a class
router.put("/:id/tomorrow", auth("admin"), async (req, res) => {
  try {
    const { topic, materials, assignment, deadline } = req.body;
    const classData = await Class.findByIdAndUpdate(
      req.params.id,
      {
        tomorrowTopic: topic || "",
        tomorrowMaterials: Array.isArray(materials) ? materials : [],
        tomorrowAssignment: assignment || "",
        tomorrowDeadline: deadline ? new Date(deadline) : null
      },
      { new: true }
    ).populate("students", "name rollNo email");

    if (!classData) {
      return res.status(404).json({ error: "Class not found" });
    }

    res.json(classData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update tomorrow details" });
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
    // Notify enrolled students, awaited before responding — on Vercel's
    // serverless runtime the function can freeze the instant the response
    // is sent, so fire-and-forget sends here would routinely never complete.
    try {
      await classData.populate("students", "name email");
      const html = classNoticeTemplate(classData);
      if (Array.isArray(classData.students) && classData.students.length) {
        const recipients = classData.students.map(s => s.email).filter(Boolean);
        await Promise.allSettled(recipients.map(r =>
          sendMail({ to: r, subject: `New class added: ${classData.className}`, text: `New class ${classData.className}`, html })
            .catch(e => console.error('Class notification failed for', r, e.message || e))
        ));
      }
    } catch (e) {
      console.error('Non-fatal: class notification error', e.message || e);
    }
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