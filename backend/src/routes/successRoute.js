import express from "express";
import { auth, authAny } from "../middleware/auth.js";
import { h, httpError, scalar } from "../utils/crudRouter.js";
import { requireOwnAssignment, findTeacherAssignmentForStudent } from "../services/teacherAuth.js";
import { computeRisk } from "../services/risk.js";
import { Intervention } from "../models/Smart.js";
import Student from "../models/studentModel.js";
import Teacher from "../models/Teacher.js";
import StudentEnrollment from "../models/StudentEnrollment.js";

// Student Success — the early-warning list (see services/risk.js for how
// the score is built) and the intervention log kept beside it.
const router = express.Router();

async function riskRows(enrollmentFilter) {
  const enrollments = await StudentEnrollment.find({ status: "active", ...enrollmentFilter })
    .populate("student", "name rollNo photo email parentName parentEmail phone")
    .populate("program", "name code").populate("section", "name");
  const live = enrollments.filter(e => e.student);
  const [risk, open] = await Promise.all([
    computeRisk(live.map(e => e.student._id)),
    Intervention.aggregate([{ $match: { student: { $in: live.map(e => e.student._id) } } }, { $group: { _id: "$student", total: { $sum: 1 }, open: { $sum: { $cond: [{ $eq: ["$status", "open"] }, 1, 0] } }, last: { $max: "$createdAt" } } }]),
  ]);
  const interventions = new Map(open.map(o => [String(o._id), o]));
  return live.map(e => ({
    student: e.student, program: e.program, section: e.section,
    ...risk.get(String(e.student._id)),
    interventions: interventions.get(String(e.student._id)) || { total: 0, open: 0, last: null },
  })).sort((a, b) => b.score - a.score);
}

const summarize = (rows) => ({
  total: rows.length,
  high: rows.filter(r => r.level === "high").length,
  medium: rows.filter(r => r.level === "medium").length,
  low: rows.filter(r => r.level === "low").length,
  // Flagged high-risk but nobody has logged any follow-up yet.
  unattended: rows.filter(r => r.level === "high" && r.interventions.total === 0).length,
  byFactor: ["attendance", "academics", "fees", "coursework", "conduct"].map(f => ({ factor: f, students: rows.filter(r => r.reasons.some(x => x.factor === f && x.points > 0)).length })),
});

router.get("/overview", auth("admin"), h(async (req, res) => {
  const filter = {};
  for (const k of ["section", "program", "academicSession"]) { const v = scalar(req.query[k]); if (v) filter[k] = v; }
  const rows = await riskRows(filter);
  res.json({ summary: summarize(rows), rows });
}));

// A teacher sees the same picture, limited to one of their own classes.
router.get("/class/:assignmentId", auth("teacher"), requireOwnAssignment(), h(async (req, res) => {
  const rows = await riskRows({ section: req.teacherAssignment.section._id });
  res.json({ summary: summarize(rows), rows });
}));

// Staff may act on a student if they're an admin, or a teacher who
// actually teaches that student.
async function assertCanSee(user, studentId) {
  if (user.role === "admin") return;
  if (!(await findTeacherAssignmentForStudent(user.id, studentId))) throw httpError(403, "This student is not in any of your classes.");
}

router.get("/student/:id", authAny("admin", "teacher"), h(async (req, res) => {
  await assertCanSee(req.user, req.params.id);
  const [risk, interventions] = await Promise.all([
    computeRisk([req.params.id]),
    Intervention.find({ student: req.params.id }).sort({ createdAt: -1 }),
  ]);
  res.json({ ...risk.get(req.params.id), interventions });
}));

router.post("/interventions", authAny("admin", "teacher"), h(async (req, res) => {
  const { student, type, notes, followUpOn } = req.body;
  if (!student || !(await Student.exists({ _id: student }))) throw httpError(404, "Student not found");
  await assertCanSee(req.user, student);
  const byName = req.user.role === "admin" ? req.user.email || "Admin" : (await Teacher.findById(req.user.id).select("name"))?.name || "Teacher";
  const doc = await Intervention.create({ student, type, notes, followUpOn: followUpOn || null, byRole: req.user.role, byId: String(req.user.id), byName });
  res.status(201).json(doc);
}));

router.patch("/interventions/:id", authAny("admin", "teacher"), h(async (req, res) => {
  const doc = await Intervention.findById(req.params.id);
  if (!doc) throw httpError(404, "Not found");
  // Teachers may only close out their own entries; admins any.
  if (req.user.role !== "admin" && doc.byId !== String(req.user.id)) throw httpError(403, "You can only update interventions you logged.");
  if (req.body.status !== undefined) doc.status = req.body.status;
  if (req.body.notes !== undefined) doc.notes = req.body.notes;
  if (req.body.followUpOn !== undefined) doc.followUpOn = req.body.followUpOn || null;
  await doc.save();
  res.json(doc);
}));

export default router;
