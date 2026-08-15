// ═══════════════════════════════════════════════════════════════════
//  AI TOOL REGISTRY — the ONLY way the AI agent touches the database.
//
//  OpenAI never sees a connection string and never runs a query. Every
//  handler here takes (args, user) where `user` is the JWT-verified
//  identity attached by ../middleware/auth.js — args coming from the
//  model (which is ultimately steered by untrusted user text) are used
//  for query PARAMETERS (a date, a reason, a subject) but never for
//  WHOSE data gets read or written. That always comes from `user`.
//
//  Tools are grouped into three categories (see the spec this was built
//  against): "read" executes immediately, "draft" only composes/returns
//  data for the model to write prose from (no DB mutation), and "write"
//  never mutates directly — it stores a pending AiAction and returns a
//  preview; actual execution only happens from POST
//  /api/ai/actions/:id/confirm after the user explicitly confirms (see
//  aiRoute.js).
// ═══════════════════════════════════════════════════════════════════
import mongoose from "mongoose";
import Fee from "../models/FeeModel.js";
import Grade from "../models/GradeModel.js";
import Attendance from "../models/attendanceModel.js";
import Leave from "../models/leavemodel.js";
import ClassModel from "../models/classModel.js";
import Exam from "../models/ExamModel.js";
import Student from "../models/studentModel.js";
import AiAction from "../models/AiAction.js";

const isValidId = (id) => typeof id === "string" && mongoose.Types.ObjectId.isValid(id);
const todayStr = () => new Date().toISOString().split("T")[0];
const PENDING_ACTION_TTL_MS = 10 * 60 * 1000; // 10 minutes to confirm

async function preparePendingAction({ user, type, params, preview }) {
  const action = await AiAction.create({
    userId: user.id,
    userRole: user.role,
    type,
    params,
    preview,
    expiresAt: new Date(Date.now() + PENDING_ACTION_TTL_MS),
  });
  return { requiresConfirmation: true, actionId: action._id.toString(), preview };
}

// ── shared data-gathering helpers (reused by multiple tools) ──────────

async function gatherFee(studentId) {
  const fees = await Fee.find({ studentId }).sort({ dueDate: 1 });
  if (!fees.length) return { found: false };
  const outstanding = fees.filter((f) => f.status !== "paid");
  const totalOutstanding = outstanding.reduce((s, f) => s + f.amount, 0);
  const next = [...outstanding].sort((a, b) => a.dueDate - b.dueDate)[0];
  return {
    found: true,
    records: fees.map((f) => ({ title: f.title, amount: f.amount, category: f.category, dueDate: f.dueDate, status: f.status, paidOn: f.paidOn })),
    totalOutstanding,
    nextDue: next ? { title: next.title, amount: next.amount, dueDate: next.dueDate, status: next.status } : null,
  };
}

async function gatherAttendance(studentId) {
  const records = await Attendance.find({ studentId });
  if (!records.length) return { found: false };
  const present = records.filter((r) => r.status === "present").length;
  const absent = records.filter((r) => r.status === "absent").length;
  const leave = records.filter((r) => r.status === "leave").length;
  return {
    found: true,
    totalDaysRecorded: records.length,
    present, absent, leave,
    attendanceRatePct: Math.round((present / records.length) * 100),
    note: "This system only records overall daily attendance (present/absent/leave) — it does not track attendance per subject.",
  };
}

async function gatherGrades(studentId) {
  const grades = await Grade.find({ studentId }).sort({ date: -1 });
  if (!grades.length) return { found: false };
  const withPct = grades.map((g) => ({ subject: g.subject, examName: g.examName, marks: g.marks, maxMarks: g.maxMarks, pct: Math.round((g.marks / g.maxMarks) * 100), date: g.date }));
  const avgPct = Math.round(withPct.reduce((s, g) => s + g.pct, 0) / withPct.length);
  const strongest = [...withPct].sort((a, b) => b.pct - a.pct)[0];
  const weakest = [...withPct].sort((a, b) => a.pct - b.pct)[0];
  return { found: true, records: withPct, averagePct: avgPct, strongestSubject: strongest, weakestSubject: weakest };
}

async function gatherCourses(studentId) {
  const classes = await ClassModel.find({ students: studentId, isActive: true }).select("classCode className teacher scheduleDay scheduleTime room semester");
  return { found: classes.length > 0, courses: classes };
}

