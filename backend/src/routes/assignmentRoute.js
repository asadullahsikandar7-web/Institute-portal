import express from "express";
import Assignment from "../models/Assignment.js";
import { auth } from "../middleware/auth.js";

// Admin oversight only — read-only, mirrors subjectAttendanceRoute.js.
// Creating/editing/deleting an assignment is exclusively a teacher action
// scoped to their own TeacherAssignment (see teacherPortalRoute.js), so
// admin never writes here; this just lets Admin see everything teachers
// have posted across the institute.
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
    const assignments = await Assignment.find().populate(POPULATE).sort({ dueDate: -1 }).limit(500);
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
