import express from "express";
import crypto from "crypto";
import { auth, authAny } from "../middleware/auth.js";
import { h, httpError, scalar, crudRouter } from "../utils/crudRouter.js";
import { requireOwnAssignment, loadOwnAssignment } from "../services/teacherAuth.js";
import { planTimetable, validSlots } from "../services/planner.js";
import { computeRisk } from "../services/risk.js";
import { getSettings } from "../models/Settings.js";
import { AttendanceSession, PaymentClaim, Survey, SurveyResponse, ExamSession, ExamPaper } from "../models/Smart.js";
import { Admission, BookIssue, CourseResult, Payslip, QuizAttempt, Submission, Ticket } from "../models/Erp.js";
import Notification from "../models/notificationModel.js";
import Student from "../models/studentModel.js";
import Room from "../models/Room.js";
import Fee from "../models/FeeModel.js";
import Quiz from "../models/Quiz.js";
import Leave from "../models/leavemodel.js";
import Assignment from "../models/Assignment.js";
import TimetableEntry from "../models/TimetableEntry.js";
import TeacherAssignment from "../models/TeacherAssignment.js";
import StudentEnrollment from "../models/StudentEnrollment.js";
import SubjectAttendance from "../models/SubjectAttendance.js";

// The "smart" layer: automatic timetabling, live attendance check-in,
// payment claims, anonymous teacher evaluation, the notification inbox and
// the per-role "needs attention" feed.
const router = express.Router();
const SECRET = process.env.JWT_SECRET || "super_secret_key";
const DAY = 86400000;
const todayStr = () => new Date().toISOString().slice(0, 10);

async function myClasses(studentId) {
  const enrollment = await StudentEnrollment.findOne({ student: studentId, status: "active" });
  if (!enrollment) return { enrollment: null, assignments: [] };
  const assignments = await TeacherAssignment.find({ academicSession: enrollment.academicSession, program: enrollment.program, section: enrollment.section, status: "active" })
    .populate("subject", "name code").populate("teacher", "name");
  return { enrollment, assignments };
}

// ═══════════════════════════ AUTO TIMETABLE ════════════════════════════════
// Preview by default; `commit: true` writes it. `replace: true` clears the
// session's existing entries first, otherwise the generator works around
// them and only schedules classes that have no slots yet.
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
router.post("/timetable/generate", auth("admin"), h(async (req, res) => {
  const { academicSession, replace = false, commit = false } = req.body;
  const days = (Array.isArray(req.body.days) ? req.body.days : []).filter(d => WEEKDAYS.includes(d));
  const slots = req.body.slots;
  if (!academicSession) throw httpError(400, "Choose an academic session.");
  if (!days.length) throw httpError(400, "Choose at least one teaching day.");
  if (!validSlots(slots)) throw httpError(400, "Daily periods must not overlap, and each must end after it starts.");

  const [assignments, rooms, current] = await Promise.all([
    TeacherAssignment.find({ academicSession, status: "active" }).populate("subject", "name code creditHours").populate("teacher", "name").populate("section", "name").populate("program", "name code"),
    Room.find({ status: "active", type: { $in: ["classroom", "lab", "auditorium"] } }),
    TimetableEntry.find({ academicSession }),
  ]);
  if (!assignments.length) throw httpError(400, "There are no active teacher assignments in this session to schedule.");
  if (!rooms.length) throw httpError(400, "Add at least one classroom or lab under Rooms & Facilities first.");

  const sizes = await StudentEnrollment.aggregate([{ $match: { status: "active", section: { $in: assignments.map(a => a.section._id) } } }, { $group: { _id: "$section", n: { $sum: 1 } } }]);
  const sizeOf = new Map(sizes.map(s => [String(s._id), s.n]));
  const existing = replace ? [] : current;
  const scheduled = new Map();
  existing.forEach(e => scheduled.set(String(e.teacherAssignment), (scheduled.get(String(e.teacherAssignment)) || 0) + 1));

  // One period per credit hour per week (3 if the subject has none set).
  const work = assignments.map(a => {
    const want = Math.max(1, Math.min(6, Math.round(a.subject?.creditHours || 3)));
    return { _id: a._id, teacher: a.teacher?._id, section: a.section._id, subject: a.subject?._id, program: a.program?._id, subjectName: a.subject?.name, size: sizeOf.get(String(a.section._id)) || 0, sessions: Math.max(0, want - (scheduled.get(String(a._id)) || 0)), doc: a };
  }).filter(w => w.sessions > 0 && w.subject);

  const { placed, unplaced } = planTimetable({ assignments: work, rooms, existing, days, slots });
  const describe = (a) => ({ subject: a.doc.subject?.name, section: `${a.doc.program?.code || ""} ${a.doc.section?.name || ""}`.trim(), teacher: a.doc.teacher?.name || "TBA" });

  if (commit) {
    if (replace) await TimetableEntry.deleteMany({ academicSession });
    if (placed.length) {
      await TimetableEntry.insertMany(placed.map(p => ({
        academicSession, program: p.assignment.program, section: p.assignment.section, subject: p.assignment.subject,
        teacherAssignment: p.assignment._id, teacher: p.assignment.teacher || null, room: p.room._id,
        day: p.day, startTime: p.startTime, endTime: p.endTime, type: p.type,
      })), { ordered: false });
    }
  }
  res.status(commit ? 201 : 200).json({
    committed: !!commit,
    kept: existing.length,
    placed: placed.map(p => ({ ...describe(p.assignment), day: p.day, startTime: p.startTime, endTime: p.endTime, room: p.room.name, type: p.type })),
    unplaced: unplaced.map(u => ({ ...describe(u.assignment), reason: u.reason })),
    capacity: { periodsPerWeek: days.length * slots.length, rooms: rooms.length, requested: work.reduce((s, w) => s + w.sessions, 0) },
  });
}));

