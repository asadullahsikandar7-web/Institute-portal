// AI tools for the ERP + smart layers. Same contract as aiTools.js: every
// handler takes (args, user) and scopes by the JWT-verified `user`, never
// by an id the model supplies — a student's tools can only ever read that
// student's own records. All of these are read-only.
import Fee from "../models/FeeModel.js";
import Student from "../models/studentModel.js";
import StudentEnrollment from "../models/StudentEnrollment.js";
import TeacherAssignment from "../models/TeacherAssignment.js";
import Assignment from "../models/Assignment.js";
import { Admission, BookIssue, Expense, Payslip, Staff, Submission, Ticket } from "../models/Erp.js";
// Registered for populate() — these tools can run before any route that
// would otherwise have loaded them.
import "../models/Section.js";
import "../models/Program.js";
import "../models/Subject.js";
import "../models/AcademicSession.js";
import "../models/Teacher.js";
import "../models/Room.js";
import { computeRisk } from "./risk.js";
import { buildTranscript } from "../routes/resultRoute.js";
import { studentExams } from "../routes/examSuiteRoute.js";

const S = (props = {}) => ({ type: "object", properties: props.properties || {}, required: props.required || [] });
const round = (n) => Math.round(n);

// ── admin ──────────────────────────────────────────────────────────────────
async function getAtRiskStudents(args) {
  const enrollments = await StudentEnrollment.find({ status: "active" }).populate("student", "name rollNo").populate("section", "name").populate("program", "code");
  const live = enrollments.filter(e => e.student);
  const risk = await computeRisk(live.map(e => e.student._id));
  const rows = live.map(e => ({ name: e.student.name, rollNo: e.student.rollNo, class: `${e.program?.code || ""} ${e.section?.name || ""}`.trim(), ...risk.get(String(e.student._id)) }))
    .filter(r => r.level !== "low").sort((a, b) => b.score - a.score);
  const limit = Math.min(Number(args.limit) || 10, 25);
  return {
    highRisk: rows.filter(r => r.level === "high").length, watchList: rows.filter(r => r.level === "medium").length, totalEnrolled: live.length,
    students: rows.slice(0, limit).map(r => ({ name: r.name, rollNo: r.rollNo, class: r.class, riskScore: r.score, level: r.level, reasons: r.reasons.map(x => x.text) })),
  };
}

async function getFeeDefaulters(args) {
  const fees = await Fee.find({ status: { $ne: "paid" }, dueDate: { $lt: new Date() } }).populate("studentId", "name rollNo");
  const by = new Map();
  for (const f of fees) {
    if (!f.studentId || f.balance <= 0) continue;
    const k = String(f.studentId._id);
    const cur = by.get(k) || { name: f.studentId.name, rollNo: f.studentId.rollNo, overdueAmount: 0, lines: 0, oldestDue: f.dueDate };
    cur.overdueAmount += f.balance; cur.lines += 1;
    if (f.dueDate < cur.oldestDue) cur.oldestDue = f.dueDate;
    by.set(k, cur);
  }
  const list = [...by.values()].sort((a, b) => b.overdueAmount - a.overdueAmount);
  return { defaulters: list.length, totalOverdue: round(list.reduce((s, d) => s + d.overdueAmount, 0)), top: list.slice(0, Math.min(Number(args.limit) || 10, 25)).map(d => ({ ...d, overdueAmount: round(d.overdueAmount) })) };
}

async function getFinanceSummary() {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [fees, expenses] = await Promise.all([Fee.find().select("amount discount fine paidAmount status payments paidOn dueDate"), Expense.find({ date: { $gte: monthStart } }).select("amount category")]);
  let billed = 0, outstanding = 0, collectedThisMonth = 0;
  for (const f of fees) {
    billed += f.netAmount; outstanding += f.balance;
    for (const p of f.payments) if (p.paidOn >= monthStart) collectedThisMonth += p.amount;
  }
  const byCategory = {};
  expenses.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });
  return { totalBilled: round(billed), totalCollected: round(billed - outstanding), outstanding: round(outstanding), collectionRatePct: billed ? round(((billed - outstanding) / billed) * 100) : 0, collectedThisMonth: round(collectedThisMonth), expensesThisMonth: round(expenses.reduce((s, e) => s + e.amount, 0)), expensesThisMonthByCategory: byCategory };
}

