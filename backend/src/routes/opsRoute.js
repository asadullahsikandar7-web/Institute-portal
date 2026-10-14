import express from "express";
import { auth, authAny } from "../middleware/auth.js";
import { h, httpError, scalar } from "../utils/crudRouter.js";
import { adminCan } from "../services/permissions.js";
import { notify } from "../services/notify.js";
import { getSettings } from "../models/Settings.js";
import { Substitution, MeetingSlot } from "../models/Smart.js";
import { CalendarEvent, CourseResult, Staff, StaffLeave, Admission } from "../models/Erp.js";
import Teacher from "../models/Teacher.js";
import Student from "../models/studentModel.js";
import Fee from "../models/FeeModel.js";
import TimetableEntry from "../models/TimetableEntry.js";
import TeacherAssignment from "../models/TeacherAssignment.js";
import StudentEnrollment from "../models/StudentEnrollment.js";
import SubjectAttendance from "../models/SubjectAttendance.js";

// Day-to-day operations: substitute cover for absent teachers,
// parent–teacher meeting booking, and the institutional insights page.
const router = express.Router();
const DAY = 86400000;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const overlaps = (aS, aE, bS, bE) => aS < bE && bS < aE;
const isoDate = (d) => new Date(d).toISOString().slice(0, 10);
const dayName = (date) => WEEKDAYS[new Date(date + "T00:00:00Z").getUTCDay()];
const ENTRY_POPULATE = [{ path: "subject", select: "name code" }, { path: "section", select: "name" }, { path: "program", select: "code" }, { path: "room", select: "name" }, { path: "teacher", select: "name" }];

// ═══════════════════════════ SUBSTITUTE COVER ══════════════════════════════
// For every period the absent teacher would teach between `from` and `to`,
// ranks colleagues who are actually free then: not teaching, not already
// covering, not on approved leave. Same subject and same section count in a
// candidate's favour; a lighter day breaks ties.
async function teachersOnLeave(date) {
  const leaves = await StaffLeave.find({ status: "approved", from: { $lte: new Date(date + "T23:59:59Z") }, to: { $gte: new Date(date + "T00:00:00Z") } }).select("staff");
  const staff = await Staff.find({ _id: { $in: leaves.map(l => l.staff) }, teacher: { $ne: null } }).select("teacher");
  return new Set(staff.map(s => String(s.teacher)));
}