// ═══════════════════════════ LIVE ATTENDANCE ═══════════════════════════════
const WINDOW_MS = 30000;
const codeFor = (secret, window) => String(parseInt(crypto.createHmac("sha256", secret).update(String(window)).digest("hex").slice(0, 8), 16) % 1000000).padStart(6, "0");
const currentWindow = () => Math.floor(Date.now() / WINDOW_MS);

router.post("/attendance/:assignmentId/open", auth("teacher"), requireOwnAssignment(), h(async (req, res) => {
  const minutes = Math.max(1, Math.min(30, Number(req.body.minutes) || 5));
  const ta = req.teacherAssignment;
  // Only one live session per class at a time.
  await AttendanceSession.updateMany({ teacherAssignment: ta._id, closedAt: null }, { closedAt: new Date() });
  const session = await AttendanceSession.create({ teacherAssignment: ta._id, teacher: req.user.id, date: todayStr(), secret: crypto.randomBytes(24).toString("hex"), expiresAt: new Date(Date.now() + minutes * 60000) });
  res.status(201).json({ _id: session._id, expiresAt: session.expiresAt });
}));

async function ownSession(req) {
  const session = await AttendanceSession.findOne({ _id: req.params.id, teacher: req.user.id }).select("+secret");
  if (!session) throw httpError(404, "Session not found");
  return session;
}

// Polled by the teacher's screen every few seconds for the current code.
router.get("/attendance/session/:id", auth("teacher"), h(async (req, res) => {
  const session = await ownSession(req);
  const live = !session.closedAt && session.expiresAt > new Date();
  const [students, total] = await Promise.all([
    Student.find({ _id: { $in: session.checkedIn } }).select("name rollNo").sort({ rollNo: 1 }),
    TeacherAssignment.findById(session.teacherAssignment).select("section").then(ta => StudentEnrollment.countDocuments({ section: ta.section, status: "active" })),
  ]);
  res.json({
    live, expiresAt: session.expiresAt,
    code: live ? codeFor(session.secret, currentWindow()) : null,
    rotatesIn: Math.ceil((WINDOW_MS - (Date.now() % WINDOW_MS)) / 1000),
    checkedIn: students, total,
  });
}));

