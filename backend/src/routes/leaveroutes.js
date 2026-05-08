import express from "express";
import Leave from "../models/leavemodel.js";
import { auth } from "../routes/middleware/auth.js";

const router = express.Router();

// Apply leave (Student only)
router.post("/", auth("student"), async (req, res) => {
  try {
    const leave = new Leave({
      ...req.body,
      studentId: req.user.id,
      status: "pending",
      appliedAt: new Date().toISOString(),
    });
    await leave.save();
    res.status(201).json(leave);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get leaves — admin sees all (populated), student sees own
router.get("/", auth(), async (req, res) => {
  try {
    if (req.user.role === "admin") {
      const leaves = await Leave.find()
        .populate("studentId", "-password")
        .sort({ appliedAt: -1 });
      return res.json(leaves);
    } else {
      const leaves = await Leave.find({ studentId: req.user.id })
        .sort({ appliedAt: -1 });
      return res.json(leaves);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Review leave (Admin only)
router.patch("/:id", auth("admin"), async (req, res) => {
  try {
    const { status } = req.body;
    const leave = await Leave.findByIdAndUpdate(
      req.params.id,
      { status, reviewedAt: new Date().toISOString() },
      { new: true }
    ).populate("studentId", "-password");
    if (!leave) return res.status(404).json({ error: "Leave not found" });
    res.json(leave);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete leave (Student can cancel pending; Admin can delete any)
router.delete("/:id", auth(), async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ error: "Leave not found" });

    // Students can only delete their own pending leaves
    if (req.user.role === "student") {
      if (leave.studentId.toString() !== req.user.id)
        return res.status(403).json({ error: "Access denied" });
      if (leave.status !== "pending")
        return res.status(400).json({ error: "Can only cancel pending leaves" });
    }

    await Leave.findByIdAndDelete(req.params.id);
    res.json({ message: "Leave deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;