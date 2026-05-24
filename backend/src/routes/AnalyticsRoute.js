import express from "express";
import Student from "../models/studentModel.js";
import Attendance from "../models/attendanceModel.js";
import { authMiddleware, adminOnly } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authMiddleware, adminOnly, async (req, res) => {
  try {
    const students = await Student.find();
    const total    = students.length;

    // ── Weekly attendance (last 7 Mondays as weekly aggregates) ──────────────
    const weeklyAttendance = [];
    for (let w = 6; w >= 0; w--) {
      const from = new Date(); from.setDate(from.getDate() - w * 7 - 6);
      const to   = new Date(); to.setDate(to.getDate()   - w * 7);
      const recs = await Attendance.find({
        date:   { $gte: from.toISOString().split("T")[0], $lte: to.toISOString().split("T")[0] },
        status: "present",
      });
      const pct = total ? Math.round(recs.length / (total * 7) * 100) : 0;
      weeklyAttendance.push(Math.min(pct, 100));
    }

    // ── Today's attendance rate ────────────────────────────────────────────────
    const todayStr = new Date().toISOString().split("T")[0];
    const todayPres = await Attendance.countDocuments({ date: todayStr, status: "present" });
    const avgAttendance = total ? Math.round(todayPres / total * 100) : 0;

    // ── Attendance trend vs last week ─────────────────────────────────────────
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 7);
    const lastWeekStr = yesterday.toISOString().split("T")[0];
    const lastWeekPres = await Attendance.countDocuments({ date: lastWeekStr, status: "present" });
    const lastWeekPct  = total ? Math.round(lastWeekPres / total * 100) : 0;
    const attendanceTrend = avgAttendance - lastWeekPct;

    // ── Grade distribution ─────────────────────────────────────────────────────
    const allGrades = await Grade.find();
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

    // ── Subject performance ────────────────────────────────────────────────────
    const subjectMap = {};
    allGrades.forEach(g => {
      if (!subjectMap[g.subject]) subjectMap[g.subject] = { total: 0, count: 0 };
      subjectMap[g.subject].total += Math.round(g.marks / g.maxMarks * 100);
      subjectMap[g.subject].count++;
    });
    const subjectPerformance = Object.entries(subjectMap).map(([subject, d]) => ({
      subject, avg: Math.round(d.total / d.count),
    })).sort((a, b) => b.avg - a.avg);

    // ── At-risk students (attendance < 75% OR any grade < 60%) ────────────────
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyStr = thirtyDaysAgo.toISOString().split("T")[0];
    const atRiskStudents = [];

    for (const s of students.slice(0, 50)) { // limit for perf
      const sid  = s._id;
      const recs = await Attendance.find({ studentId: sid, date: { $gte: thirtyStr } });
      const pres = recs.filter(r => r.status === "present").length;
      const attPct = recs.length ? Math.round(pres / recs.length * 100) : 100;
      const grades = await Grade.find({ studentId: sid });
      const lowGrade = grades.find(g => Math.round(g.marks / g.maxMarks * 100) < 60);

      if (attPct < 75) {
        atRiskStudents.push({ name: s.name, rollNo: s.rollNo, attendance: attPct, grade: "—", issue: "Attendance below 75%" });
      } else if (lowGrade) {
        const pct = Math.round(lowGrade.marks / lowGrade.maxMarks * 100);
        atRiskStudents.push({ name: s.name, rollNo: s.rollNo, attendance: attPct, grade: pct+"%", issue: `Failing ${lowGrade.subject}` });
      }
    }

    // ── Overall grade average ─────────────────────────────────────────────────
    const avgPct = allGrades.length
      ? Math.round(allGrades.reduce((s, g) => s + g.marks / g.maxMarks * 100, 0) / allGrades.length)
      : 0;
    const avgGrade = avgPct >= 90 ? "A+" : avgPct >= 85 ? "A" : avgPct >= 80 ? "B+" : avgPct >= 75 ? "B" : avgPct >= 65 ? "C" : "D";
    const passingRate = allGrades.length
      ? Math.round(allGrades.filter(g => g.marks / g.maxMarks >= 0.6).length / allGrades.length * 100)
      : 100;

    res.json({
      avgAttendance,
      attendanceTrend,
      studentGrowth: 5,
      weeklyAttendance,
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