// Ends the session. With markAbsent, every student in the section who has
// no attendance record for today is written as absent — existing records
// (including a manual "leave") are never overwritten.
router.post("/attendance/session/:id/close", auth("teacher"), h(async (req, res) => {
  const session = await ownSession(req);
  if (!session.closedAt) { session.closedAt = new Date(); await session.save(); }
  let markedAbsent = 0;
  if (req.body.markAbsent) {
    const ta = await loadOwnAssignment(req.user.id, session.teacherAssignment);
    if (ta) {
      const [enrollments, existing] = await Promise.all([
        StudentEnrollment.find({ section: ta.section._id, status: "active" }).select("student"),
        SubjectAttendance.find({ teacherAssignment: ta._id, date: session.date }).select("student"),
      ]);
      const have = new Set(existing.map(e => String(e.student)));
      const rows = enrollments.filter(e => !have.has(String(e.student))).map(e => ({
        student: e.student, academicSession: ta.academicSession._id, program: ta.program._id, section: ta.section._id, subject: ta.subject._id,
        teacherAssignment: ta._id, markedBy: req.user.id, date: session.date, status: "absent",
      }));
      if (rows.length) await SubjectAttendance.insertMany(rows, { ordered: false }).catch(() => {});
      markedAbsent = rows.length;
    }
  }
  res.json({ closed: true, present: session.checkedIn.length, markedAbsent });
}));

// Which of my classes are taking attendance right now (never the code).
router.get("/attendance/open", auth("student"), h(async (req, res) => {
  const { assignments } = await myClasses(req.user.id);
  const sessions = await AttendanceSession.find({ teacherAssignment: { $in: assignments.map(a => a._id) }, closedAt: null, expiresAt: { $gt: new Date() } });
  const bySubject = new Map(assignments.map(a => [String(a._id), a]));
  res.json(sessions.map(s => ({ _id: s._id, subject: bySubject.get(String(s.teacherAssignment))?.subject, expiresAt: s.expiresAt, done: s.checkedIn.some(x => String(x) === String(req.user.id)) })));
}));

// A 6-digit code is guessable in bulk, so wrong attempts are capped per
// student account (not per IP — a whole class shares the campus Wi-Fi).
const attempts = new Map();
router.post("/attendance/checkin", auth("student"), h(async (req, res) => {
  const key = String(req.user.id), now = Date.now();
  const a = attempts.get(key);
  if (a && a.until > now && a.count >= 6) throw httpError(429, "Too many wrong codes. Wait a few minutes, or ask your teacher to mark you manually.");
  const code = String(req.body.code || "").replace(/\D/g, "");
  if (code.length !== 6) throw httpError(400, "Enter the 6-digit code shown on your teacher's screen.");

  const { assignments } = await myClasses(req.user.id);
  const sessions = await AttendanceSession.find({ teacherAssignment: { $in: assignments.map(x => x._id) }, closedAt: null, expiresAt: { $gt: new Date() } }).select("+secret");
  if (!sessions.length) throw httpError(400, "None of your classes is taking attendance right now.");
  const w = currentWindow();
  // The previous window is accepted too, so a code read just before it
  // rotated still works.
  const session = sessions.find(s => [w, w - 1].some(x => codeFor(s.secret, x) === code));
  if (!session) {
    attempts.set(key, { count: (a && a.until > now ? a.count : 0) + 1, until: now + 5 * 60000 });
    throw httpError(400, "That code isn't right, or it has already changed. Check the screen and try again.");
  }
  attempts.delete(key);
  const ta = assignments.find(x => String(x._id) === String(session.teacherAssignment));
  await SubjectAttendance.updateOne(
    { student: req.user.id, academicSession: ta.academicSession, program: ta.program, section: ta.section, subject: ta.subject._id, date: session.date },
    { $set: { status: "present", markedBy: session.teacher, teacherAssignment: ta._id } }, { upsert: true });
  await AttendanceSession.updateOne({ _id: session._id }, { $addToSet: { checkedIn: req.user.id } });
  res.json({ marked: true, subject: ta.subject?.name });
}));

