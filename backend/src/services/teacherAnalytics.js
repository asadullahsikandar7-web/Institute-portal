// Shared by GET /api/teacher/analytics (teacherPortalRoute.js) and the AI
// tool getMyTeachingAnalytics (aiTools.js) — one computation, scoped
// entirely to TeacherAssignment rows owned by the given teacherId, never
// schoolwide. Keeping this in one place means the UI chart and whatever the
// AI says about "my performance" can never silently drift apart.
import TeacherAssignment from "../models/TeacherAssignment.js";
import StudentEnrollment from "../models/StudentEnrollment.js";
import SubjectAttendance from "../models/SubjectAttendance.js";
import Grade from "../models/GradeModel.js";

const ASSIGN_POPULATE = [
  { path: "academicSession", select: "name status" },
  { path: "program", select: "name code" },
  { path: "section", select: "name code" },
  { path: "subject", select: "name code" },
];

export async function computeTeacherAnalytics(teacherId) {
  const assignments = await TeacherAssignment.find({ teacher: teacherId, status: "active" }).populate(ASSIGN_POPULATE);
  if (assignments.length === 0) {
    return {
      overall: { avgAttendance: 0, avgGradePct: 0, avgGrade: "—", passingRate: 0, classCount: 0, studentCount: 0 },
      weeklyAttendance: [], classPerformance: [], subjectPerformance: [], gradeDistribution: [],
    };
  }

  const taIds = assignments.map(a => a._id);
  const sectionIds = [...new Set(assignments.map(a => a.section._id.toString()))];

  const enrollments = await StudentEnrollment.find({ section: { $in: sectionIds }, status: "active" }).select("student section");
  const rosterBySection = new Map();
  enrollments.forEach(e => {
    const key = e.section.toString();
    if (!rosterBySection.has(key)) rosterBySection.set(key, []);
    rosterBySection.get(key).push(e.student.toString());
  });
  const allStudentIds = [...new Set(enrollments.map(e => e.student.toString()))];

  const attRecords = await SubjectAttendance.find({ teacherAssignment: { $in: taIds } }).select("teacherAssignment status date");

  // Grade is still the legacy free-text-subject model (see TeacherResultsPage) —
  // match on subject *name*, the same way grade entry does.
  const subjectNames = [...new Set(assignments.map(a => a.subject.name))];
  const grades = await Grade.find({ studentId: { $in: allStudentIds }, subject: { $in: subjectNames } }).select("studentId subject marks maxMarks examName date");

  // ── Per-class performance (one row per TeacherAssignment) ──────────────
  const classPerformance = assignments.map(ta => {
    const roster = rosterBySection.get(ta.section._id.toString()) || [];
    const taAtt = attRecords.filter(r => r.teacherAssignment.toString() === ta._id.toString());
    const present = taAtt.filter(r => r.status === "present").length;
    const avgAttendance = taAtt.length ? Math.round(present / taAtt.length * 100) : 0;
    const taGrades = grades.filter(g => g.subject === ta.subject.name && roster.includes(g.studentId.toString()));
    const avgGradePct = taGrades.length ? Math.round(taGrades.reduce((s, g) => s + g.marks / g.maxMarks * 100, 0) / taGrades.length) : 0;
    return {
      id: ta._id,
      label: `${ta.subject.name} · ${ta.program.name} ${ta.section.name}`,
      subject: ta.subject.name,
      avgAttendance,
      avgGradePct,
      studentCount: roster.length,
    };
  });

  // ── Subject performance — grouped across sections when the same subject
  // is taught to more than one class ─────────────────────────────────────
  const subjMap = {};
  classPerformance.forEach(c => {
    if (!c.avgGradePct) return;
    if (!subjMap[c.subject]) subjMap[c.subject] = { totalPct: 0, count: 0 };
    subjMap[c.subject].totalPct += c.avgGradePct;
    subjMap[c.subject].count++;
  });
  const subjectPerformance = Object.entries(subjMap)
    .map(([subject, d]) => ({ subject, avg: Math.round(d.totalPct / d.count) }))
    .sort((a, b) => b.avg - a.avg);

  // ── Grade distribution across every grade this teacher has entered ─────
  const buckets = { "F": 0, "D": 0, "C": 0, "C+": 0, "B": 0, "B+": 0, "A": 0, "A+": 0 };
  grades.forEach(g => {
    const pct = Math.round(g.marks / g.maxMarks * 100);
    if (pct >= 95) buckets["A+"]++;
    else if (pct >= 90) buckets["A"]++;
    else if (pct >= 85) buckets["B+"]++;
    else if (pct >= 75) buckets["B"]++;
    else if (pct >= 70) buckets["C+"]++;
    else if (pct >= 65) buckets["C"]++;
    else if (pct >= 60) buckets["D"]++;
    else buckets["F"]++;
  });
  const gradeDistribution = Object.entries(buckets).map(([label, count]) => ({ label, count }));

  // ── Weekly attendance trend across all this teacher's classes. Denominator
  // is total roster *slots* (a student taking two of this teacher's subjects
  // counts twice, matching how attendance is actually marked per-class) ────
  const totalRosterSlots = classPerformance.reduce((s, c) => s + c.studentCount, 0);
  const weeklyAttendance = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dStr = d.toISOString().split("T")[0];
    const presentThatDay = attRecords.filter(r => r.date === dStr && r.status === "present").length;
    weeklyAttendance.push(totalRosterSlots ? Math.min(Math.round(presentThatDay / totalRosterSlots * 100), 100) : 0);
  }

  // ── Overall summary ─────────────────────────────────────────────────────
  const avgAttendance = classPerformance.length ? Math.round(classPerformance.reduce((s, c) => s + c.avgAttendance, 0) / classPerformance.length) : 0;
  const avgGradePct = grades.length ? Math.round(grades.reduce((s, g) => s + g.marks / g.maxMarks * 100, 0) / grades.length) : 0;
  const avgGrade = avgGradePct >= 90 ? "A+" : avgGradePct >= 85 ? "A" : avgGradePct >= 80 ? "B+" : avgGradePct >= 75 ? "B" : avgGradePct >= 65 ? "C" : avgGradePct > 0 ? "D" : "—";
  const passingRate = grades.length ? Math.round(grades.filter(g => g.marks / g.maxMarks >= 0.6).length / grades.length * 100) : 0;

  return {
    overall: { avgAttendance, avgGradePct, avgGrade, passingRate, classCount: assignments.length, studentCount: allStudentIds.length },
    weeklyAttendance,
    classPerformance,
    subjectPerformance,
    gradeDistribution,
  };
}
