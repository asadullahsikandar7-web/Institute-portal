import express from "express";
import StudentEnrollment from "../models/StudentEnrollment.js";
import Student from "../models/studentModel.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

const POPULATE = [
  { path: "student", select: "name rollNo email" },
  { path: "academicSession", select: "name status" },
  { path: "program", select: "name code" },
  { path: "section", select: "name code" },
];

// Supports ?student= (a student's full enrollment history) and
// ?section= (everyone currently in a section).
router.get("/", auth("admin"), async (req, res) => {
  try {
    const filter = {};
    if (req.query.student) filter.student = req.query.student;
    if (req.query.section) filter.section = req.query.section;
    const enrollments = await StudentEnrollment.find(filter).populate(POPULATE).sort({ enrolledAt: -1 });
    res.json(enrollments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", auth("admin"), async (req, res) => {
  try {
    const enrollment = await StudentEnrollment.findById(req.params.id).populate(POPULATE);
    if (!enrollment) return res.status(404).json({ error: "Enrollment not found" });
    res.json(enrollment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Append-only: creates a NEW enrollment record rather than overwriting any
// existing one, so a student's academic history across sessions is never
// destroyed. Student.currentEnrollment is updated here — the only place it
// ever is — since this status is always "active" on creation.
router.post("/", auth("admin"), async (req, res) => {
  try {
    const { student, academicSession, program, section } = req.body;
    if (!student || !academicSession || !program || !section) {
      return res.status(400).json({ error: "student, academicSession, program, section are all required" });
    }
    const studentDoc = await Student.findById(student);
    if (!studentDoc) return res.status(404).json({ error: "Student not found" });

    const enrollment = await StudentEnrollment.create({
      student, academicSession, program, section,
    });
    await Student.findByIdAndUpdate(student, { currentEnrollment: enrollment._id });

    const populated = await enrollment.populate(POPULATE);
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Status transitions (active -> transferred/completed/withdrawn, or
// setting a new enrollment active). Never overwrites the historical
// fields (student/session/program/section) of an existing record — to
// move a student, create a new enrollment instead of editing this one.
router.patch("/:id", auth("admin"), async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "status is required" });

    const enrollment = await StudentEnrollment.findById(req.params.id);
    if (!enrollment) return res.status(404).json({ error: "Enrollment not found" });

    enrollment.status = status;
    if (status !== "active" && !enrollment.endedAt) enrollment.endedAt = new Date();
    await enrollment.save();

    if (status === "active") {
      await Student.findByIdAndUpdate(enrollment.student, { currentEnrollment: enrollment._id });
    } else {
      // If this was the student's current enrollment and it just ended,
      // clear the pointer rather than leave it referencing a stale record.
      await Student.updateOne(
        { _id: enrollment.student, currentEnrollment: enrollment._id },
        { currentEnrollment: null }
      );
    }

    const populated = await enrollment.populate(POPULATE);
    res.json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
