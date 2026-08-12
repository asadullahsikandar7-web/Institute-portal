import express from "express";
import Class from "../models/classModel.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// Get full timetable schedule
router.get("/", auth(), async (req, res) => {
  try {
    const classes = await Class.find()
      .sort({ scheduleDay: 1, scheduleTime: 1 })
      .lean();

    res.json(classes.map(cls => ({ ...cls, day: cls.scheduleDay })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create timetable entry (admin only)
router.post("/", auth("admin"), async (req, res) => {
  try {
    const { day, time, subject, teacher, room, semester, classCode } = req.body;

    if (!day || !time || !subject || !teacher || !room) {
      return res.status(400).json({ error: "day, time, subject, teacher, room required" });
    }

    const classData = new Class({
      classCode: classCode || `${subject.replace(/\s+/g, "_")}-${Date.now()}`,
      className: subject,
      semester: semester || 1,
      teacher,
      assistant: "",
      scheduleDay: day,
      scheduleTime: time,
      room,
      tomorrowTopic: null,
      tomorrowMaterials: [],
      tomorrowAssignment: null,
      tomorrowDeadline: null,
      students: []
    });

    const saved = await classData.save();
    res.status(201).json({ ...saved.toObject(), day: saved.scheduleDay });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get student timetable
router.get("/student/:studentId", auth(), async (req, res) => {
  try {
    const { studentId } = req.params;
    const classes = await Class.find({ students: studentId })
      .sort({ scheduleDay: 1, scheduleTime: 1 })
      .lean();

    res.json(classes.map(cls => ({ ...cls, day: cls.scheduleDay })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get class timetable
router.get("/class/:classId", auth(), async (req, res) => {
  try {
    const { classId } = req.params;
    const classData = await Class.findById(classId).lean();
    if (!classData) {
      return res.status(404).json({ error: "Class not found" });
    }
    res.json({ ...classData, day: classData.scheduleDay });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;