// ── STUDENT TOOLS ──────────────────────────────────────────────────

async function getMyFee(args, user) {
  return gatherFee(user.id);
}

async function getMyAttendance(args, user) {
  return gatherAttendance(user.id);
}

async function getMyGrades(args, user) {
  // Also covers "results" — this app has no separate Result model; Grade
  // records (subject/examName/marks) *are* the student's results.
  return gatherGrades(user.id);
}

async function getMyCourses(args, user) {
  return gatherCourses(user.id);
}

async function getMyProfile(args, user) {
  const student = await Student.findById(user.id).select("name rollNo email program semester isActive");
  if (!student) return { error: "Profile not found." };
  return { found: true, profile: student };
}

// Grade records here have no semester/term field (verified against
// GradeModel.js — subject/examName/marks/maxMarks/date only), so a true
// "compare across semesters" isn't answerable without inventing data.
// This groups by examName instead (e.g. "Midterm 1" vs "Final"), which is
// the real, comparable unit this system actually tracks over time.
async function compareMyGrades(args, user) {
  const grades = await gatherGrades(user.id);
  if (!grades.found) return grades;
  const byExam = {};
  for (const g of grades.records) {
    byExam[g.examName] ??= { examName: g.examName, subjects: [], avgPct: 0 };
    byExam[g.examName].subjects.push({ subject: g.subject, pct: g.pct });
  }
  const exams = Object.values(byExam)
    .map((e) => ({ ...e, avgPct: Math.round(e.subjects.reduce((s, x) => s + x.pct, 0) / e.subjects.length) }))
    .sort((a, b) => a.examName.localeCompare(b.examName));
  return {
    found: true,
    byExam: exams,
    note: exams.length < 2 ? "Only one exam is on record, so there isn't yet a second point to compare against." : "This system doesn't track a semester/term field on grades — comparison is by exam name, not by semester.",
  };
}

async function getMyLeaveRequests(args, user) {
  const leaves = await Leave.find({ studentId: user.id }).sort({ appliedAt: -1 }).limit(20);
  return { found: leaves.length > 0, leaves: leaves.map((l) => ({ id: l._id, type: l.type, from: l.from, to: l.to, reason: l.reason, status: l.status, appliedAt: l.appliedAt })) };
}

async function createLeaveRequest(args, user) {
  const { from, to, type, reason } = args || {};
  if (!from || !to || !reason || !String(reason).trim()) {
    return { error: "from, to, and reason are all required to prepare a leave request." };
  }
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return { error: "from/to must be valid dates." };
  }
  if (toDate < fromDate) {
    return { error: "The end date can't be before the start date." };
  }
  const days = Math.round((toDate - fromDate) / 86400000) + 1;
  const validTypes = ["Medical", "casual", "Family Emergency", "Personal", "Academic", "Travel", "Other"];
  const leaveType = validTypes.includes(type) ? type : "Other";

  return preparePendingAction({
    user,
    type: "create_leave_request",
    params: { studentId: user.id, from: fromDate, to: toDate, type: leaveType, reason: String(reason).trim() },
    preview: { from: fromDate.toDateString(), to: toDate.toDateString(), days, type: leaveType, reason: String(reason).trim() },
  });
}

async function generateParentMessage(args, user) {
  // DRAFT only — gathers real data for the model to write prose from.
  // There is no student-facing "send" tool: the existing ParentMessage
  // system (parentMessageRoute.js) only ever lets admins send to parents,
  // so a student can compose and copy, never dispatch, matching that.
  const topic = (args?.topic || "fee").toLowerCase();
  const student = await Student.findById(user.id).select("name parentName parentEmail");
  const base = { studentName: student?.name || null, parentName: student?.parentName || null, hasParentContactOnFile: !!student?.parentEmail };
  if (topic === "attendance") return { ...base, topic, attendance: await gatherAttendance(user.id) };
  if (topic === "grades" || topic === "results") return { ...base, topic, grades: await gatherGrades(user.id) };
  return { ...base, topic: "fee", fee: await gatherFee(user.id) };
}

