import mongoose from "mongoose";
import { getSettings } from "../models/Settings.js";
import { CourseResult, Submission, StudentRecord } from "../models/Erp.js";
import SubjectAttendance from "../models/SubjectAttendance.js";
import StudentEnrollment from "../models/StudentEnrollment.js";
import TeacherAssignment from "../models/TeacherAssignment.js";
import Assignment from "../models/Assignment.js";
import Fee from "../models/FeeModel.js";

// ── Early-warning engine ────────────────────────────────────────────────
// Scores how likely a student is to fail, drop out or default, from five
// signals the system already records. It is a transparent rule-based score
// (every point is traceable to a stated reason), not a black-box model:
// staff have to be able to explain to a parent WHY a student was flagged.
//
//   Attendance   up to 35   below the institute minimum
//   Academics    up to 30   low average and failed courses
//   Fees         up to 20   overdue balance, weighted by how long
//   Coursework   up to 10   share of past-due assignments not handed in
//   Conduct      up to 10   recent major/critical discipline records
//
// 50+ = high risk, 25–49 = watch, below 25 = on track. Nothing is stored:
// the score is recomputed from live data on every request.

const DAY = 86400000;
const clamp01 = (n) => Math.max(0, Math.min(1, n));
const round = (n) => Math.round(n);
export const levelOf = (score) => (score >= 50 ? "high" : score >= 25 ? "medium" : "low");