async function getAdmissionsPipeline() {
  const rows = await Admission.aggregate([{ $group: { _id: "$stage", count: { $sum: 1 }, avgMerit: { $avg: "$meritScore" } } }]);
  const top = await Admission.find({ stage: { $nin: ["rejected", "withdrawn", "enrolled"] }, meritScore: { $ne: null } }).sort({ meritScore: -1 }).limit(5).select("name applicationNo meritScore stage");
  return { byStage: Object.fromEntries(rows.map(r => [r._id, r.count])), total: rows.reduce((s, r) => s + r.count, 0), topByMerit: top.map(a => ({ name: a.name, applicationNo: a.applicationNo, merit: a.meritScore, stage: a.stage })) };
}

async function getOperationsSnapshot() {
  const now = new Date(), month = now.toISOString().slice(0, 7);
  const [openTickets, urgentTickets, overdueBooks, staff, payslips] = await Promise.all([
    Ticket.countDocuments({ status: { $in: ["open", "in_progress"] } }), Ticket.countDocuments({ status: { $in: ["open", "in_progress"] }, priority: { $in: ["high", "urgent"] } }),
    BookIssue.countDocuments({ status: "issued", dueOn: { $lt: now } }), Staff.countDocuments({ status: "active" }), Payslip.find({ month }).select("net status"),
  ]);
  return { openTickets, urgentTickets, overdueLibraryBooks: overdueBooks, activeStaff: staff, payrollThisMonth: payslips.length ? { payslips: payslips.length, net: round(payslips.reduce((s, p) => s + p.net, 0)), unpaid: payslips.filter(p => p.status !== "paid").length } : "not run yet" };
}

// ── student ────────────────────────────────────────────────────────────────
async function getMyTranscript(args, user) {
  const t = await buildTranscript(user.id, { publishedOnly: true });
  if (!t.terms.length) return { found: false, note: "No results have been published yet." };
  return { found: true, cgpa: t.cgpa, creditsEarned: t.creditsEarned, totalCredits: t.totalCredits, failedCourses: t.failed, terms: t.terms.map(term => ({ session: term.session?.name, gpa: term.gpa, courses: term.courses.map(c => ({ course: c.subject?.name, percentage: c.percentage, grade: c.grade, gradePoint: c.gradePoint })) })) };
}

async function getMyExamSchedule(args, user) {
  const exams = await studentExams(user.id);
  if (!exams.length) return { found: false, note: "No exam datesheet has been published." };
  return { found: true, exams: exams.map(e => ({ exam: e.session.name, admitCardAvailable: e.admitCard.allowed, heldForOverdueFees: e.admitCard.feeBlocked ? round(e.admitCard.feeDue) : 0, papers: e.papers.map(p => ({ paper: p.subject?.name, date: p.date, time: `${p.startTime}-${p.endTime}`, room: p.room?.name, seat: p.seatNo, eligible: p.eligible, reason: p.reason })) })) };
}

async function getMyStanding(args, user) {
  const risk = (await computeRisk([user.id])).get(String(user.id));
  const student = await Student.findById(user.id).select("name");
  return { name: student?.name, standing: risk.level === "high" ? "at risk — needs urgent attention" : risk.level === "medium" ? "needs attention" : "on track", concerns: risk.reasons.map(r => r.text), attendancePct: risk.metrics.attendance ?? null, averagePct: risk.metrics.average ?? null, overdueFeeBalance: risk.metrics.overdueBalance ?? 0, assignmentsNotHandedIn: risk.metrics.missingWork ?? 0 };
}

// ── teacher ────────────────────────────────────────────────────────────────
async function getMyAtRiskStudents(args, user) {
  const tas = await TeacherAssignment.find({ teacher: user.id, status: "active" }).populate("subject", "name").populate("section", "name");
  if (!tas.length) return { found: false };
  const enrollments = await StudentEnrollment.find({ section: { $in: tas.map(t => t.section._id) }, status: "active" }).populate("student", "name rollNo").populate("section", "name");
  const live = enrollments.filter(e => e.student);
  const risk = await computeRisk(live.map(e => e.student._id));
  const rows = live.map(e => ({ name: e.student.name, rollNo: e.student.rollNo, section: e.section?.name, ...risk.get(String(e.student._id)) })).filter(r => r.level !== "low").sort((a, b) => b.score - a.score);
  return { found: true, classes: tas.map(t => `${t.subject?.name} (${t.section?.name})`), students: rows.slice(0, 15).map(r => ({ name: r.name, rollNo: r.rollNo, section: r.section, riskScore: r.score, level: r.level, reasons: r.reasons.map(x => x.text) })) };
}