router.get("/substitutions/plan", auth("admin"), h(async (req, res) => {
  const teacherId = scalar(req.query.teacher);
  const from = scalar(req.query.from) || isoDate(new Date());
  const to = scalar(req.query.to) || from;
  if (!teacherId) throw httpError(400, "Choose the teacher who will be away.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) throw httpError(400, "Give a valid date range.");
  const dates = [];
  for (let d = new Date(from + "T00:00:00Z"); isoDate(d) <= to && dates.length < 31; d = new Date(d.getTime() + DAY)) dates.push(isoDate(d));

  const [absentEntries, allEntries, teachers, assignments, holidays] = await Promise.all([
    TimetableEntry.find({ teacher: teacherId }).populate(ENTRY_POPULATE),
    TimetableEntry.find({ teacher: { $ne: null } }).select("teacher day startTime endTime"),
    Teacher.find({ isActive: true, _id: { $ne: teacherId } }).select("name"),
    TeacherAssignment.find({ status: "active" }).select("teacher subject section"),
    CalendarEvent.find({ type: "holiday", start: { $lte: new Date(to + "T23:59:59Z") }, $or: [{ end: null }, { end: { $gte: new Date(from + "T00:00:00Z") } }] }),
  ]);
  const holiday = (date) => holidays.some(hv => isoDate(hv.start) <= date && isoDate(hv.end || hv.start) >= date);
  const teaches = (t, key, value) => assignments.some(a => String(a.teacher) === String(t) && String(a[key]) === String(value));

  const periods = [];
  for (const date of dates) {
    if (holiday(date)) continue;
    const day = dayName(date);
    const todays = absentEntries.filter(e => e.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (!todays.length) continue;
    const [subs, onLeave] = await Promise.all([Substitution.find({ date }).populate("entry", "startTime endTime").populate("substitute", "name"), teachersOnLeave(date)]);
    for (const e of todays) {
      const existing = subs.find(s => String(s.entry?._id) === String(e._id));
      const candidates = teachers.filter(t => {
        const id = String(t._id);
        if (onLeave.has(id)) return false;
        if (allEntries.some(x => String(x.teacher) === id && x.day === day && overlaps(e.startTime, e.endTime, x.startTime, x.endTime))) return false;
        return !subs.some(s => String(s.substitute?._id) === id && s.entry && overlaps(e.startTime, e.endTime, s.entry.startTime, s.entry.endTime));
      }).map(t => {
        const id = String(t._id);
        const sameSubject = teaches(id, "subject", e.subject?._id), sameSection = teaches(id, "section", e.section?._id);
        const load = allEntries.filter(x => String(x.teacher) === id && x.day === day).length + subs.filter(s => String(s.substitute?._id) === id).length;
        const reasons = [sameSubject && "teaches this subject", sameSection && "already teaches this section", `${load} other period${load === 1 ? "" : "s"} that day`].filter(Boolean);
        return { teacher: t, score: (sameSubject ? 3 : 0) + (sameSection ? 2 : 0) - load * 0.5, reasons };
      }).sort((a, b) => b.score - a.score).slice(0, 4);
      periods.push({ date, entry: e, substitution: existing || null, suggestions: candidates });
    }
  }
  res.json({ periods, covered: periods.filter(p => p.substitution).length });
}));

router.post("/substitutions", auth("admin"), h(async (req, res) => {
  const { date, entry: entryId, substitute, reason, note } = req.body;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) throw httpError(400, "Give the date of the cover.");
  const entry = await TimetableEntry.findById(entryId).populate(ENTRY_POPULATE);
  if (!entry) throw httpError(404, "Timetable period not found");
  if (entry.day !== dayName(date)) throw httpError(400, `That period is on ${entry.day}s, not on ${dayName(date)}.`);
  if (!entry.teacher) throw httpError(400, "That period has no teacher to cover for.");
  if (String(substitute) === String(entry.teacher._id)) throw httpError(400, "Choose someone other than the absent teacher.");
  // Re-check freedom now — the plan may be minutes old.
  const [clash, covering, onLeave] = await Promise.all([
    TimetableEntry.find({ teacher: substitute, day: entry.day }).select("startTime endTime"),
    Substitution.find({ date, substitute, entry: { $ne: entry._id } }).populate("entry", "startTime endTime"),
    teachersOnLeave(date),
  ]);
  if (onLeave.has(String(substitute))) throw httpError(409, "That teacher is on approved leave that day.");
  if (clash.some(x => overlaps(entry.startTime, entry.endTime, x.startTime, x.endTime))) throw httpError(409, "That teacher has their own class at that time.");
  if (covering.some(s => s.entry && overlaps(entry.startTime, entry.endTime, s.entry.startTime, s.entry.endTime))) throw httpError(409, "That teacher is already covering another class at that time.");
  const doc = await Substitution.findOneAndUpdate({ date, entry: entry._id }, { date, entry: entry._id, absentTeacher: entry.teacher._id, substitute, reason: reason || "", note: note || "", arrangedBy: req.user.email || "Admin" }, { new: true, upsert: true, runValidators: true });
  await notify("teacher", substitute, { title: `Cover: ${entry.subject?.name} on ${date}`, message: `Please take ${entry.subject?.name} for ${entry.program?.code || ""} ${entry.section?.name || ""} in ${entry.room?.name || "the usual room"}, ${entry.startTime}–${entry.endTime}, on ${date}.${note ? ` Note: ${note}` : ""}`, type: "alert", actionUrl: "/teacher/schedule", priority: "high" });
  res.status(201).json(await doc.populate([{ path: "substitute", select: "name" }, { path: "entry", populate: ENTRY_POPULATE }]));
}));

router.delete("/substitutions/:id", auth("admin"), h(async (req, res) => {
  const doc = await Substitution.findByIdAndDelete(req.params.id);
  if (!doc) throw httpError(404, "Not found");
  res.json({ message: "Cover removed" });
}));

router.get("/substitutions", auth("admin"), h(async (req, res) => {
  const from = scalar(req.query.from) || isoDate(new Date());
  res.json(await Substitution.find({ date: { $gte: from } }).sort({ date: 1 }).limit(200)
    .populate("substitute", "name").populate("absentTeacher", "name").populate({ path: "entry", populate: ENTRY_POPULATE }));
}));

// The covers a teacher has been asked to take.
router.get("/substitutions/mine", auth("teacher"), h(async (req, res) => {
  res.json(await Substitution.find({ substitute: req.user.id, date: { $gte: isoDate(new Date()) } }).sort({ date: 1 })
    .populate("absentTeacher", "name").populate({ path: "entry", populate: ENTRY_POPULATE }));
}));

// ═══════════════════════════ PARENT–TEACHER MEETINGS ═══════════════════════
const SLOT_POPULATE = [{ path: "teacher", select: "name" }, { path: "parent", select: "name phone email" }, { path: "student", select: "name rollNo" }];

// Teacher publishes a block of slots, e.g. Thursday 14:00–16:00 in
// 15-minute meetings. `start`/`end` are full timestamps built in the
// teacher's browser, so the times mean the same thing wherever the server runs.
router.post("/meetings/slots", auth("teacher"), h(async (req, res) => {
  const { minutes = 15, mode = "in_person", location = "" } = req.body;
  const start = new Date(req.body.start), end = new Date(req.body.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) throw httpError(400, "Give a date and a start time before the end time.");
  if (start < new Date()) throw httpError(400, "Slots must be in the future.");
  if (end - start > 10 * 3600000) throw httpError(400, "Publish at most ten hours of slots at a time.");
  const len = Math.max(5, Math.min(60, Number(minutes) || 15));
  const wanted = [];
  for (let t = start.getTime(); t + len * 60000 <= end.getTime(); t += len * 60000) wanted.push(new Date(t));
  if (!wanted.length) throw httpError(400, "That window is shorter than one meeting.");
  const taken = new Set((await MeetingSlot.find({ teacher: req.user.id, start: { $in: wanted } }).select("start")).map(s => s.start.getTime()));
  const fresh = wanted.filter(t => !taken.has(t.getTime())).map(t => ({ teacher: req.user.id, start: t, end: new Date(t.getTime() + len * 60000), mode, location }));
  if (fresh.length) await MeetingSlot.insertMany(fresh);
  res.status(201).json({ created: fresh.length, skipped: wanted.length - fresh.length });
}));

router.get("/meetings/mine", auth("teacher"), h(async (req, res) => {
  res.json(await MeetingSlot.find({ teacher: req.user.id, start: { $gte: new Date(Date.now() - 7 * DAY) }, status: { $ne: "cancelled" } }).populate(SLOT_POPULATE).sort({ start: 1 }).limit(300));
}));

router.patch("/meetings/:id", auth("teacher"), h(async (req, res) => {
  const slot = await MeetingSlot.findOne({ _id: req.params.id, teacher: req.user.id });
  if (!slot) throw httpError(404, "Not found");
  const { status, outcome } = req.body;
  if (status === "cancelled" && slot.parent) {
    await notify("parent", slot.parent, { title: "Meeting cancelled", message: `Your meeting on ${slot.start.toLocaleString("en-US")} was cancelled by the teacher. Please book another slot.`, type: "notice", actionUrl: "/parent/meetings", priority: "high" });
  }
  if (status !== undefined) {
    if (!["cancelled", "done", "open"].includes(status)) throw httpError(400, "Unknown status");
    slot.status = status;
  }
  if (outcome !== undefined) slot.outcome = String(outcome).slice(0, 2000);
  await slot.save();
  res.json(await slot.populate(SLOT_POPULATE));
}));

async function myChildren(parentId) {
  const kids = await Student.find({ parentId }).select("name rollNo");
  const enrollments = await StudentEnrollment.find({ student: { $in: kids.map(k => k._id) }, status: "active" }).select("student section");
  return kids.map(k => ({ child: k, section: enrollments.find(e => String(e.student) === String(k._id))?.section || null }));
}

// Open slots with the teachers of the parent's own children.
router.get("/meetings/available", auth("parent"), h(async (req, res) => {
  const kids = await myChildren(req.user.id);
  const out = [];
  for (const { child, section } of kids) {
    if (!section) continue;
    const tas = await TeacherAssignment.find({ section, status: "active" }).populate("teacher", "name").populate("subject", "name");
    const slots = await MeetingSlot.find({ teacher: { $in: tas.map(t => t.teacher?._id) }, status: "open", start: { $gt: new Date() } }).sort({ start: 1 }).limit(200);
    out.push({ child, teachers: tas.filter(t => t.teacher).map(t => ({ teacher: t.teacher, subject: t.subject, slots: slots.filter(s => String(s.teacher) === String(t.teacher._id)) })) });
  }
  res.json(out);
}));

router.get("/meetings/booked", auth("parent"), h(async (req, res) => {
  res.json(await MeetingSlot.find({ parent: req.user.id, status: { $in: ["booked", "done"] } }).populate(SLOT_POPULATE).sort({ start: -1 }).limit(50));
}));

router.post("/meetings/:id/book", auth("parent"), h(async (req, res) => {
  const kids = await myChildren(req.user.id);
  const kid = kids.find(k => String(k.child._id) === String(req.body.student));
  if (!kid?.section) throw httpError(404, "Student not found");
  const slot = await MeetingSlot.findById(req.params.id);
  if (!slot) throw httpError(404, "Slot not found");
  if (!(await TeacherAssignment.exists({ teacher: slot.teacher, section: kid.section, status: "active" }))) throw httpError(403, "This teacher doesn't teach your child.");
  if (await MeetingSlot.exists({ parent: req.user.id, teacher: slot.teacher, status: "booked", start: { $gt: new Date() } })) throw httpError(409, "You already have an upcoming meeting with this teacher.");
  // Conditional update: two parents clicking the same slot can't both win.
  const booked = await MeetingSlot.findOneAndUpdate({ _id: slot._id, status: "open", start: { $gt: new Date() } },
    { status: "booked", parent: req.user.id, student: kid.child._id, agenda: String(req.body.agenda || "").slice(0, 500) }, { new: true }).populate(SLOT_POPULATE);
  if (!booked) throw httpError(409, "Sorry — that slot was just taken. Please pick another.");
  await notify("teacher", booked.teacher._id, { title: `Meeting booked: ${booked.parent.name}`, message: `Parent of ${booked.student.name}, ${booked.start.toLocaleString("en-US")}.${booked.agenda ? ` Agenda: ${booked.agenda}` : ""}`, type: "notice", actionUrl: "/teacher/meetings" });
  res.json(booked);
}));

router.post("/meetings/:id/cancel", auth("parent"), h(async (req, res) => {
  const slot = await MeetingSlot.findOneAndUpdate({ _id: req.params.id, parent: req.user.id, status: "booked", start: { $gt: new Date() } },
    { status: "open", parent: null, student: null, agenda: "" }, { new: true });
  if (!slot) throw httpError(404, "Booking not found");
  await notify("teacher", slot.teacher, { title: "Meeting cancelled by parent", message: `The ${slot.start.toLocaleString("en-US")} slot is open again.`, type: "notice", actionUrl: "/teacher/meetings" });
  res.json({ cancelled: true });
}));

// ═══════════════════════════ INSIGHTS ══════════════════════════════════════
router.get("/insights", auth("admin"), h(async (req, res) => {
  const settings = await getSettings();
  const pass = settings.passingPercent;
  const since = isoDate(new Date(Date.now() - 56 * DAY));
  const [byProgram, grades, subjects, weekday, weekly, funnel] = await Promise.all([
    StudentEnrollment.aggregate([{ $match: { status: "active" } }, { $group: { _id: "$program", n: { $sum: 1 } } }, { $lookup: { from: "programs", localField: "_id", foreignField: "_id", as: "p" } }, { $project: { n: 1, name: { $first: "$p.name" } } }, { $sort: { n: -1 } }]),
    CourseResult.aggregate([{ $group: { _id: "$grade", n: { $sum: 1 } } }]),
    CourseResult.aggregate([{ $group: { _id: "$subject", avg: { $avg: "$percentage" }, n: { $sum: 1 }, passed: { $sum: { $cond: [{ $gte: ["$percentage", pass] }, 1, 0] } } } }, { $lookup: { from: "subjects", localField: "_id", foreignField: "_id", as: "s" } }, { $project: { avg: 1, n: 1, passed: 1, name: { $first: "$s.name" } } }, { $sort: { avg: 1 } }]),
    SubjectAttendance.aggregate([{ $match: { date: { $gte: since } } }, { $group: { _id: { $dayOfWeek: { $dateFromString: { dateString: "$date" } } }, total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } } } }, { $sort: { _id: 1 } }]),
    SubjectAttendance.aggregate([{ $match: { date: { $gte: since } } }, { $group: { _id: { $isoWeek: { $dateFromString: { dateString: "$date" } } }, start: { $min: "$date" }, total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } } } }, { $sort: { start: 1 } }]),
    Admission.aggregate([{ $group: { _id: "$stage", n: { $sum: 1 } } }]),
  ]);

  // Fee forecast for the current month: what is already in, plus what is
  // still due this month weighted by how reliably fees have been paid so far.
  let forecast = null;
  if (adminCan(req.user, "finance")) {
    const now = new Date(), monthStart = new Date(now.getFullYear(), now.getMonth(), 1), monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const fees = await Fee.find({ dueDate: { $lt: monthEnd } }).select("amount discount fine paidAmount status dueDate payments");
    const past = fees.filter(f => f.dueDate < monthStart);
    const pastBilled = past.reduce((s, f) => s + f.netAmount, 0), pastPaid = past.reduce((s, f) => s + f.netAmount - f.balance, 0);
    const rate = pastBilled ? pastPaid / pastBilled : 0.8;
    const collected = fees.reduce((s, f) => s + f.payments.filter(p => p.paidOn >= monthStart).reduce((t, p) => t + p.amount, 0), 0);
    const stillDue = fees.filter(f => f.dueDate >= now).reduce((s, f) => s + f.balance, 0);
    forecast = { collectedSoFar: Math.round(collected), stillDueThisMonth: Math.round(stillDue), historicalCollectionRate: Math.round(rate * 100), projectedMonthTotal: Math.round(collected + stillDue * rate) };
  }

  const order = settings.gradingScheme.map(g => g.grade);
  res.json({
    enrollmentByProgram: byProgram.map(p => ({ label: p.name || "—", value: p.n })),
    gradeDistribution: order.map(g => ({ label: g, value: grades.find(x => x._id === g)?.n || 0 })),
    subjectPerformance: subjects.map(s => ({ label: s.name || "—", average: Math.round(s.avg * 10) / 10, passRate: Math.round((s.passed / s.n) * 100), results: s.n })),
    attendanceByWeekday: weekday.map(d => ({ label: WEEKDAYS[d._id - 1].slice(0, 3), value: Math.round((d.present / d.total) * 100), records: d.total })),
    attendanceTrend: weekly.map(w => ({ label: w.start.slice(5), value: Math.round((w.present / w.total) * 100), records: w.total })),
    admissionsFunnel: ["applied", "under_review", "test_scheduled", "interview", "offered", "accepted", "enrolled"].map(s => ({ label: s, value: funnel.find(f => f._id === s)?.n || 0 })),
    feeForecast: forecast,
    minAttendancePercent: settings.minAttendancePercent,
  });
}));

export default router;
