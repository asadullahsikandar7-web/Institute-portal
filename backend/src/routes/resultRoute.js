import express from "express";
import { auth, authAny } from "../middleware/auth.js";
import { h, httpError, scalar } from "../utils/crudRouter.js";
import { requireOwnAssignment, filterStudentsInSection } from "../services/teacherAuth.js";
import { getSettings, gradeFor } from "../models/Settings.js";
import { notifyStudents } from "../services/notify.js";
import { GradebookConfig, CourseResult } from "../models/Erp.js";
import Student from "../models/studentModel.js";
import StudentEnrollment from "../models/StudentEnrollment.js";
import TeacherAssignment from "../models/TeacherAssignment.js";
import Subject from "../models/Subject.js";

// Gradebook → course results → GPA/CGPA → transcript.
// Teachers enter marks for their own classes (authorised through
// requireOwnAssignment, same as every other teacher write); an admin
// publishes; students and parents only ever read published rows.
// The legacy free-text Grade model (/api/grades) is left untouched.
const router = express.Router();

const DEFAULT_COMPONENTS = [
  { name: "Assignments", max: 10, weight: 10 },
  { name: "Quizzes", max: 10, weight: 10 },
  { name: "Midterm", max: 30, weight: 30 },
  { name: "Final", max: 50, weight: 50 },
];

// Weighted percentage over the components that actually have a mark, so a
// class midway through term shows a meaningful running grade instead of
// treating the not-yet-held final as a zero.
export function computePercentage(components, marks) {
  let earned = 0, weight = 0;
  for (const c of components) {
    const got = marks?.get ? marks.get(c.name) : marks?.[c.name];
    if (got === undefined || got === null || Number.isNaN(Number(got))) continue;
    earned += (Math.min(Number(got), c.max) / c.max) * c.weight;
    weight += c.weight;
  }
  return weight ? Math.round((earned / weight) * 10000) / 100 : 0;
}

// Credit-weighted GPA. Zero-credit courses appear on the transcript but
// don't move the average.
function gpaOf(rows) {
  const credits = rows.reduce((s, r) => s + (r.creditHours || 0), 0);
  if (!credits) return { gpa: null, credits: 0 };
  return { gpa: Math.round((rows.reduce((s, r) => s + r.gradePoint * (r.creditHours || 0), 0) / credits) * 100) / 100, credits };
}

// Used by the student portal, the parent portal and the admin transcript.
export async function buildTranscript(studentId, { publishedOnly = true } = {}) {
  const filter = { student: studentId };
  if (publishedOnly) filter.published = true;
  const [rows, settings] = await Promise.all([
    CourseResult.find(filter)
      .populate("subject", "name code creditHours")
      .populate("academicSession", "name startDate")
      .populate("program", "name code")
      .populate("section", "name"),
    getSettings(),
  ]);

  const bySession = new Map();
  for (const r of rows) {
    const key = String(r.academicSession?._id || "none");
    if (!bySession.has(key)) bySession.set(key, { session: r.academicSession, program: r.program, section: r.section, courses: [] });
    bySession.get(key).courses.push(r);
  }
  const terms = [...bySession.values()]
    .sort((a, b) => new Date(a.session?.startDate || 0) - new Date(b.session?.startDate || 0))
    .map(t => ({ ...t, ...gpaOf(t.courses) }));

  const overall = gpaOf(rows);
  const passMark = settings.passingPercent;
  const creditsEarned = rows.filter(r => r.percentage >= passMark).reduce((s, r) => s + (r.creditHours || 0), 0);
  // Degree progress, when the student's programme declares its credit
  // requirement (Program.requiredCredits).
  const student = await Student.findById(studentId).select("currentEnrollment").populate({ path: "currentEnrollment", select: "program", populate: { path: "program", select: "name requiredCredits" } });
  const program = student?.currentEnrollment?.program;
  const degree = program?.requiredCredits ? { program: program.name, requiredCredits: program.requiredCredits, earned: creditsEarned, remaining: Math.max(0, program.requiredCredits - creditsEarned), percent: Math.min(100, Math.round((creditsEarned / program.requiredCredits) * 100)) } : null;
  return {
    degree,
    terms,
    cgpa: overall.gpa,
    totalCredits: overall.credits,
    creditsEarned,
    failed: rows.filter(r => r.percentage < passMark).length,
    gradingScheme: settings.gradingScheme,
  };
}