// ═══════════════════════════ PAYMENT CLAIMS ════════════════════════════════
// Submitted by a student for their own fee, or by a parent for a linked
// child's fee. Review happens in /api/finance/claims.
router.get("/claims", authAny("student", "parent"), h(async (req, res) => {
  const students = req.user.role === "student" ? [req.user.id] : await Student.find({ parentId: req.user.id }).distinct("_id");
  res.json(await PaymentClaim.find({ student: { $in: students } }).populate("fee", "title period").sort({ createdAt: -1 }).limit(100));
}));

router.post("/claims", authAny("student", "parent"), h(async (req, res) => {
  const fee = await Fee.findById(scalar(req.body.fee));
  if (!fee) throw httpError(404, "Fee not found");
  const owns = req.user.role === "student" ? String(fee.studentId) === String(req.user.id) : !!(await Student.exists({ _id: fee.studentId, parentId: req.user.id }));
  if (!owns) throw httpError(404, "Fee not found");
  if (fee.balance <= 0) throw httpError(400, "This fee is already fully paid.");
  const amount = Number(req.body.amount);
  if (!(amount > 0) || amount > fee.balance + 0.001) throw httpError(400, `Enter an amount between 1 and the balance (${fee.balance}).`);
  if (await PaymentClaim.exists({ fee: fee._id, status: "pending" })) throw httpError(409, "A payment claim for this fee is already waiting for verification.");
  const paidOn = req.body.paidOn ? new Date(req.body.paidOn) : new Date();
  if (Number.isNaN(paidOn.getTime()) || paidOn > new Date(Date.now() + DAY)) throw httpError(400, "The payment date can't be in the future.");
  const claim = await PaymentClaim.create({ fee: fee._id, student: fee.studentId, amount, method: req.body.method, reference: req.body.reference, paidOn, note: req.body.note, submittedByRole: req.user.role });
  res.status(201).json(claim);
}));

// ═══════════════════════════ TEACHER EVALUATION ════════════════════════════
const responderKey = (studentId, surveyId, taId) => crypto.createHmac("sha256", SECRET).update(`${studentId}|${surveyId}|${taId}`).digest("hex");
// Below this many responses a teacher is not shown their results — with
// two or three, a comment can identify its author.
const MIN_RESPONSES = 3;

router.get("/surveys/pending", auth("student"), h(async (req, res) => {
  const { enrollment, assignments } = await myClasses(req.user.id);
  if (!enrollment) return res.json([]);
  const surveys = await Survey.find({ academicSession: enrollment.academicSession, status: "open" });
  if (!surveys.length) return res.json([]);
  const keys = surveys.flatMap(s => assignments.map(a => responderKey(req.user.id, s._id, a._id)));
  const done = new Set((await SurveyResponse.find({ responderKey: { $in: keys } }).select("responderKey")).map(r => r.responderKey));
  res.json(surveys.flatMap(s => assignments.filter(a => !done.has(responderKey(req.user.id, s._id, a._id)))
    .map(a => ({ survey: { _id: s._id, title: s.title, questions: s.questions, closesOn: s.closesOn }, teacherAssignment: a._id, subject: a.subject, teacher: a.teacher }))));
}));

router.post("/surveys/:id/respond", auth("student"), h(async (req, res) => {
  const survey = await Survey.findById(req.params.id);
  if (!survey || survey.status !== "open") throw httpError(400, "This survey is not open.");
  const { assignments } = await myClasses(req.user.id);
  const ta = assignments.find(a => String(a._id) === String(req.body.teacherAssignment) && String(a.academicSession) === String(survey.academicSession));
  if (!ta) throw httpError(404, "That class isn't one of yours.");
  const ratings = Array.isArray(req.body.ratings) ? req.body.ratings.map(Number) : [];
  if (ratings.length !== survey.questions.length || ratings.some(r => !Number.isInteger(r) || r < 1 || r > 5)) throw httpError(400, "Rate every statement from 1 to 5.");
  await SurveyResponse.create({ survey: survey._id, teacherAssignment: ta._id, teacher: ta.teacher._id, responderKey: responderKey(req.user.id, survey._id, ta._id), ratings, comment: String(req.body.comment || "").trim().slice(0, 1000) });
  res.status(201).json({ saved: true });
}));

