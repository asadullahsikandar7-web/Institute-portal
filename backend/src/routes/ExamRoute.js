import express from "express";
import Exam from "../models/ExamModel.js";
import Student from "../models/studentModel.js";
import { auth, adminOnly } from "../middleware/auth.js";

const router = express.Router();

router.get("/", auth(), async (req, res) => {
  try {
    const exams = await Exam.find().sort({ date: 1 });
    res.json(exams);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/", adminOnly, async (req, res) => {
  try {
    const { name, subject, date, maxMarks, venue } = req.body;
    if (!name || !subject || !date) return res.status(400).json({ error: "name, subject, date required" });

    const exam = await new Exam({ name, subject, date: new Date(date), maxMarks: maxMarks || 100, venue: venue || "", emailStatus: "sending" }).save();

    // Real send, awaited before responding — the previous version never
    // actually called a mail function (the send line was commented out)
    // and unconditionally reported emailStatus:"sent" with a fabricated
    // emailCount equal to the whole student body regardless of outcome.
    // Awaited (not fire-and-forget) for the same reason as the broadcast
    // notification path in notificationRoute.js: Vercel's serverless
    // runtime can freeze the instant the response is sent.
    let emailCount = 0, emailStatus = "failed";
    try {
      const { sendMail } = await import("../utils/mailer.js");
      const { noticeTemplate } = await import("../utils/emailTemplates.js");
      const students = await Student.find({}, "name email");
      const recipients = students.map(s => s.email).filter(Boolean);
      const title = `New Exam Scheduled: ${name}`;
      const message = `Subject: ${subject}\nDate: ${new Date(date).toLocaleDateString()}${venue ? `\nVenue: ${venue}` : ""}\nMax Marks: ${maxMarks || 100}`;
      const html = noticeTemplate({ title, message });
      const results = await Promise.allSettled(
        recipients.map(r => sendMail({ to: r, subject: title, text: message, html }))
      );
      emailCount = results.filter(r => r.status === "fulfilled").length;
      emailStatus = emailCount === 0 ? "failed" : emailCount === recipients.length ? "sent" : "partial";
      await Exam.findByIdAndUpdate(exam._id, { emailStatus, emailCount });
    } catch (e) {
      console.error("Exam notification email failed:", e.message || e);
      await Exam.findByIdAndUpdate(exam._id, { emailStatus: "failed" });
    }

    res.status(201).json({ exam: { ...exam.toObject(), emailStatus, emailCount } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
export default router;