async function generateStudyPlan(args, user) {
  const grades = await gatherGrades(user.id);
  const courses = await gatherCourses(user.id);
  let upcomingExams = [];
  if (courses.found) {
    const subjects = [...new Set(courses.courses.map((c) => c.className))];
    upcomingExams = await Exam.find({ status: "upcoming", subject: { $in: subjects } }).sort({ date: 1 }).select("name subject date venue");
  }
  return {
    grades,
    courses,
    upcomingExams: upcomingExams.length ? upcomingExams : [],
    examDataAvailable: upcomingExams.length > 0,
    note: upcomingExams.length === 0 ? "No matching upcoming exam dates were found in the system for this student's enrolled courses — do not invent exam dates." : undefined,
  };
}

async function analyzeMyPerformance(args, user) {
  const [grades, attendance, courses] = await Promise.all([gatherGrades(user.id), gatherAttendance(user.id), gatherCourses(user.id)]);
  return { grades, attendance, courses };
}

// ── ADMIN TOOLS ─────────────────────────────────────────────────────

async function getStudents(args, user) {
  const q = (args?.search || "").trim();
  const filter = q ? { $or: [{ name: new RegExp(q, "i") }, { rollNo: new RegExp(q, "i") }] } : {};
  const students = await Student.find(filter).select("name rollNo email program semester isActive").limit(100);
  return { count: students.length, students };
}

async function getAbsentStudents(args, user) {
  // Server date by default — an admin may explicitly ask about a past
  // date, but we never trust a client-implied "today".
  const date = args?.date && /^\d{4}-\d{2}-\d{2}$/.test(args.date) ? args.date : todayStr();
  const records = await Attendance.find({ date, status: "absent" });
  if (!records.length) return { date, count: 0, students: [] };
  const students = await Student.find({ _id: { $in: records.map((r) => r.studentId) } }).select("name rollNo email parentName parentEmail");
  return { date, count: students.length, students };
}

async function getStudentProgress(args, user) {
  const { studentId } = args || {};
  if (!isValidId(studentId)) return { error: "A valid studentId is required." };
  const student = await Student.findById(studentId).select("name rollNo email program semester");
  if (!student) return { error: "Student not found." };
  const [grades, attendance, leaves] = await Promise.all([
    gatherGrades(studentId),
    gatherAttendance(studentId),
    Leave.find({ studentId }).sort({ appliedAt: -1 }).limit(10),
  ]);
  return { student, grades, attendance, recentLeaves: leaves.map((l) => ({ type: l.type, from: l.from, to: l.to, status: l.status })) };
}

// Thin, single-purpose wrappers around the same gatherers getStudentProgress
// already uses — useful when an admin (or the model, routing a narrow
// question) wants just attendance or just grades without the full bundle.
async function getStudentAttendance(args, user) {
  const { studentId } = args || {};
  if (!isValidId(studentId)) return { error: "A valid studentId is required." };
  const student = await Student.findById(studentId).select("name rollNo");
  if (!student) return { error: "Student not found." };
  return { student, attendance: await gatherAttendance(studentId) };
}

async function getStudentGrades(args, user) {
  const { studentId } = args || {};
  if (!isValidId(studentId)) return { error: "A valid studentId is required." };
  const student = await Student.findById(studentId).select("name rollNo");
  if (!student) return { error: "Student not found." };
  return { student, grades: await gatherGrades(studentId) };
}

async function getAttendanceStatistics(args, user) {
  const totalStudents = await Student.countDocuments({ isActive: true });
  const date = todayStr();
  const [presentToday, absentToday, leaveToday] = await Promise.all([
    Attendance.countDocuments({ date, status: "present" }),
    Attendance.countDocuments({ date, status: "absent" }),
    Attendance.countDocuments({ date, status: "leave" }),
  ]);
  // Low-attendance students, computed from each student's own history.
  const all = await Attendance.find().select("studentId status");
  const byStudent = {};
  for (const r of all) {
    const k = String(r.studentId);
    byStudent[k] ??= { total: 0, present: 0 };
    byStudent[k].total++;
    if (r.status === "present") byStudent[k].present++;
  }
  const lowIds = Object.entries(byStudent)
    .filter(([, v]) => v.total >= 3 && v.present / v.total < 0.75)
    .map(([id]) => id);
  const lowStudents = lowIds.length ? await Student.find({ _id: { $in: lowIds } }).select("name rollNo") : [];
  return { totalStudents, date, presentToday, absentToday, leaveToday, studentsWithLowAttendance: lowStudents.length, lowAttendanceList: lowStudents };
}