function aggregate(survey, responses) {
  const n = responses.length;
  const perQuestion = survey.questions.map((q, i) => ({ text: q, average: n ? Math.round((responses.reduce((s, r) => s + (r.ratings[i] || 0), 0) / n) * 100) / 100 : null }));
  const overall = n ? Math.round((perQuestion.reduce((s, q) => s + q.average, 0) / perQuestion.length) * 100) / 100 : null;
  // Sorted, not in submission order, so the order can't hint at who wrote what.
  return { responses: n, overall, perQuestion, comments: responses.map(r => r.comment).filter(Boolean).sort() };
}

router.get("/surveys/:id/results", auth("admin"), h(async (req, res) => {
  const survey = await Survey.findById(req.params.id);
  if (!survey) throw httpError(404, "Survey not found");
  const responses = await SurveyResponse.find({ survey: survey._id }).populate("teacher", "name").populate({ path: "teacherAssignment", select: "subject section", populate: [{ path: "subject", select: "name" }, { path: "section", select: "name" }] });
  const groups = new Map();
  for (const r of responses) groups.set(String(r.teacherAssignment?._id), [...(groups.get(String(r.teacherAssignment?._id)) || []), r]);
  res.json({
    survey, total: responses.length,
    classes: [...groups.values()].map(rs => ({ teacher: rs[0].teacher, subject: rs[0].teacherAssignment?.subject, section: rs[0].teacherAssignment?.section, ...aggregate(survey, rs) })).sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0)),
  });
}));

// A teacher's own feedback, once the survey has closed.
router.get("/surveys/mine", auth("teacher"), h(async (req, res) => {
  const surveys = await Survey.find({ status: "closed" }).sort({ updatedAt: -1 }).limit(10);
  const out = [];
  for (const survey of surveys) {
    const responses = await SurveyResponse.find({ survey: survey._id, teacher: req.user.id });
    if (responses.length < MIN_RESPONSES) { if (responses.length) out.push({ survey: { _id: survey._id, title: survey.title }, withheld: true, responses: responses.length }); continue; }
    out.push({ survey: { _id: survey._id, title: survey.title }, ...aggregate(survey, responses) });
  }
  res.json(out);
}));

router.use("/surveys", crudRouter(Survey, {
  fields: ["title", "academicSession", "questions", "status", "closesOn"],
  populate: [{ path: "academicSession", select: "name" }], filters: ["status", "academicSession"],
  beforeUpdate: async (d, req, doc) => {
    if (d.questions && JSON.stringify(d.questions) !== JSON.stringify(doc.questions) && (await SurveyResponse.exists({ survey: doc._id }))) throw httpError(409, "Responses have already been collected — the questions can no longer be changed.");
  },
  beforeDelete: async (doc) => { await SurveyResponse.deleteMany({ survey: doc._id }); },
}));

// ═══════════════════════════ NOTIFICATION INBOX ════════════════════════════
// Personal notifications for the signed-in user, in any portal. (Institute
// announcements stay on the Announcements page.)
const mine = (user) => ({ recipientId: user.id, recipientType: user.role });
router.get("/inbox", authAny("admin", "teacher", "student", "parent"), h(async (req, res) => {
  const [items, unread] = await Promise.all([
    Notification.find(mine(req.user)).sort({ sentAt: -1 }).limit(40),
    Notification.countDocuments({ ...mine(req.user), isRead: false }),
  ]);
  res.json({ items, unread });
}));
router.post("/inbox/read", authAny("admin", "teacher", "student", "parent"), h(async (req, res) => {
  const filter = { ...mine(req.user), isRead: false };
  const id = scalar(req.body.id);
  if (id) filter._id = id;
  const r = await Notification.updateMany(filter, { isRead: true, readAt: new Date() });
  res.json({ updated: r.modifiedCount });
}));

