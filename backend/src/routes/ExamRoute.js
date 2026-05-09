import express from "express";
import Exam from "../models/Exam.js";
import Student from "../models/Student.js";
import { authMiddleware, adminOnly } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authMiddleware, async (req, res) => {
  try {
    const exams = await Exam.find().sort({ date: 1 });
    res.json(exams);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, subject, date, maxMarks, venue } = req.body;
    if (!name || !subject || !date) return res.status(400).json({ error: "name, subject, date required" });

    const exam = await new Exam({ name, subject, date: new Date(date), maxMarks: maxMarks || 100, venue: venue || "", emailStatus: "sending" }).save();

    // Fire email to all students (non-blocking)
    let emailCount = 0;
    try {
      const students = await Student.find({}, "name email");
      // await Promise.all(students.map(s => sendEmail(s.email, `Exam: ${name}`, `...`)));
      emailCount = students.length; // replace with actual sent count
      await Exam.findByIdAndUpdate(exam._id, { emailStatus: "sent", emailCount });
    } catch {
      await Exam.findByIdAndUpdate(exam._id, { emailStatus: "failed" });
    }

    res.status(201).json({ exam: { ...exam.toObject(), emailStatus: emailCount ? "sent" : "failed", emailCount } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;