async function getMyGradingQueue(args, user) {
  const tas = await TeacherAssignment.find({ teacher: user.id, status: "active" }).populate("subject", "name").populate("section", "name");
  const coursework = await Assignment.find({ teacherAssignment: { $in: tas.map(t => t._id) } }).select("title teacherAssignment dueDate");
  const pending = await Submission.aggregate([{ $match: { assignment: { $in: coursework.map(c => c._id) }, gradedAt: null } }, { $group: { _id: "$assignment", n: { $sum: 1 } } }]);
  const byId = new Map(coursework.map(c => [String(c._id), c])), taById = new Map(tas.map(t => [String(t._id), t]));
  return { ungradedSubmissions: pending.reduce((s, p) => s + p.n, 0), byAssignment: pending.map(p => { const c = byId.get(String(p._id)), ta = taById.get(String(c.teacherAssignment)); return { assignment: c.title, class: `${ta?.subject?.name} (${ta?.section?.name})`, waiting: p.n }; }) };
}

export const ERP_TOOLS = [
  { name: "getAtRiskStudents", roles: ["admin"], category: "read", handler: getAtRiskStudents,
    description: "List students the early-warning engine flags as high risk or on the watch list, each with a 0-100 risk score and the plain-language reasons (low attendance, failing courses, overdue fees, missing coursework, discipline).",
    parameters: S({ properties: { limit: { type: "number", description: "How many to return (default 10, max 25)" } } }) },
  { name: "getFeeDefaulters", roles: ["admin"], category: "read", handler: getFeeDefaulters,
    description: "List students with overdue fee balances (after discounts, fines and part payments), largest first, with the total overdue across the institute.",
    parameters: S({ properties: { limit: { type: "number" } } }) },
  { name: "getFinanceSummary", roles: ["admin"], category: "read", handler: getFinanceSummary,
    description: "Institute finance position: total billed, collected, outstanding, collection rate, plus this month's fee collection and expenses by category.",
    parameters: S() },
  { name: "getAdmissionsPipeline", roles: ["admin"], category: "read", handler: getAdmissionsPipeline,
    description: "Admissions pipeline: number of applicants at each stage and the top applicants by merit score.",
    parameters: S() },
  { name: "getOperationsSnapshot", roles: ["admin"], category: "read", handler: getOperationsSnapshot,
    description: "Operational snapshot: open and urgent helpdesk tickets, overdue library books, active staff, and whether this month's payroll has been run/paid.",
    parameters: S() },
  { name: "getMyTranscript", roles: ["student"], category: "read", handler: getMyTranscript,
    description: "Get the authenticated student's own official results: CGPA, term GPA, credit hours and the grade in each published course.",
    parameters: S() },
  { name: "getMyExamSchedule", roles: ["student"], category: "read", handler: getMyExamSchedule,
    description: "Get the authenticated student's own exam datesheet: each paper's date, time, room and seat, whether they are eligible to sit it, and whether their admit card is available.",
    parameters: S() },
  { name: "getMyStanding", roles: ["student"], category: "read", handler: getMyStanding,
    description: "Get an honest summary of how the authenticated student is doing overall: attendance, average marks, overdue fees, coursework not handed in, and any concerns that need attention.",
    parameters: S() },
  { name: "getMyAtRiskStudents", roles: ["teacher"], category: "read", handler: getMyAtRiskStudents,
    description: "List students in the authenticated teacher's own classes who are at high risk or on the watch list, with the reasons.",
    parameters: S() },
  { name: "getMyGradingQueue", roles: ["teacher"], category: "read", handler: getMyGradingQueue,
    description: "How many assignment submissions are waiting for the authenticated teacher to grade, broken down by assignment and class.",
    parameters: S() },
];
