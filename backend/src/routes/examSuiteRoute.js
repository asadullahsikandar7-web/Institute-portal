import express from "express";
import { auth } from "../middleware/auth.js";
import { h, httpError, crudRouter } from "../utils/crudRouter.js";
import { planExams, validSlots } from "../services/planner.js";
import { notifyStudents } from "../services/notify.js";
import { getSettings } from "../models/Settings.js";
import { ExamSession, ExamPaper } from "../models/Smart.js";
import { CalendarEvent } from "../models/Erp.js";
import Room from "../models/Room.js";
import Teacher from "../models/Teacher.js";
import Fee from "../models/FeeModel.js";
import TeacherAssignment from "../models/TeacherAssignment.js";
import StudentEnrollment from "../models/StudentEnrollment.js";
import SubjectAttendance from "../models/SubjectAttendance.js";

// Examination suite: an exam session (e.g. "Midterm — Fall 2026") gets a
// generated, clash-free datesheet with rooms, invigilators and seat
// numbers; students get a datesheet and an admit card whose eligibility
// (attendance, fee clearance) is checked live.
const router = express.Router();

const PAPER_POPULATE = [
  { path: "subject", select: "name code" }, { path: "section", select: "name" }, { path: "program", select: "name code" },
  { path: "room", select: "name building capacity" }, { path: "invigilator", select: "name" },
];
const iso = (d) => new Date(d).toISOString().slice(0, 10);

async function examDates(session) {
  const holidays = await CalendarEvent.find({ type: "holiday", start: { $lte: session.endDate }, $or: [{ end: null }, { end: { $gte: session.startDate } }] });
  const off = new Set();
  for (const hEv of holidays) {
    for (let d = new Date(hEv.start), n = 0; d <= (hEv.end || hEv.start) && n < 60; d = new Date(d.getTime() + 86400000), n++) off.add(iso(d));
  }
  const dates = [];
  for (let d = new Date(session.startDate), n = 0; d <= session.endDate && n < 90; d = new Date(d.getTime() + 86400000), n++) {
    if (d.getUTCDay() === 0 || off.has(iso(d))) continue; // Sundays and declared holidays
    dates.push(iso(d));
  }
  return dates;
}

// ═══════════════════════════ ADMIN ═════════════════════════════════════════
// Builds (or rebuilds) the datesheet. Papers already scheduled are kept
// unless `replace` is set, so a later run only fills in classes that were
// added since.
router.post("/sessions/:id/generate", auth("admin"), h(async (req, res) => {
  const session = await ExamSession.findById(req.params.id);
  if (!session) throw httpError(404, "Exam session not found");
  if (session.status !== "draft") throw httpError(409, "This datesheet is published. Move it back to draft before regenerating.");
  if (!validSlots(session.slots)) throw httpError(400, "The exam's daily slots are invalid or overlap.");

  if (req.body.replace) await ExamPaper.deleteMany({ examSession: session._id });
  const [assignments, rooms, existing, dates] = await Promise.all([
    TeacherAssignment.find({ academicSession: session.academicSession, status: "active" }).populate("subject", "name code"),
    Room.find({ status: "active" }),
    ExamPaper.find({ examSession: session._id }),
    examDates(session),
  ]);
  if (!assignments.length) throw httpError(400, "There are no active classes in this academic session to schedule.");
  if (!rooms.length) throw httpError(400, "Add at least one room under Rooms & Facilities first.");
  if (!dates.length) throw httpError(400, "The exam window contains no working days.");

  const enrollments = await StudentEnrollment.find({ section: { $in: assignments.map(a => a.section) }, status: "active" }).populate("student", "rollNo");
  const roster = new Map();
  for (const e of enrollments) if (e.student) roster.set(String(e.section), [...(roster.get(String(e.section)) || []), e.student]);

  const done = new Set(existing.map(p => String(p.teacherAssignment)));
  const papers = assignments.filter(a => !done.has(String(a._id)) && (roster.get(String(a.section)) || []).length > 0)
    .map(a => ({ _id: a._id, section: a.section, subject: a.subject._id, program: a.program, teacher: a.teacher, size: roster.get(String(a.section)).length, subjectName: a.subject.name }));
  const invigilators = await Teacher.find({ isActive: true }).distinct("_id");
  const { placed, unplaced } = planExams({ papers, rooms, dates, slots: session.slots, existing, invigilators });

  if (placed.length) {
    await ExamPaper.insertMany(placed.map(p => ({
      examSession: session._id, teacherAssignment: p.paper._id, subject: p.paper.subject, section: p.paper.section, program: p.paper.program,
      date: p.date, startTime: p.startTime, endTime: p.endTime, room: p.room._id, invigilator: p.invigilator || null,
      seats: [...roster.get(String(p.paper.section))].sort((a, b) => a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true })).map((s, i) => ({ student: s._id, seatNo: i + 1 })),
    })));
  }
  res.status(201).json({
    scheduled: placed.length, kept: existing.length, days: dates.length,
    skippedEmpty: assignments.length - done.size - papers.length,
    unplaced: unplaced.map(u => ({ subject: u.paper.subjectName, reason: u.reason })),
  });
}));