export async function computeRisk(studentIds) {
  const ids = [...new Set(studentIds.map(String))].map(id => new mongoose.Types.ObjectId(id));
  if (!ids.length) return new Map();
  const settings = await getSettings();
  const minAtt = settings.minAttendancePercent, pass = settings.passingPercent;
  const now = new Date();
  const recentFrom = new Date(now - 21 * DAY).toISOString().slice(0, 10);

  const [attendance, recentAttendance, results, fees, enrollments, records] = await Promise.all([
    SubjectAttendance.aggregate([{ $match: { student: { $in: ids } } }, { $group: { _id: "$student", total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } } } }]),
    SubjectAttendance.aggregate([{ $match: { student: { $in: ids }, date: { $gte: recentFrom } } }, { $group: { _id: "$student", total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } } } }]),
    CourseResult.aggregate([{ $match: { student: { $in: ids } } }, { $group: { _id: "$student", avg: { $avg: "$percentage" }, courses: { $sum: 1 }, failed: { $sum: { $cond: [{ $lt: ["$percentage", pass] }, 1, 0] } } } }]),
    Fee.find({ studentId: { $in: ids }, status: { $ne: "paid" }, dueDate: { $lt: now } }).select("studentId amount discount fine paidAmount status dueDate"),
    StudentEnrollment.find({ student: { $in: ids }, status: "active" }).select("student section academicSession program"),
    StudentRecord.aggregate([{ $match: { student: { $in: ids }, kind: "discipline", severity: { $in: ["major", "critical"] }, date: { $gte: new Date(now - 180 * DAY) } } }, { $group: { _id: "$student", major: { $sum: { $cond: [{ $eq: ["$severity", "major"] }, 1, 0] } }, critical: { $sum: { $cond: [{ $eq: ["$severity", "critical"] }, 1, 0] } } } }]),
  ]);

  // Coursework: past-due assignments per section vs what each student handed in.
  const sectionIds = [...new Set(enrollments.map(e => String(e.section)))];
  const tas = await TeacherAssignment.find({ section: { $in: sectionIds }, status: "active" }).select("section");
  const taSection = new Map(tas.map(t => [String(t._id), String(t.section)]));
  const due = await Assignment.find({ teacherAssignment: { $in: tas.map(t => t._id) }, dueDate: { $lt: now, $gte: new Date(now - 120 * DAY) } }).select("teacherAssignment");
  const dueBySection = new Map();
  for (const a of due) { const s = taSection.get(String(a.teacherAssignment)); dueBySection.set(s, [...(dueBySection.get(s) || []), a._id]); }
  const submitted = due.length
    ? await Submission.aggregate([{ $match: { student: { $in: ids }, assignment: { $in: due.map(a => a._id) } } }, { $group: { _id: "$student", n: { $sum: 1 } } }])
    : [];

  const by = (rows) => new Map(rows.map(r => [String(r._id), r]));
  const att = by(attendance), recent = by(recentAttendance), res = by(results), rec = by(records), sub = by(submitted);
  const sectionOf = new Map(enrollments.map(e => [String(e.student), String(e.section)]));
  const feeBy = new Map();
  for (const f of fees) {
    if (f.balance <= 0) continue;
    const k = String(f.studentId);
    const cur = feeBy.get(k) || { balance: 0, oldest: f.dueDate };
    cur.balance += f.balance;
    if (f.dueDate < cur.oldest) cur.oldest = f.dueDate;
    feeBy.set(k, cur);
  }

  const out = new Map();
  for (const oid of ids) {
    const id = String(oid);
    const reasons = [];
    const metrics = {};
    let score = 0;

    const a = att.get(id);
    if (a?.total >= 5) {
      const rate = (a.present / a.total) * 100;
      metrics.attendance = round(rate);
      const pts = 35 * clamp01((minAtt + 10 - rate) / (minAtt + 10 - 50));
      if (rate < minAtt) reasons.push({ factor: "attendance", points: round(pts), text: `Attendance ${round(rate)}% — below the required ${minAtt}%` });
      else if (pts >= 1) reasons.push({ factor: "attendance", points: round(pts), text: `Attendance ${round(rate)}% — close to the ${minAtt}% minimum` });
      score += pts;
      const r = recent.get(id);
      if (r?.total >= 4) {
        const recentRate = (r.present / r.total) * 100;
        metrics.recentAttendance = round(recentRate);
        if (recentRate < rate - 15) reasons.push({ factor: "attendance", points: 0, text: `Attendance is falling — ${round(recentRate)}% over the last 3 weeks` });
      }
    }

    const g = res.get(id);
    if (g?.courses) {
      metrics.average = round(g.avg);
      metrics.failed = g.failed;
      const pts = Math.min(30, 20 * clamp01((pass + 20 - g.avg) / 30) + g.failed * 6);
      if (g.failed) reasons.push({ factor: "academics", points: round(pts), text: `Failing ${g.failed} of ${g.courses} course${g.courses === 1 ? "" : "s"} (average ${round(g.avg)}%)` });
      else if (pts >= 1) reasons.push({ factor: "academics", points: round(pts), text: `Average ${round(g.avg)}% — within 20 points of the pass mark` });
      score += pts;
    }

    const f = feeBy.get(id);
    if (f) {
      const days = Math.floor((now - f.oldest) / DAY);
      metrics.overdueBalance = f.balance;
      const pts = 10 + 10 * clamp01(days / 60);
      reasons.push({ factor: "fees", points: round(pts), text: `Fee balance of ${Math.round(f.balance).toLocaleString("en-US")} overdue for ${days} day${days === 1 ? "" : "s"}` });
      score += pts;
    }

    const dueCount = (dueBySection.get(sectionOf.get(id)) || []).length;
    if (dueCount >= 2) {
      const missing = Math.max(0, dueCount - (sub.get(id)?.n || 0));
      metrics.missingWork = missing;
      const pts = 10 * (missing / dueCount);
      if (missing > 0 && pts >= 3) reasons.push({ factor: "coursework", points: round(pts), text: `${missing} of ${dueCount} assignments not handed in` });
      score += pts;
    }

    const d = rec.get(id);
    if (d) {
      const pts = Math.min(10, d.major * 5 + d.critical * 10);
      reasons.push({ factor: "conduct", points: round(pts), text: `${d.major + d.critical} serious discipline record${d.major + d.critical === 1 ? "" : "s"} in the last 6 months` });
      score += pts;
    }

    score = Math.min(100, round(score));
    out.set(id, { score, level: levelOf(score), reasons: reasons.sort((x, y) => y.points - x.points), metrics, hasData: !!(a?.total || g?.courses || f || dueCount) });
  }
  return out;
}