async function getGradeStatistics(args, user) {
  const grades = await Grade.find().select("subject marks maxMarks");
  if (!grades.length) return { found: false };
  const bySubject = {};
  for (const g of grades) {
    bySubject[g.subject] ??= [];
    bySubject[g.subject].push((g.marks / g.maxMarks) * 100);
  }
  const subjectAverages = Object.entries(bySubject).map(([subject, pcts]) => ({
    subject, averagePct: Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length), recordCount: pcts.length,
  })).sort((a, b) => a.averagePct - b.averagePct);
  return { found: true, overallAveragePct: Math.round(subjectAverages.reduce((s, x) => s + x.averagePct, 0) / subjectAverages.length), subjectAverages };
}

async function getFeeStatistics(args, user) {
  const fees = await Fee.find().select("amount status");
  if (!fees.length) return { found: false };
  const paid = fees.filter((f) => f.status === "paid");
  const unpaid = fees.filter((f) => f.status === "unpaid");
  const overdue = fees.filter((f) => f.status === "overdue");
  return {
    found: true,
    totalRecords: fees.length,
    totalCollected: paid.reduce((s, f) => s + f.amount, 0),
    totalOutstanding: [...unpaid, ...overdue].reduce((s, f) => s + f.amount, 0),
    overdueCount: overdue.length,
    overdueAmount: overdue.reduce((s, f) => s + f.amount, 0),
  };
}

async function generateParentEmail(args, user) {
  // DRAFT — no send. Either a single student or today's absentees.
  if (args?.studentId) {
    if (!isValidId(args.studentId)) return { error: "A valid studentId is required." };
    const student = await Student.findById(args.studentId).select("name rollNo parentName parentEmail");
    if (!student) return { error: "Student not found." };
    if (!student.parentEmail) return { error: "No parent email is on file for this student." };
    return { scope: "single_student", students: [student] };
  }
  const absentees = await getAbsentStudents({ date: args?.date }, user);
  const withEmail = absentees.students.filter((s) => s.parentEmail);
  return { scope: "today_absentees", date: absentees.date, students: withEmail, studentsWithoutParentEmail: absentees.students.length - withEmail.length };
}

async function sendParentEmail(args, user) {
  const { studentId, subject, message } = args || {};
  if (!isValidId(studentId)) return { error: "A valid studentId is required." };
  if (!subject?.trim() || !message?.trim()) return { error: "Both subject and message are required." };
  const student = await Student.findById(studentId).select("name rollNo parentName parentEmail");
  if (!student) return { error: "Student not found." };
  if (!student.parentEmail) return { error: "No parent email is on file for this student." };

  return preparePendingAction({
    user,
    type: "send_parent_email",
    params: { studentId, subject: subject.trim(), message: message.trim() },
    preview: { studentName: student.name, rollNo: student.rollNo, parentEmail: student.parentEmail, subject: subject.trim(), message: message.trim() },
  });
}

async function sendParentEmailsBulk(args, user) {
  const { items } = args || {};
  if (!Array.isArray(items) || !items.length) return { error: "At least one email item (studentId, subject, message) is required." };
  const ids = items.map((i) => i.studentId).filter(isValidId);
  const students = await Student.find({ _id: { $in: ids } }).select("name rollNo parentName parentEmail");
  const byId = Object.fromEntries(students.map((s) => [String(s._id), s]));
  const prepared = [];
  const skipped = [];
  for (const item of items) {
    const student = byId[item.studentId];
    if (!student || !student.parentEmail || !item.subject?.trim() || !item.message?.trim()) {
      skipped.push({ studentId: item.studentId, reason: !student ? "not found" : !student.parentEmail ? "no parent email on file" : "missing subject/message" });
      continue;
    }
    prepared.push({ studentId: item.studentId, studentName: student.name, rollNo: student.rollNo, parentEmail: student.parentEmail, subject: item.subject.trim(), message: item.message.trim() });
  }
  if (!prepared.length) return { error: "None of the provided items could be prepared.", skipped };

  return preparePendingAction({
    user,
    type: "send_parent_emails_bulk",
    params: { items: prepared },
    preview: { count: prepared.length, items: prepared, skipped },
  });
}

async function generateProgressReport(args, user) {
  return getStudentProgress(args, user);
}

async function analyzeStudentPerformance(args, user) {
  return getStudentProgress(args, user);
}