// ═══════════════════════════ NEEDS ATTENTION ═══════════════════════════════
// One list per role of what is waiting on this person right now, each with
// a link to where it gets done. Items with a zero count are omitted.
// `label` is "singular|plural"; the right form is picked for the count.
const item = (key, count, label, to, tone = "warn") => (count > 0 ? { key, count, label: label.split("|")[count === 1 ? 0 : 1] ?? label, to, tone } : null);

router.get("/today", authAny("admin", "teacher", "student"), h(async (req, res) => {
  const now = new Date(), soon = new Date(now.getTime() + 7 * DAY);
  let items = [];

  if (req.user.role === "student") {
    const id = req.user.id;
    const { enrollment, assignments } = await myClasses(id);
    const taIds = assignments.map(a => a._id);
    const [work, submitted, fees, quizzes, attempts, loans, attendance, settings, surveys, papers] = await Promise.all([
      Assignment.find({ teacherAssignment: { $in: taIds }, status: "active", dueDate: { $lte: soon } }).select("dueDate"),
      Submission.find({ student: id }).distinct("assignment"),
      Fee.find({ studentId: id, status: { $ne: "paid" } }).select("amount discount fine paidAmount status dueDate"),
      Quiz.find({ teacherAssignment: { $in: taIds }, status: "active", scheduledAt: { $lte: now }, "questions.0": { $exists: true }, $or: [{ closesAt: null }, { closesAt: { $gt: now } }] }).select("_id"),
      QuizAttempt.find({ student: id, submittedAt: { $ne: null } }).distinct("quiz"),
      BookIssue.find({ student: id, status: "issued", dueOn: { $lte: new Date(now.getTime() + 3 * DAY) } }).select("dueOn"),
      SubjectAttendance.aggregate([{ $match: { student: enrollment?.student, teacherAssignment: { $in: taIds } } }, { $group: { _id: "$teacherAssignment", total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } } } }]),
      getSettings(),
      enrollment ? Survey.find({ academicSession: enrollment.academicSession, status: "open" }).select("_id") : [],
      enrollment ? ExamPaper.find({ section: enrollment.section, date: { $gte: todayStr(), $lte: soon.toISOString().slice(0, 10) }, examSession: { $in: await ExamSession.find({ status: "published" }).distinct("_id") } }).select("_id") : [],
    ]);
    const done = new Set(submitted.map(String));
    const open = work.filter(w => !done.has(String(w._id)));
    const taken = new Set(attempts.map(String));
    const overdue = fees.filter(f => f.balance > 0 && f.dueDate < now);
    const low = attendance.filter(a => a.total >= 5 && (a.present / a.total) * 100 < settings.minAttendancePercent).length;
    let surveyCount = 0;
    if (surveys.length) {
      const keys = surveys.flatMap(s => assignments.map(a => responderKey(id, s._id, a._id)));
      surveyCount = keys.length - (await SurveyResponse.countDocuments({ responderKey: { $in: keys } }));
    }
    items = [
      item("overdue-work", open.filter(w => w.dueDate < now).length, "assignment overdue|assignments overdue", "/student/assignments", "danger"),
      item("due-work", open.filter(w => w.dueDate >= now).length, "assignment due this week|assignments due this week", "/student/assignments"),
      item("quizzes", quizzes.filter(q => !taken.has(String(q._id))).length, "quiz open to take|quizzes open to take", "/student/quizzes", "info"),
      item("exams", papers.length, "exam paper in the next 7 days|exam papers in the next 7 days", "/student/exams", "info"),
      item("fees-overdue", overdue.length, "fee overdue|fees overdue", "/student/fees", "danger"),
      item("fees-due", fees.filter(f => f.balance > 0 && f.dueDate >= now && f.dueDate <= soon).length, "fee due this week|fees due this week", "/student/fees"),
      item("attendance", low, `subject below ${settings.minAttendancePercent}% attendance|subjects below ${settings.minAttendancePercent}% attendance`, "/student/attendance", "danger"),
      item("library", loans.length, "library book due or overdue|library books due or overdue", "/student/library"),
      item("surveys", surveyCount, "teacher evaluation to fill in|teacher evaluations to fill in", "/student/surveys", "info"),
    ];
  }

  if (req.user.role === "teacher") {
    const tas = await TeacherAssignment.find({ teacher: req.user.id, status: "active" }).select("_id section");
    const taIds = tas.map(t => t._id);
    const today = todayStr(), dayName = WEEKDAYS[(now.getDay() + 6) % 7];
    const [assignments, todaysClasses, markedToday, resultCounts] = await Promise.all([
      Assignment.find({ teacherAssignment: { $in: taIds } }).select("_id"),
      TimetableEntry.find({ teacher: req.user.id, day: dayName }).distinct("teacherAssignment"),
      SubjectAttendance.find({ teacherAssignment: { $in: taIds }, date: today }).distinct("teacherAssignment"),
      CourseResult.find({ teacherAssignment: { $in: taIds } }).distinct("teacherAssignment"),
    ]);
    const ungraded = await Submission.countDocuments({ assignment: { $in: assignments.map(a => a._id) }, gradedAt: null });
    const marked = new Set(markedToday.map(String));
    const risk = tas.length ? await computeRisk(await StudentEnrollment.find({ section: { $in: tas.map(t => t.section) }, status: "active" }).distinct("student")) : new Map();
    items = [
      item("attendance", todaysClasses.filter(t => t && !marked.has(String(t))).length, "class today without attendance|classes today without attendance", "/teacher/myclasses", "danger"),
      item("grading", ungraded, "submission waiting to be graded|submissions waiting to be graded", "/teacher/myclasses"),
      item("gradebook", taIds.length - resultCounts.length, "class with no marks entered yet|classes with no marks entered yet", "/teacher/myclasses", "info"),
      item("at-risk", [...risk.values()].filter(r => r.level === "high").length, "student at high risk in your classes|students at high risk in your classes", "/teacher/success", "danger"),
    ];
  }

  if (req.user.role === "admin") {
    const month = now.toISOString().slice(0, 7);
    const [applications, leaves, claims, tickets, urgent, overdueBooks, drafts, payroll, risk] = await Promise.all([
      Admission.countDocuments({ stage: { $in: ["applied", "under_review"] } }),
      Leave.countDocuments({ status: "pending" }),
      PaymentClaim.countDocuments({ status: "pending" }),
      Ticket.countDocuments({ status: "open" }),
      Ticket.countDocuments({ status: { $in: ["open", "in_progress"] }, priority: { $in: ["urgent", "high"] } }),
      BookIssue.countDocuments({ status: "issued", dueOn: { $lt: now } }),
      CourseResult.distinct("teacherAssignment", { published: false }),
      Payslip.countDocuments({ month }),
      StudentEnrollment.find({ status: "active" }).distinct("student").then(computeRisk),
    ]);
    const high = [...risk.values()].filter(r => r.level === "high").length;
    items = [
      item("claims", claims, "payment claim to verify|payment claims to verify", "/admin/fees", "danger"),
      item("urgent", urgent, "high-priority ticket open|high-priority tickets open", "/admin/helpdesk", "danger"),
      item("at-risk", high, "student at high risk|students at high risk", "/admin/success", "danger"),
      item("applications", applications, "application awaiting review|applications awaiting review", "/admin/admissions"),
      item("leaves", leaves, "student leave request pending|student leave requests pending", "/admin/leaves"),
      item("tickets", tickets, "new helpdesk ticket|new helpdesk tickets", "/admin/helpdesk"),
      item("results", drafts.length, "class result not yet published|class results not yet published", "/admin/results", "info"),
      item("books", overdueBooks, "library book overdue|library books overdue", "/admin/library", "info"),
      item("payroll", now.getDate() >= 25 && payroll === 0 ? 1 : 0, "This month's payroll has not been run|This month's payroll has not been run", "/admin/payroll"),
    ];
  }
  res.json(items.filter(Boolean));
}));

export default router;
