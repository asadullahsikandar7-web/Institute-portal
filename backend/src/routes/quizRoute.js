import express from "express";
import Quiz from "../models/Quiz.js";
import { auth } from "../middleware/auth.js";

// Admin oversight only — read-only, same reasoning as assignmentRoute.js.
const router = express.Router();

const POPULATE = {
  path: "teacherAssignment",
  populate: [
    { path: "program", select: "name code" },
    { path: "section", select: "name code" },
    { path: "subject", select: "name code" },
    { path: "teacher", select: "name email" },
  ],
};

router.get("/", auth("admin"), async (req, res) => {
  try {
    const quizzes = await Quiz.find().populate(POPULATE).sort({ scheduledAt: -1 }).limit(500);
    res.json(quizzes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