// ── registry ────────────────────────────────────────────────────────

const S = (props) => ({ type: "object", properties: props.properties || {}, required: props.required || [] });

export const TOOLS = [
  // student — read
  { name: "getMyFee", roles: ["student"], category: "read", handler: getMyFee,
    description: "Get the authenticated student's own fee records (amounts, due dates, paid/unpaid/overdue status).",
    parameters: S({}) },
  { name: "getMyAttendance", roles: ["student"], category: "read", handler: getMyAttendance,
    description: "Get the authenticated student's own overall attendance (present/absent/leave counts and rate). No subject-level breakdown exists in this system.",
    parameters: S({}) },
  { name: "getMyGrades", roles: ["student"], category: "read", handler: getMyGrades,
    description: "Get the authenticated student's own grades/results by subject and exam, including per-subject percentage, strongest and weakest subject.",
    parameters: S({}) },
  { name: "getMyCourses", roles: ["student"], category: "read", handler: getMyCourses,
    description: "Get the classes/courses the authenticated student is currently enrolled in.",
    parameters: S({}) },
  { name: "getMyLeaveRequests", roles: ["student"], category: "read", handler: getMyLeaveRequests,
    description: "Get the authenticated student's own leave request history and statuses.",
    parameters: S({}) },
  { name: "getMyProfile", roles: ["student"], category: "read", handler: getMyProfile,
    description: "Get the authenticated student's own profile (name, roll number, email, program, semester).",
    parameters: S({}) },
  // student — draft
  { name: "generateParentMessage", roles: ["student"], category: "draft", handler: generateParentMessage,
    description: "Gather the authenticated student's real data (fee, attendance, or grades) so a message to a parent can be drafted from it. Does not send anything.",
    parameters: S({ properties: { topic: { type: "string", enum: ["fee", "attendance", "grades"], description: "What the message should be about." } } }) },
  { name: "generateStudyPlan", roles: ["student"], category: "draft", handler: generateStudyPlan,
    description: "Gather the authenticated student's real grades and any matching upcoming exam dates, to build a study plan from.",
    parameters: S({}) },
  { name: "analyzeMyPerformance", roles: ["student"], category: "draft", handler: analyzeMyPerformance,
    description: "Gather the authenticated student's real grades, attendance, and courses together for an overall performance analysis.",
    parameters: S({}) },
  { name: "getMyAcademicSummary", roles: ["student"], category: "draft", handler: analyzeMyPerformance,
    description: "Alias of analyzeMyPerformance — gather the authenticated student's grades, attendance, and courses for an overall academic summary.",
    parameters: S({}) },
  { name: "compareMyGrades", roles: ["student"], category: "draft", handler: compareMyGrades,
    description: "Gather the authenticated student's real grades grouped by exam (e.g. Midterm 1 vs Final) so they can be compared. This system has no semester/term field on grades, so comparison is by exam name, not semester.",
    parameters: S({}) },
  // student — write (requires confirmation)
  { name: "createLeaveRequest", roles: ["student"], category: "write", handler: createLeaveRequest,
    description: "Prepare a leave request for the authenticated student. This does NOT submit it — it returns a preview requiring explicit user confirmation before it is actually created.",
    parameters: S({
      properties: {
        from: { type: "string", description: "Start date, YYYY-MM-DD" },
        to: { type: "string", description: "End date, YYYY-MM-DD" },
        type: { type: "string", enum: ["Medical", "casual", "Family Emergency", "Personal", "Academic", "Travel", "Other"] },
        reason: { type: "string", description: "Reason for the leave" },
      },
      required: ["from", "to", "reason"],
    }) },
  // admin — read
  { name: "getStudents", roles: ["admin"], category: "read", handler: getStudents,
    description: "List/search enrolled students by name or roll number.",
    parameters: S({ properties: { search: { type: "string" } } }) },
  { name: "getAbsentStudents", roles: ["admin"], category: "read", handler: getAbsentStudents,
    description: "Get students marked absent on a given date (defaults to today).",
    parameters: S({ properties: { date: { type: "string", description: "YYYY-MM-DD, defaults to today" } } }) },
  { name: "getStudentProgress", roles: ["admin"], category: "read", handler: getStudentProgress,
    description: "Get one student's combined grades, attendance, and recent leave history by their studentId.",
    parameters: S({ properties: { studentId: { type: "string" } }, required: ["studentId"] }) },
  { name: "getStudentAttendance", roles: ["admin"], category: "read", handler: getStudentAttendance,
    description: "Get one specific student's attendance only, by studentId (narrower than getStudentProgress).",
    parameters: S({ properties: { studentId: { type: "string" } }, required: ["studentId"] }) },
  { name: "getStudentGrades", roles: ["admin"], category: "read", handler: getStudentGrades,
    description: "Get one specific student's grades only, by studentId (narrower than getStudentProgress).",
    parameters: S({ properties: { studentId: { type: "string" } }, required: ["studentId"] }) },
  { name: "getAttendanceStatistics", roles: ["admin"], category: "read", handler: getAttendanceStatistics,
    description: "Get school-wide attendance statistics: today's present/absent/leave counts and students with low overall attendance (<75%).",
    parameters: S({}) },
  { name: "getGradeStatistics", roles: ["admin"], category: "read", handler: getGradeStatistics,
    description: "Get school-wide grade statistics: per-subject and overall averages, weakest subjects.",
    parameters: S({}) },
  { name: "getAcademicStatistics", roles: ["admin"], category: "read", handler: getGradeStatistics,
    description: "Alias of getGradeStatistics — school-wide grade statistics: per-subject and overall averages, weakest subjects.",
    parameters: S({}) },
  { name: "getFeeStatistics", roles: ["admin"], category: "read", handler: getFeeStatistics,
    description: "Get school-wide fee statistics: total collected, outstanding, and overdue amounts/counts.",
    parameters: S({}) },
  // admin — draft
  { name: "generateParentEmail", roles: ["admin"], category: "draft", handler: generateParentEmail,
    description: "Gather real data to draft a parent email — either for one student (studentId) or for all of today's absentees (omit studentId). Does not send anything.",
    parameters: S({ properties: { studentId: { type: "string" }, date: { type: "string" } } }) },
  { name: "generateProgressReport", roles: ["admin"], category: "draft", handler: generateProgressReport,
    description: "Gather one student's real academic data to compose a progress report from.",
    parameters: S({ properties: { studentId: { type: "string" } }, required: ["studentId"] }) },
  { name: "generateProgressSummary", roles: ["admin"], category: "draft", handler: generateProgressReport,
    description: "Alias of generateProgressReport — gather one student's real academic data to compose a progress summary from.",
    parameters: S({ properties: { studentId: { type: "string" } }, required: ["studentId"] }) },
  { name: "analyzeStudentPerformance", roles: ["admin"], category: "draft", handler: analyzeStudentPerformance,
    description: "Gather one student's real academic data for a performance analysis (strengths/weaknesses).",
    parameters: S({ properties: { studentId: { type: "string" } }, required: ["studentId"] }) },
  // admin — write (requires confirmation)
  { name: "sendParentEmail", roles: ["admin"], category: "write", handler: sendParentEmail,
    description: "Prepare sending an email to one student's parent with the given subject/message (compose the message first using generateParentEmail's data). Does NOT send — returns a preview requiring explicit confirmation.",
    parameters: S({ properties: { studentId: { type: "string" }, subject: { type: "string" }, message: { type: "string" } }, required: ["studentId", "subject", "message"] }) },
  { name: "sendParentEmailsBulk", roles: ["admin"], category: "write", handler: sendParentEmailsBulk,
    description: "Prepare sending personalized emails to multiple parents at once (e.g. today's absentees). Each item needs studentId, subject, message. Does NOT send — returns a preview requiring explicit confirmation.",
    parameters: S({ properties: { items: { type: "array", items: S({ properties: { studentId: { type: "string" }, subject: { type: "string" }, message: { type: "string" } }, required: ["studentId", "subject", "message"] }) } }, required: ["items"] }) },
];

export function getToolsForRole(role) {
  return TOOLS.filter((t) => t.roles.includes(role));
}

export async function executeTool(name, args, user) {
  const tool = TOOLS.find((t) => t.name === name && t.roles.includes(user.role));
  if (!tool) return { error: `Tool "${name}" is not available for this role.` };
  try {
    return await tool.handler(args || {}, user);
  } catch (err) {
    console.error(`[aiTools] ${name} failed:`, err.message);
    return { error: "This tool failed to run. Please try again." };
  }
}
