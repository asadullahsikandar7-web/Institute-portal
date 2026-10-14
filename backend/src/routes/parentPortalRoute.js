import express from "express";
import { auth } from "../middleware/auth.js";
import { h, httpError } from "../utils/crudRouter.js";
import { buildTranscript } from "./resultRoute.js";
import { attendanceSummary } from "./lifecycleRoute.js";
import { getSettings } from "../models/Settings.js";
import Parent from "../models/Parent.js";
import Student from "../models/studentModel.js";
import Fee from "../models/FeeModel.js";
import Leave from "../models/leavemodel.js";
import StudentEnrollment from "../models/StudentEnrollment.js";
import TeacherAssignment from "../models/TeacherAssignment.js";
import Assignment from "../models/Assignment.js";

// Parent portal — read-only visibility into the parent's own children.
// "Own children" is always resolved server-side as Student.parentId ===
// the authenticated parent; a child id in the URL is only ever used to
// pick among those, never trusted on its own.
const router = express.Router();
router.use(auth("parent"));

async function ownChild(req) {
  const child = await Student.findOne({ _id: req.params.id, parentId: req.user.id })
    .populate({ path: "currentEnrollment", populate: [{ path: "program", select: "name code" }, { path: "section", select: "name" }, { path: "academicSession", select: "name" }] });
  if (!child) throw httpError(404, "Student not found");
  return child;
}

router.get("/me", h(async (req, res) => {
  const parent = await Parent.findById(req.user.id);
  if (!parent || parent.status !== "active" || !parent.portalEnabled) throw httpError(401, "Portal access is not enabled for this account.");
  res.json(parent);
}));

router.get("/children", h(async (req, res) => {
  const children = await Student.find({ parentId: req.user.id }).select("name rollNo photo currentEnrollment")
    .populate({ path: "currentEnrollment", populate: [{ path: "program", select: "name code" }, { path: "section", select: "name" }] });
  res.json(children);
}));

router.get("/children/:id/overview", h(async (req, res) => {
  const child = await ownChild(req);
  const enrollment = await StudentEnrollment.findOne({ student: child._id, status: "active" });
  const assignments = enrollment
    ? await TeacherAssignment.find({ academicSession: enrollment.academicSession, program: enrollment.program, section: enrollment.section, status: "active" }).populate("subject", "name code").populate("teacher", "name")
    : [];
  const [attendance, fees, transcript, leaves, coursework, settings] = await Promise.all([
    attendanceSummary(child._id),
    Fee.find({ studentId: child._id }).sort({ dueDate: 1 }),
    buildTranscript(child._id, { publishedOnly: true }),
    Leave.find({ studentId: child._id }).sort({ appliedAt: -1 }).limit(10),
    Assignment.find({ teacherAssignment: { $in: assignments.map(a => a._id) }, status: "active", dueDate: { $gte: new Date() } }).populate({ path: "teacherAssignment", select: "subject", populate: { path: "subject", select: "name" } }).sort({ dueDate: 1 }).limit(10),
    getSettings(),
  ]);
  res.json({
    child: child.toSafeObject(),
    subjects: assignments.map(a => ({ subject: a.subject, teacher: a.teacher })),
    attendance,
    minAttendancePercent: settings.minAttendancePercent,
    fees: { items: fees, billed: fees.reduce((s, f) => s + f.netAmount, 0), balance: fees.reduce((s, f) => s + f.balance, 0) },
    transcript, leaves, coursework,
  });
}));

export default router;