router.get("/sessions/:id/papers", auth("admin"), h(async (req, res) => {
  const papers = await ExamPaper.find({ examSession: req.params.id }).populate(PAPER_POPULATE).populate("seats.student", "name rollNo").sort({ date: 1, startTime: 1 });
  res.json(papers);
}));

// Manual move of one paper — re-checked against the same hard rules the
// generator enforces.
router.patch("/papers/:id", auth("admin"), h(async (req, res) => {
  const paper = await ExamPaper.findById(req.params.id);
  if (!paper) throw httpError(404, "Paper not found");
  for (const k of ["date", "startTime", "endTime", "room", "invigilator"]) if (req.body[k] !== undefined) paper[k] = req.body[k] || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paper.date || "") || !(paper.startTime < paper.endTime)) throw httpError(400, "Give a valid date and a start time before the end time.");
  const others = await ExamPaper.find({ examSession: paper.examSession, date: paper.date, _id: { $ne: paper._id } });
  const hit = others.filter(o => o.startTime < paper.endTime && paper.startTime < o.endTime);
  if (hit.some(o => String(o.section) === String(paper.section))) throw httpError(409, "This section already has another paper at that time.");
  if (paper.room && hit.some(o => String(o.room) === String(paper.room))) throw httpError(409, "That room is already hosting another paper at that time.");
  if (paper.invigilator && hit.some(o => String(o.invigilator) === String(paper.invigilator))) throw httpError(409, "That invigilator is already on duty at that time.");
  await paper.save();
  res.json(await paper.populate(PAPER_POPULATE));
}));

router.post("/sessions/:id/status", auth("admin"), h(async (req, res) => {
  const { status } = req.body;
  if (!["draft", "published", "completed"].includes(status)) throw httpError(400, "Unknown status");
  const session = await ExamSession.findById(req.params.id);
  if (!session) throw httpError(404, "Exam session not found");
  const papers = await ExamPaper.find({ examSession: session._id }).select("seats");
  if (status === "published" && !papers.length) throw httpError(400, "Generate the datesheet before publishing it.");
  const first = status === "published" && session.status === "draft";
  session.status = status;
  await session.save();
  if (first) {
    const students = papers.flatMap(p => p.seats.map(s => s.student));
    await notifyStudents(students, { title: `${session.name} datesheet published`, message: "Your exam schedule, room and seat numbers are available. Check that you are eligible for your admit card.", type: "exam", actionUrl: "/student/exams", priority: "high" });
  }
  res.json(session);
}));

