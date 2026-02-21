import express from "express";
import Leave from "../models/leavemodel.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// Apply leave (Student)
router.post("/", auth("student"), async (req, res) => {
  const leave = new Leave({
    ...req.body,
    studentId: req.user.id,
    status: "pending",
  });

  await leave.save();
  res.json(leave);
});

// Get leaves
router.get("/", auth(), async (req, res) => {
  if (req.user.role === "admin") {
    const leaves = await Leave.find().populate("studentId");
    return res.json(leaves);
  } else {
    const leaves = await Leave.find({ studentId: req.user.id });
    return res.json(leaves);
  }
});

// Review leave (Admin)
router.patch("/:id", auth("admin"), async (req, res) => {
  const { status } = req.body;

  const leave = await Leave.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  );

  res.json(leave);
});

// Delete leave (Student)
router.delete("/:id", auth("student"), async (req, res) => {
  await Leave.findByIdAndDelete(req.params.id);
  res.json({ message: "Leave deleted" });
});

export default router;