// ═══════════════════════════ TEACHER GRADEBOOK ═════════════════════════════
router.get("/class/:assignmentId", auth("teacher"), requireOwnAssignment(), h(async (req, res) => {
  const ta = req.teacherAssignment;
  const [config, enrollments, results] = await Promise.all([
    GradebookConfig.findOne({ teacherAssignment: ta._id }),
    StudentEnrollment.find({ section: ta.section._id, status: "active" }).populate("student", "name rollNo photo"),
    CourseResult.find({ teacherAssignment: ta._id }),
  ]);
  const byStudent = new Map(results.map(r => [String(r.student), r]));
  res.json({
    components: config?.components?.length ? config.components : DEFAULT_COMPONENTS,
    configured: !!config,
    published: results.length > 0 && results.every(r => r.published),
    rows: enrollments
      .filter(e => e.student)
      .sort((a, b) => a.student.rollNo.localeCompare(b.student.rollNo, undefined, { numeric: true }))
      .map(e => ({ student: e.student, result: byStudent.get(String(e.student._id)) || null })),
  });
}));

// Saves the assessment scheme and/or a batch of marks in one request, then
// recomputes every affected row. Publishing locks the class against
// further teacher edits — an admin must unpublish first.
router.put("/class/:assignmentId", auth("teacher"), requireOwnAssignment(), h(async (req, res) => {
  const ta = req.teacherAssignment;
  if (await CourseResult.exists({ teacherAssignment: ta._id, published: true })) {
    throw httpError(409, "These results are published. Ask the examinations office to unpublish them before making changes.");
  }

  let config = await GradebookConfig.findOne({ teacherAssignment: ta._id });
  if (Array.isArray(req.body.components)) {
    const components = req.body.components
      .map(c => ({ name: String(c.name || "").trim(), max: Number(c.max), weight: Number(c.weight) }))
      .filter(c => c.name);
    if (!components.length) throw httpError(400, "Add at least one assessment component.");
    if (components.some(c => !(c.max > 0) || !(c.weight >= 0))) throw httpError(400, "Each component needs a maximum above 0 and a non-negative weight.");
    if (new Set(components.map(c => c.name.toLowerCase())).size !== components.length) throw httpError(400, "Component names must be unique.");
    if (!components.some(c => c.weight > 0)) throw httpError(400, "At least one component must carry weight.");
    config = await GradebookConfig.findOneAndUpdate({ teacherAssignment: ta._id }, { components }, { new: true, upsert: true });
  }
  const components = config?.components?.length ? config.components : DEFAULT_COMPONENTS;
  const maxOf = Object.fromEntries(components.map(c => [c.name, c.max]));

  const incoming = Array.isArray(req.body.rows) ? req.body.rows : [];
  // Only students genuinely in this section — see filterStudentsInSection.
  const allowed = new Set((await filterStudentsInSection(incoming.map(r => r.student).filter(Boolean), ta.section._id)).map(String));
  const settings = await getSettings();
  const subject = await Subject.findById(ta.subject._id).select("creditHours");

  const existing = await CourseResult.find({ teacherAssignment: ta._id });
  const byStudent = new Map(existing.map(r => [String(r.student), r]));

  for (const row of incoming) {
    if (!allowed.has(String(row.student))) continue;
    const doc = byStudent.get(String(row.student)) || new CourseResult({
      student: row.student, teacherAssignment: ta._id, academicSession: ta.academicSession._id,
      program: ta.program._id, section: ta.section._id, subject: ta.subject._id,
    });
    for (const [name, value] of Object.entries(row.marks || {})) {
      if (!(name in maxOf)) continue;
      if (value === "" || value === null) { doc.marks.delete(name); continue; }
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0 || n > maxOf[name]) throw httpError(400, `${name}: marks must be between 0 and ${maxOf[name]}.`);
      doc.marks.set(name, n);
    }
    if (row.remarks !== undefined) doc.remarks = String(row.remarks).slice(0, 500);
    byStudent.set(String(row.student), doc);
  }

  // Recompute everything (not just the rows sent) — a scheme change alters
  // every student's percentage, including ones not in this batch.
  for (const doc of byStudent.values()) {
    for (const name of [...doc.marks.keys()]) if (!(name in maxOf)) doc.marks.delete(name);
    doc.creditHours = subject?.creditHours ?? 3;
    doc.percentage = computePercentage(components, doc.marks);
    const g = gradeFor(doc.percentage, settings.gradingScheme);
    doc.grade = g.grade;
    doc.gradePoint = g.points;
    await doc.save();
  }
  res.json({ saved: byStudent.size });
}));

