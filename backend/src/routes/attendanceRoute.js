import express from "express";
import Attendance from "../models/attendanceModel.js";
import { auth } from "../routes/middleware/auth.js";  // ✅ FIXED IMPORT

const router = express.Router();

/* =========================
   Mark Attendance (Admin Only)
========================= */

router.post("/", auth("admin"), async (req, res) => {
  try {
    const { studentId, date, status } = req.body;

    const record = await Attendance.findOneAndUpdate(
      { studentId, date },
      { status },
      { upsert: true, new: true }
    );

    res.json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to mark attendance" });
  }
});

/* =========================
   Get Attendance by Date (Admin)
========================= */

router.get("/", auth("admin"), async (req, res) => {
  try {
    const { date } = req.query;

    const records = await Attendance.find({ date });

    res.json(records);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch attendance" });
  }
});

/* =========================
   Student Attendance History
========================= */

router.get("/history/:studentId", auth("student"), async (req, res) => {
  try {
    const records = await Attendance.find({
      studentId: req.params.studentId,
    });

    res.json(records);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

export default router;