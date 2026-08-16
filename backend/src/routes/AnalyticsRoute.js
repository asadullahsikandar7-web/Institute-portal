import express from "express";
import Student from "../models/studentModel.js";
import Attendance from "../models/attendanceModel.js";
import Grade from "../models/GradeModel.js";
import { authMiddleware, adminOnly } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authMiddleware, adminOnly, async (req, res) => {
  try {
    const students = await Student.find().select("_id name rollNo createdAt");
    const total    = students.length;
    const todayStr = new Date().toISOString().split("T")[0];

    // ── Today's breakdown — THE single source of truth for "today" anywhere
    // in the admin dashboard. Every card that claims to show today's
    // attendance must read from this response, not from client-side state
    // that something else (e.g. the Attendance page's date picker) can
    // silently repoint at a different day. One query, one truth.
    const todayRecords = await Attendance.find({ date: todayStr }).select("status");
    const todayPres  = todayRecords.filter(r => r.status === "present").length;
    const todayLeave = todayRecords.filter(r => r.status === "leave").length;
    const todayAbsent = todayRecords.filter(r => r.status === "absent").length;
    const todayUnmarked = Math.max(total - todayRecords.length, 0);
    const avgAttendance = total ? Math.round(todayPres / total * 100) : 0;

    // ── Weekly attendance (last 7 days, one query instead of seven) ───────
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6);
    const weekStartStr = weekStart.toISOString().split("T")[0];
    const weekRecords = await Attendance.find({ date: { $gte: weekStartStr, $lte: todayStr }, status: "present" }).select("date");
    const weekByDate = {};
    weekRecords.forEach(r => { weekByDate[r.date] = (weekByDate[r.date] || 0) + 1; });
    const weeklyAttendance = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split("T")[0];
      const pct = total ? Math.round((weekByDate[dStr] || 0) / total * 100) : 0;
      weeklyAttendance.push(Math.min(pct, 100));
    }

    // ── Attendance trend vs the same weekday last week ─────────────────────
    const lastWeek = new Date(); lastWeek.setDate(lastWeek.getDate() - 7);
    const lastWeekStr = lastWeek.toISOString().split("T")[0];
    const lastWeekPres = await Attendance.countDocuments({ date: lastWeekStr, status: "present" });
    const lastWeekPct  = total ? Math.round(lastWeekPres / total * 100) : 0;
    const attendanceTrend = avgAttendance - lastWeekPct;

    // ── Grade distribution ─────────────────────────────────────────────────
    const allGrades = await Grade.find().select("studentId subject marks maxMarks");
    const buckets   = { "F":0, "D":0, "C":0, "C+":0, "B":0, "B+":0, "A":0, "A+":0 };
    allGrades.forEach(g => {
      const pct = Math.round(g.marks / g.maxMarks * 100);
      if      (pct >= 95) buckets["A+"]++;
      else if (pct >= 90) buckets["A"]++;
      else if (pct >= 85) buckets["B+"]++;
      else if (pct >= 75) buckets["B"]++;
      else if (pct >= 70) buckets["C+"]++;
      else if (pct >= 65) buckets["C"]++;
      else if (pct >= 60) buckets["D"]++;
      else                buckets["F"]++;
    });
    const gradeDistribution = Object.entries(buckets).map(([label, count]) => ({ label, count }));

    // ── Subject performance ────────────────────────────────────────────────
    const subjectMap = {};
    allGrades.forEach(g => {
      if (!subjectMap[g.subject]) subjectMap[g.subject] = { total: 0, count: 0 };
      subjectMap[g.subject].total += Math.round(g.marks / g.maxMarks * 100);
      subjectMap[g.subject].count++;
    });
    const subjectPerformance = Object.entries(subjectMap).map(([subject, d]) => ({
      subject, avg: Math.round(d.total / d.count),
    })).sort((a, b) => b.avg - a.avg);

    // ── At-risk students (attendance < 75% OR any grade < 60%) ────────────
    // Two aggregations covering EVERY student, replacing the old per-student
    // find() loop (2 queries × up to 50 students) — that version also
    // silently dropped any student past the 50th with no indication to the
    // admin that the list was incomplete.
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyStr = thirtyDaysAgo.toISOString().split("T")[0];

    const attendanceAgg = await Attendance.aggregate([
      { $match: { date: { $gte: thirtyStr } } },
      { $group: {
          _id: "$studentId",
          total: { $sum: 1 },
          present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
      } },
    ]);
    const attMap = new Map(attendanceAgg.map(a => [String(a._id), a]));

    const gradeAgg = await Grade.aggregate([
      { $project: { studentId: 1, subject: 1, pct: { $multiply: [{ $divide: ["$marks", "$maxMarks"] }, 100] } } },
      { $match: { pct: { $lt: 60 } } },
      { $sort: { pct: 1 } },
      { $group: { _id: "$studentId", subject: { $first: "$subject" }, pct: { $first: "$pct" } } },
    ]);
    const gradeMap = new Map(gradeAgg.map(g => [String(g._id), g]));

    const atRiskStudents = [];
    for (const s of students) {
      const key = String(s._id);
      const att = attMap.get(key);
      const attPct = att && att.total ? Math.round(att.present / att.total * 100) : 100;
      const lowGrade = gradeMap.get(key);
      if (attPct < 75) {
        atRiskStudents.push({ name: s.name, rollNo: s.rollNo, attendance: attPct, grade: "—", issue: "Attendance below 75%" });
      } else if (lowGrade) {
        atRiskStudents.push({ name: s.name, rollNo: s.rollNo, attendance: attPct, grade: Math.round(lowGrade.pct) + "%", issue: `Failing ${lowGrade.subject}` });
      }
    }

    // ── Overall grade average ─────────────────────────────────────────────
    const avgPct = allGrades.length
      ? Math.round(allGrades.reduce((s, g) => s + g.marks / g.maxMarks * 100, 0) / allGrades.length)
      : 0;
    const avgGrade = avgPct >= 90 ? "A+" : avgPct >= 85 ? "A" : avgPct >= 80 ? "B+" : avgPct >= 75 ? "B" : avgPct >= 65 ? "C" : "D";
    const passingRate = allGrades.length
      ? Math.round(allGrades.filter(g => g.marks / g.maxMarks >= 0.6).length / allGrades.length * 100)
      : 100;

    // ── Real student growth (was a hardcoded `5` before) ───────────────────
    // % change in new-enrollment rate: students created in the last 30 days
    // vs. the 30 days before that. Zero new students in both windows reads
    // as 0% (not "no data" — there's genuinely nothing to report).
    const sixtyDaysAgo = new Date(); sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const newLast30 = students.filter(s => s.createdAt && new Date(s.createdAt) >= thirtyDaysAgo).length;
    const newPrev30 = students.filter(s => s.createdAt && new Date(s.createdAt) >= sixtyDaysAgo && new Date(s.createdAt) < thirtyDaysAgo).length;
    const studentGrowth = newPrev30 > 0
      ? Math.round((newLast30 - newPrev30) / newPrev30 * 100)
      : (newLast30 > 0 ? 100 : 0);

    res.json({
      avgAttendance,
      attendanceTrend,
      studentGrowth,
      weeklyAttendance,
      today: { present: todayPres, absent: todayAbsent, leave: todayLeave, unmarked: todayUnmarked, total, date: todayStr },
      gradeDistribution,
      subjectPerformance,
      atRiskStudents,
      atRiskCount: atRiskStudents.length,
      avgGrade,
      passingRate,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
export default router;