// ═══════════════════════════ STUDENT ═══════════════════════════════════════
// Eligibility is decided here, at the moment the student looks — so paying
// an overdue fee or an attendance correction unlocks the admit card
// immediately, with nobody having to "re-issue" anything.
export async function studentExams(studentId) {
  const enrollment = await StudentEnrollment.findOne({ student: studentId, status: "active" });
  if (!enrollment) return [];
  const sessions = await ExamSession.find({ academicSession: enrollment.academicSession, status: { $in: ["published", "completed"] } }).sort({ startDate: -1 });
  if (!sessions.length) return [];
  const [papers, settings, attendance, overdue] = await Promise.all([
    ExamPaper.find({ examSession: { $in: sessions.map(s => s._id) }, section: enrollment.section }).populate(PAPER_POPULATE).sort({ date: 1, startTime: 1 }),
    getSettings(),
    SubjectAttendance.aggregate([{ $match: { student: enrollment.student } }, { $group: { _id: "$teacherAssignment", total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } } } }]),
    Fee.find({ studentId, status: { $ne: "paid" }, dueDate: { $lt: new Date() } }).select("amount discount fine paidAmount status"),
  ]);
  const att = new Map(attendance.map(a => [String(a._id), a]));
  const feeDue = overdue.reduce((s, f) => s + f.balance, 0);

  return sessions.map(session => {
    const mine = papers.filter(p => String(p.examSession) === String(session._id)).map(p => {
      const a = att.get(String(p.teacherAssignment));
      const rate = a?.total ? Math.round((a.present / a.total) * 100) : null;
      const short = session.requireAttendance && rate != null && rate < settings.minAttendancePercent;
      return {
        _id: p._id, subject: p.subject, date: p.date, startTime: p.startTime, endTime: p.endTime, room: p.room, invigilator: p.invigilator,
        seatNo: p.seats.find(s => String(s.student) === String(studentId))?.seatNo ?? null,
        attendance: rate, eligible: !short,
        reason: short ? `Attendance ${rate}% is below the required ${settings.minAttendancePercent}%` : null,
      };
    });
    const feeBlocked = session.requireFeeClearance && feeDue > 0;
    return {
      session: { _id: session._id, name: session.name, kind: session.kind, startDate: session.startDate, endDate: session.endDate, instructions: session.instructions, status: session.status },
      papers: mine,
      admitCard: { allowed: !feeBlocked && mine.some(p => p.eligible), feeBlocked, feeDue, barredPapers: mine.filter(p => !p.eligible).length },
    };
  }).filter(s => s.papers.length);
}

router.get("/mine", auth("student"), h(async (req, res) => {
  res.json(await studentExams(req.user.id));
}));

// Teacher: papers for my classes plus any invigilation duty.
router.get("/teaching", auth("teacher"), h(async (req, res) => {
  const mine = await TeacherAssignment.find({ teacher: req.user.id, status: "active" }).select("_id");
  const sessions = await ExamSession.find({ status: "published" }).select("name");
  const papers = await ExamPaper.find({ examSession: { $in: sessions.map(s => s._id) }, $or: [{ teacherAssignment: { $in: mine.map(m => m._id) } }, { invigilator: req.user.id }] })
    .populate(PAPER_POPULATE).populate("examSession", "name").sort({ date: 1, startTime: 1 });
  res.json(papers.map(p => ({ ...p.toObject(), seats: undefined, students: p.seats.length, invigilating: String(p.invigilator?._id) === String(req.user.id) })));
}));

router.use("/sessions", crudRouter(ExamSession, {
  fields: ["name", "kind", "academicSession", "startDate", "endDate", "slots", "requireAttendance", "requireFeeClearance", "instructions"],
  populate: [{ path: "academicSession", select: "name" }], filters: ["status", "academicSession", "kind"], sort: { startDate: -1 },
  beforeCreate: (d) => {
    if (new Date(d.endDate) < new Date(d.startDate)) throw httpError(400, "The end date is before the start date.");
    if (d.slots && !validSlots(d.slots)) throw httpError(400, "Daily slots must not overlap, and each must end after it starts.");
  },
  beforeUpdate: (d, req, doc) => {
    if (new Date(d.endDate ?? doc.endDate) < new Date(d.startDate ?? doc.startDate)) throw httpError(400, "The end date is before the start date.");
    if (d.slots && !validSlots(d.slots)) throw httpError(400, "Daily slots must not overlap, and each must end after it starts.");
  },
  beforeDelete: async (doc) => {
    if (doc.status !== "draft") throw httpError(409, "Only a draft exam session can be deleted.");
    await ExamPaper.deleteMany({ examSession: doc._id });
  },
}));

export default router;