// ═══════════════════════════ ADMIN / EXAMINATIONS OFFICE ═══════════════════
router.get("/overview", auth("admin"), h(async (req, res) => {
  const filter = { status: "active" };
  const session = scalar(req.query.academicSession);
  if (session) filter.academicSession = session;
  const [assignments, stats] = await Promise.all([
    TeacherAssignment.find(filter).populate("teacher", "name").populate("subject", "name code creditHours").populate("section", "name").populate("program", "name code").populate("academicSession", "name"),
    CourseResult.aggregate([{ $group: { _id: "$teacherAssignment", count: { $sum: 1 }, avg: { $avg: "$percentage" }, published: { $sum: { $cond: ["$published", 1, 0] } }, top: { $max: "$percentage" }, low: { $min: "$percentage" } } }]),
  ]);
  const settings = await getSettings();
  const byTa = new Map(stats.map(s => [String(s._id), s]));
  const passCounts = await CourseResult.aggregate([{ $match: { percentage: { $gte: settings.passingPercent } } }, { $group: { _id: "$teacherAssignment", n: { $sum: 1 } } }]);
  const passBy = new Map(passCounts.map(p => [String(p._id), p.n]));
  res.json(assignments.map(a => {
    const s = byTa.get(String(a._id));
    return {
      assignment: a,
      entered: s?.count || 0,
      average: s ? Math.round(s.avg * 10) / 10 : null,
      top: s?.top ?? null, low: s?.low ?? null,
      passRate: s?.count ? Math.round(((passBy.get(String(a._id)) || 0) / s.count) * 100) : null,
      published: !!s && s.published === s.count,
    };
  }));
}));

router.get("/class-admin/:assignmentId", auth("admin"), h(async (req, res) => {
  const [config, results] = await Promise.all([
    GradebookConfig.findOne({ teacherAssignment: req.params.assignmentId }),
    CourseResult.find({ teacherAssignment: req.params.assignmentId }).populate("student", "name rollNo").sort({ percentage: -1 }),
  ]);
  res.json({ components: config?.components?.length ? config.components : DEFAULT_COMPONENTS, results });
}));

router.post("/publish", auth("admin"), h(async (req, res) => {
  const { teacherAssignment, academicSession, published = true } = req.body;
  if (!teacherAssignment && !academicSession) throw httpError(400, "Choose a class or a whole session to publish.");
  const filter = teacherAssignment ? { teacherAssignment } : { academicSession };
  const newly = published ? await CourseResult.find({ ...filter, published: false }).distinct("student") : [];
  const r = await CourseResult.updateMany(filter, { published: !!published, publishedAt: published ? new Date() : null });
  await notifyStudents(newly, { title: "Results published", message: "New course results have been published. Open your transcript to see your grades and GPA.", type: "grade", actionUrl: "/student/results" });
  res.json({ updated: r.modifiedCount, published: !!published });
}));

// Merit list for a section or program within a session, ranked by GPA
// with dense ranking (ties share a position).
router.get("/merit", auth("admin"), h(async (req, res) => {
  const filter = {};
  for (const k of ["section", "program", "academicSession"]) { const v = scalar(req.query[k]); if (v) filter[k] = v; }
  if (!filter.academicSession && !filter.section) throw httpError(400, "Pick a session or a section.");
  const rows = await CourseResult.find(filter).populate("student", "name rollNo photo");
  const byStudent = new Map();
  for (const r of rows) {
    if (!r.student) continue;
    const id = String(r.student._id);
    if (!byStudent.has(id)) byStudent.set(id, { student: r.student, courses: [] });
    byStudent.get(id).courses.push(r);
  }
  const list = [...byStudent.values()].map(s => ({
    student: s.student, courses: s.courses.length, ...gpaOf(s.courses),
    average: Math.round((s.courses.reduce((a, c) => a + c.percentage, 0) / s.courses.length) * 10) / 10,
  })).sort((a, b) => (b.gpa ?? -1) - (a.gpa ?? -1) || b.average - a.average);
  let rank = 0, last = null;
  list.forEach(l => { const key = `${l.gpa}|${l.average}`; if (key !== last) { rank += 1; last = key; } l.rank = rank; });
  res.json(list);
}));

// ═══════════════════════════ TRANSCRIPTS ═══════════════════════════════════
router.get("/mine", auth("student"), h(async (req, res) => {
  res.json(await buildTranscript(req.user.id, { publishedOnly: true }));
}));

router.get("/transcript/:studentId", authAny("admin"), h(async (req, res) => {
  const student = await Student.findById(req.params.studentId).select("name rollNo registrationNo photo dob").populate({ path: "currentEnrollment", populate: [{ path: "program", select: "name code" }, { path: "section", select: "name" }] });
  if (!student) throw httpError(404, "Student not found");
  const transcript = await buildTranscript(student._id, { publishedOnly: scalar(req.query.includeDraft) !== "1" });
  res.json({ student, ...transcript });
}));

export default router;
