import express from "express";
import ParentMessage from "../models/ParentMessagemodel.js";
import { auth } from "../middleware/auth.js";
import nodemailer from "nodemailer";

const router = express.Router();

// Get all parent messages (Admin only)
router.get("/", auth("admin"), async (req, res) => {
  try {
    const messages = await ParentMessage.find()
      .populate("studentId", "name rollNo")
      .sort({ createdAt: -1 });

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch parent messages" });
  }
});

// Get messages for specific student (Admin or Student)
router.get("/student/:studentId", auth(), async (req, res) => {
  try {
    // Check if user is admin or the student themselves
    if (req.user.role !== "admin" && req.user.id !== req.params.studentId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const messages = await ParentMessage.find({ studentId: req.params.studentId })
      .populate("studentId", "name rollNo")
      .sort({ createdAt: -1 });

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch student messages" });
  }
});

// Send message to parent (Admin only)
router.post("/", auth("admin"), async (req, res) => {
  try {
    const { studentId, title, message, type, parentEmail } = req.body;

    // Validate required fields
    if (!studentId || !title || !message || !parentEmail) {
      return res.status(400).json({ error: "Student ID, title, message, and parent email are required" });
    }

    const msg = new ParentMessage({
      ...req.body,
      author: req.user.id || req.user.email,
      emailStatus: "pending"
    });

    await msg.save();
    await msg.populate("studentId", "name rollNo");
    
    // TODO: Integrate email sending service (nodemailer)
    // await sendEmailToParent(msg);
    
    res.status(201).json(msg);
  } catch (err) {
    console.error(err);
    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map(e => e.message).join(", ");
      res.status(400).json({ error: messages });
    } else {
      res.status(500).json({ error: "Failed to send message: " + err.message });
    }
  }
});

// Update message status (Admin only)
router.patch("/:id", auth("admin"), async (req, res) => {
  try {
    const message = await ParentMessage.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate("studentId", "name rollNo");

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    res.json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update message: " + err.message });
  }
});

// Resend message to parent (Admin only)
router.post("/:id", auth("admin"), async (req, res) => {
  try {
    const message = await ParentMessage.findById(req.params.id).populate("studentId", "name rollNo");

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Update status to pending for resend
    message.emailStatus = "pending";
    await message.save();
    
    // TODO: Integrate email sending service (nodemailer)
    // await sendEmailToParent(message);
    
    res.json({ message: "Message queued for resend", data: message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to resend message: " + err.message });
  }
});

// Delete message (Admin only)
router.delete("/:id", auth("admin"), async (req, res) => {
  try {
    await ParentMessage.findByIdAndDelete(req.params.id);
    res.json({ message: "Message deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete message: " + err.message });
  }
});
export default router;