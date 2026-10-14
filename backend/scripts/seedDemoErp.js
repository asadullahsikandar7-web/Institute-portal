// ══════════════════════════════════════════════════════════════════
//  ACADEXA DEMO SEED — ERP + smart layer
//  Called by seedDemo.js after it has created the demo session,
//  programs, teachers, students and attendance. Fills every other module
//  so no screen in the demo is empty, and shapes a few students into
//  recognisable stories (a model student, a student in real trouble, one
//  on the watch list) so the early-warning engine has something to find.
//
//  Same safety rule as seedDemo.js: everything created here hangs off a
//  demo anchor (a demo student/teacher/session, or a "DEMO"-tagged
//  name/code), and resetErp() deletes only what is reachable from those.
// ══════════════════════════════════════════════════════════════════
import bcrypt from "bcryptjs";
import crypto from "crypto";
import Admin from "../src/models/adminModel.js";
import Student from "../src/models/studentModel.js";
import Parent from "../src/models/Parent.js";
import Room from "../src/models/Room.js";
import Fee from "../src/models/FeeModel.js";
import Quiz from "../src/models/Quiz.js";
import Assignment from "../src/models/Assignment.js";
import Notification from "../src/models/notificationModel.js";
import TimetableEntry from "../src/models/TimetableEntry.js";
import SubjectAttendance from "../src/models/SubjectAttendance.js";
import { gradeFor, DEFAULT_GRADING_SCHEME, nextCode } from "../src/models/Settings.js";
import {
  Admission, FeeStructure, Scholarship, Expense, GradebookConfig, CourseResult, Submission, QuizAttempt,
  Department, Staff, StaffAttendance, Payslip, StaffLeave, Book, BookIssue, TransportRoute, TransportAssignment,
  Hostel, HostelRoom, HostelAllocation, Asset, Visitor, CalendarEvent, Ticket, StudentRecord, Certificate, Alumni,
} from "../src/models/Erp.js";
import { Intervention, ExamSession, ExamPaper, AttendanceSession, PaymentClaim, Survey, SurveyResponse, Substitution, MeetingSlot } from "../src/models/Smart.js";
import Program from "../src/models/Program.js";
import { planTimetable, planExams } from "../src/services/planner.js";

export const DEMO_PARENT_PASSWORD = "Demo@Parent2026";
export const DEMO_STAFF_PASSWORD = "Demo@Staff2026";
const DAY = 86400000;
const ago = (n) => new Date(Date.now() - n * DAY);
const ahead = (n) => new Date(Date.now() + n * DAY);
const iso = (d) => d.toISOString().slice(0, 10);
// A calendar date n days from today, stored the way the date inputs store
// one (UTC midnight) — so the same day shows in every list and printout.
const onDay = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); };
const TAG = "(Demo)";
const log = (msg) => console.log(`  ${msg}`);
// Deterministic pseudo-random in [0,1) — the same demo every time.
const rnd = (seed) => { const x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x); };

// ── Reset ──────────────────────────────────────────────────────────────────
export async function resetErp({ studentIds, teacherIds, parentIds, sessionIds, assignmentIds }) {
  const people = [...studentIds, ...teacherIds, ...parentIds].map(String);
  const demoDepartments = await Department.find({ code: /^DEMO-/ }).distinct("_id");
  const demoStaff = await Staff.find({ $or: [{ department: { $in: demoDepartments } }, { teacher: { $in: teacherIds } }] }).distinct("_id");
  const demoBooks = await Book.find({ isbn: /^DEMO-/ }).distinct("_id");
  const demoRoutes = await TransportRoute.find({ name: /^DEMO / }).distinct("_id");
  const demoHostels = await Hostel.find({ name: /^DEMO / }).distinct("_id");
  const demoHostelRooms = await HostelRoom.find({ hostel: { $in: demoHostels } }).distinct("_id");
  const demoStructures = await FeeStructure.find({ name: /^DEMO / }).distinct("_id");
  const demoExams = await ExamSession.find({ academicSession: { $in: sessionIds } }).distinct("_id");
  const demoSurveys = await Survey.find({ academicSession: { $in: sessionIds } }).distinct("_id");
  const demoRooms = await Room.find({ name: /^DEMO / }).distinct("_id");
  const demoQuizzes = await Quiz.find({ teacherAssignment: { $in: assignmentIds } }).distinct("_id");
  const demoCoursework = await Assignment.find({ teacherAssignment: { $in: assignmentIds } }).distinct("_id");

  const ops = [
    [SurveyResponse, { survey: { $in: demoSurveys } }], [Survey, { _id: { $in: demoSurveys } }],
    [ExamPaper, { examSession: { $in: demoExams } }], [ExamSession, { _id: { $in: demoExams } }],
    [AttendanceSession, { teacherAssignment: { $in: assignmentIds } }],
    [Substitution, { $or: [{ absentTeacher: { $in: teacherIds } }, { substitute: { $in: teacherIds } }] }], [MeetingSlot, { teacher: { $in: teacherIds } }],
    [Intervention, { student: { $in: studentIds } }], [PaymentClaim, { student: { $in: studentIds } }],
    [QuizAttempt, { quiz: { $in: demoQuizzes } }], [Submission, { assignment: { $in: demoCoursework } }],
    [CourseResult, { teacherAssignment: { $in: assignmentIds } }], [GradebookConfig, { teacherAssignment: { $in: assignmentIds } }],
    [TimetableEntry, { academicSession: { $in: sessionIds } }], [Room, { _id: { $in: demoRooms } }],
    [Fee, { studentId: { $in: studentIds } }], [Scholarship, { student: { $in: studentIds } }], [FeeStructure, { _id: { $in: demoStructures } }],
    [Expense, { reference: /^DEMO-/ }],
    [Payslip, { staff: { $in: demoStaff } }], [StaffAttendance, { staff: { $in: demoStaff } }], [StaffLeave, { staff: { $in: demoStaff } }],
    [Staff, { _id: { $in: demoStaff } }], [Department, { _id: { $in: demoDepartments } }],
    [BookIssue, { book: { $in: demoBooks } }], [Book, { _id: { $in: demoBooks } }],
    [TransportAssignment, { route: { $in: demoRoutes } }], [TransportRoute, { _id: { $in: demoRoutes } }],
    [HostelAllocation, { room: { $in: demoHostelRooms } }], [HostelRoom, { _id: { $in: demoHostelRooms } }], [Hostel, { _id: { $in: demoHostels } }],
    [Asset, { tag: /^DEMO-/ }], [Visitor, { badgeNo: /^DEMO-/ }],
    [CalendarEvent, { description: /\(Demo\)$/ }],
    [Ticket, { raisedById: { $in: people } }], [StudentRecord, { student: { $in: studentIds } }],
    [Certificate, { student: { $in: studentIds } }], [Alumni, { notes: /\(Demo\)$/ }],
    [Admission, { email: /@demo\.acadexa\.test$/i }],
    [Notification, { recipientId: { $in: [...parentIds, ...teacherIds] } }],
  ];
  let removed = 0;
  for (const [Model, filter] of ops) removed += (await Model.deleteMany(filter)).deletedCount;
  return removed;
}

// ── Seed ───────────────────────────────────────────────────────────────────
export async function seedErp({ demoAdmin, session, programs, sections, subjects, teachers, assignments, studentsBySection, DEMO_DOMAIN }) {
  const all = Object.values(studentsBySection).flat();
  const star = studentsBySection["DEMO-BSAI-A"][0];      // Zainab — the model student (demo student login)
  const struggling = studentsBySection["DEMO-BSAI-A"][1]; // Hamza — high risk on every signal
  const watch = studentsBySection["DEMO-BSAI-A"][5];      // Danish — slipping attendance, part-paid fee
  const secOf = new Map();
  for (const [code, list] of Object.entries(studentsBySection)) list.forEach(s => secOf.set(String(s._id), code));

  // ── Staff accounts with sub-roles ───────────────────────────────────────
  demoAdmin.isSuperAdmin = true; // so the demo admin can open Settings → Staff Accounts
  demoAdmin.name = "Demo Administrator";
  await demoAdmin.save();
  await Admin.create({ email: `accounts.demo@${DEMO_DOMAIN}`, password: DEMO_STAFF_PASSWORD, adminRole: "accountant", name: "Accounts Office" });
  await Admin.create({ email: `library.demo@${DEMO_DOMAIN}`, password: DEMO_STAFF_PASSWORD, adminRole: "librarian", name: "Library Desk" });
  log("Staff accounts: accountant + librarian (limited sub-roles)");

  // ── Extended profiles + parent portal access ───────────────────────────
  const cities = ["Lahore", "Karachi", "Islamabad", "Faisalabad", "Multan", "Rawalpindi"];
  const blood = ["A+", "B+", "O+", "AB+", "O-", "B-"];
  for (let i = 0; i < all.length; i++) {
    await Student.updateOne({ _id: all[i]._id }, {
      dob: new Date(2004 + (i % 3), i % 12, 1 + (i % 27)), gender: i % 2 ? "male" : "female", bloodGroup: blood[i % blood.length], city: cities[i % cities.length],
      address: `House ${10 + i}, Block ${String.fromCharCode(65 + (i % 6))}, ${cities[i % cities.length]}`, admissionDate: new Date("2026-08-01"),
      phone: `+92 30${i % 10}-55501${String(i).padStart(2, "0")}`, emergencyContact: `+92 32${i % 10}-55502${String(i).padStart(2, "0")}`,
    });
  }
  const parentHash = await bcrypt.hash(DEMO_PARENT_PASSWORD, 10);
  const portalParents = await Parent.find({ _id: { $in: [star.parentId, struggling.parentId] } });
  for (const p of portalParents) { p.password = parentHash; p.portalEnabled = true; await p.save(); }
  const strugglingParent = portalParents.find(p => String(p._id) === String(struggling.parentId));
  log(`Parent portal: enabled for ${portalParents.map(p => p.email).join(", ")}`);

  // ── Rooms + generated timetable ────────────────────────────────────────
  const rooms = await Room.insertMany([
    { name: "DEMO Hall 101", type: "classroom", capacity: 45, building: "Academic Block A", facilities: { multimedia: true, ac: true, whiteboard: true, internet: true, fans: 4, lights: 8 } },
    { name: "DEMO Hall 102", type: "classroom", capacity: 40, building: "Academic Block A", facilities: { multimedia: true, whiteboard: true, fans: 4, lights: 8 } },
    { name: "DEMO Hall 201", type: "classroom", capacity: 60, building: "Academic Block B", facilities: { multimedia: true, ac: true, whiteboard: true, internet: true, lights: 10 } },
    { name: "DEMO Computer Lab 1", type: "lab", capacity: 35, building: "IT Block", facilities: { multimedia: true, ac: true, internet: true, computers: 35, lights: 8 } },
    { name: "DEMO Auditorium", type: "auditorium", capacity: 250, building: "Main Block", facilities: { multimedia: true, ac: true, internet: true, lights: 30 } },
  ]);
  const sizeOf = (sectionId) => studentsBySection[Object.keys(sections).find(c => String(sections[c]._id) === String(sectionId))].length;
  const work = assignments.map(a => ({
    _id: a.doc._id, teacher: a.doc.teacher, section: a.doc.section, subject: a.doc.subject, program: a.doc.program,
    subjectName: Object.values(subjects).find(s => String(s._id) === String(a.doc.subject)).name, size: sizeOf(a.doc.section), sessions: 3,
  }));
  const slots = [{ start: "08:30", end: "10:00" }, { start: "10:00", end: "11:30" }, { start: "11:30", end: "13:00" }, { start: "13:30", end: "15:00" }];
  const tt = planTimetable({ assignments: work, rooms: rooms.filter(r => r.type !== "auditorium"), days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], slots });
  await TimetableEntry.insertMany(tt.placed.map(p => ({
    academicSession: session._id, program: p.assignment.program, section: p.assignment.section, subject: p.assignment.subject,
    teacherAssignment: p.assignment._id, teacher: p.assignment.teacher, room: p.room._id, day: p.day, startTime: p.startTime, endTime: p.endTime, type: p.type,
  })));
  log(`Rooms: ${rooms.length} · Timetable: ${tt.placed.length} periods generated clash-free (${tt.unplaced.length} unplaced)`);

  // ── Attendance stories ─────────────────────────────────────────────────
  // seedDemo.js gave everyone ~82%. Pull two students down deliberately.
  const dates = await SubjectAttendance.find({ student: struggling._id }).distinct("date");
  dates.sort();
  await SubjectAttendance.updateMany({ student: struggling._id, date: { $in: dates.filter((_, i) => i % 2 === 0 || i >= dates.length - 3) } }, { status: "absent" });
  await SubjectAttendance.updateMany({ student: watch._id, date: { $in: dates.slice(-3) } }, { status: "absent" });
  await SubjectAttendance.updateMany({ student: star._id }, { status: "present" });

  // ── Gradebook → results (6 of 9 classes published) ─────────────────────
  const components = [{ name: "Assignments", max: 10, weight: 10 }, { name: "Quizzes", max: 10, weight: 10 }, { name: "Midterm", max: 30, weight: 30 }, { name: "Final", max: 50, weight: 50 }];
  const results = [];
  assignments.forEach((a, ai) => {
    const published = ai % 3 !== 2;
    studentsBySection[a.section].forEach((s, si) => {
      // Ability per student, nudged per subject; the three story students are pinned.
      let ability = 0.52 + rnd(si * 7 + a.section.length) * 0.42 + (rnd(ai * 13 + si) - 0.5) * 0.14;
      if (String(s._id) === String(star._id)) ability = 0.93;
      if (String(s._id) === String(struggling._id)) ability = ai % 2 ? 0.36 : 0.47;
      if (String(s._id) === String(watch._id)) ability = 0.6;
      ability = Math.max(0.2, Math.min(0.98, ability));
      const marks = Object.fromEntries(components.map((c, ci) => [c.name, Math.round(c.max * Math.max(0.1, Math.min(1, ability + (rnd(si * 31 + ai * 17 + ci) - 0.5) * 0.16)) * 2) / 2]));
      const percentage = Math.round(components.reduce((t, c) => t + (marks[c.name] / c.max) * c.weight, 0) * 100) / 100;
      const g = gradeFor(percentage, DEFAULT_GRADING_SCHEME);
      results.push({
        student: s._id, teacherAssignment: a.doc._id, academicSession: session._id, program: a.doc.program, section: a.doc.section, subject: a.doc.subject,
        creditHours: 3, marks, percentage, grade: g.grade, gradePoint: g.points, published, publishedAt: published ? ago(4) : null,
      });
    });
  });
  await GradebookConfig.insertMany(assignments.map(a => ({ teacherAssignment: a.doc._id, components })));
  await CourseResult.insertMany(results);
  log(`Results: ${results.length} course results (${results.filter(r => r.published).length} published, rest awaiting publication)`);

  // ── Coursework: submissions, grading, an online quiz ───────────────────
  const coursework = await Assignment.find({ teacherAssignment: { $in: assignments.map(a => a.doc._id) } });
  const submissions = [];
  for (const cw of coursework) {
    const a = assignments.find(x => String(x.doc._id) === String(cw.teacherAssignment));
    const overdue = cw.dueDate < new Date();
    studentsBySection[a.section].forEach((s, si) => {
      const id = String(s._id);
      if (id === String(struggling._id)) return;                       // hands nothing in
      if (!overdue && rnd(si * 5 + cw.title.length) > 0.45) return;    // upcoming work: under half done so far
      if (overdue && rnd(si * 11 + 3) > 0.88) return;
      const graded = overdue && rnd(si * 3 + 1) > 0.35;
      submissions.push({
        assignment: cw._id, student: s._id, text: "Solutions attached in the linked document. Q3 uses the approach from Lecture 5.", link: "https://example.com/demo-submission",
        submittedAt: overdue ? new Date(cw.dueDate.getTime() - (rnd(si) * 2 - 0.3) * DAY) : ago(1), late: overdue && rnd(si) < 0.15,
        marks: graded ? Math.round((cw.totalMarks || 20) * (0.55 + rnd(si * 9) * 0.42)) : null, feedback: graded ? "Good work — check the edge cases in your last answer." : "", gradedAt: graded ? ago(1) : null,
      });
    });
  }
  await Submission.insertMany(submissions);

  const bank = [
    { text: "Which data structure works on the Last-In-First-Out principle?", options: ["Queue", "Stack", "Heap", "Graph"], correctIndex: 1, marks: 2 },
    { text: "What is the worst-case time complexity of binary search on a sorted array?", options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"], correctIndex: 1, marks: 2 },
    { text: "Which traversal of a binary search tree visits keys in sorted order?", options: ["Pre-order", "Post-order", "In-order", "Level-order"], correctIndex: 2, marks: 2 },
    { text: "A hash table resolves collisions by chaining. What does each bucket hold?", options: ["A single key", "A linked list of entries", "A binary heap", "Nothing"], correctIndex: 1, marks: 2 },
    { text: "Which structure is best suited to implementing a priority queue?", options: ["Stack", "Array list", "Heap", "Trie"], correctIndex: 2, marks: 2 },
  ];
  const quizzes = await Quiz.find({ teacherAssignment: { $in: assignments.map(a => a.doc._id) } });
  const attempts = [];
  for (const q of quizzes) {
    const a = assignments.find(x => String(x.doc._id) === String(q.teacherAssignment));
    const live = a.section === "DEMO-BSAI-A" && a.subject === "DEMO-CS201"; // the one quiz left open for the demo student to take
    if (!live && a.section !== "DEMO-BSAI-B") continue;                    // the rest stay "held in class"
    q.questions = bank; q.totalMarks = 10; q.scheduledAt = ago(live ? 1 : 6); q.closesAt = live ? ahead(5) : ago(2);
    q.title = live ? "Quiz 1: Stacks, Queues & Trees (Online)" : q.title;
    await q.save();
    if (live) continue;
    studentsBySection[a.section].forEach((s, si) => {
      const answers = bank.map((b, bi) => (rnd(si * 7 + bi * 3) < 0.7 ? b.correctIndex : (b.correctIndex + 1) % 4));
      attempts.push({ quiz: q._id, student: s._id, startedAt: ago(5), submittedAt: ago(5), answers, maxScore: 10, score: answers.reduce((t, x, bi) => t + (x === bank[bi].correctIndex ? 2 : 0), 0) });
    });
  }
  await QuizAttempt.insertMany(attempts);
  log(`LMS: ${submissions.length} submissions (${submissions.filter(s => s.gradedAt).length} graded) · online quiz open for BS AI-A · ${attempts.length} auto-graded attempts`);

  // ── Finance ────────────────────────────────────────────────────────────
  const structure = await FeeStructure.create({ name: "DEMO Semester Fee — Fall 2026", frequency: "semester", items: [
    { title: "Tuition Fee", category: "tuition", amount: 85000 }, { title: "Lab & Computing Fee", category: "lab", amount: 8000 }, { title: "Library Fee", category: "library", amount: 2000 },
  ] });
  const scholars = [[star, "Dean's Merit Scholarship", "merit", 50], [all[10], "Need-based Grant", "need", 30], [all[17], "Sports Excellence Award", "sports", 25]];
  await Scholarship.insertMany(scholars.map(([s, title, kind, value]) => ({ student: s._id, title, kind, type: "percent", value, appliesTo: ["tuition"], status: "active" })));
  const scholarPct = new Map(scholars.map(([s, title, , value]) => [String(s._id), { title, value }]));
  const methods = ["bank", "cash", "online", "bank", "card"];
  const fees = [];
  for (let i = 0; i < all.length; i++) {
    const s = all[i], id = String(s._id);
    // paid in full / part-paid / nothing paid — with the story students pinned
    let mode = i % 5 === 3 ? "none" : i % 5 === 1 ? "partial" : "full";
    if (id === String(star._id)) mode = "full";
    if (id === String(struggling._id)) mode = "none";
    if (id === String(watch._id)) mode = "partial";
    for (const item of structure.items) {
      const sch = item.category === "tuition" ? scholarPct.get(id) : null;
      const discount = sch ? (item.amount * sch.value) / 100 : 0;
      const net = item.amount - discount;
      const payments = [];
      const pay = async (amount, daysAgo) => payments.push({ amount, method: methods[i % methods.length], reference: methods[i % methods.length] === "cash" ? "" : `TXN-${100000 + i * 37 + payments.length}`, receiptNo: await nextCode("RCP", "receipt", 6), paidOn: ago(daysAgo), receivedBy: `accounts.demo@${DEMO_DOMAIN}` });
      if (mode === "full") { if (item.category === "tuition") { await pay(Math.round(net / 2), 55); await pay(net - Math.round(net / 2), i % 2 ? 24 : 4); } else await pay(net, 40 - (i % 20)); }
      if (mode === "partial" && item.category === "tuition") await pay(Math.round(net * 0.4), 30);
      if (mode === "partial" && item.category !== "tuition") await pay(net, 30);
      const paidAmount = payments.reduce((t, p) => t + p.amount, 0);
      fees.push({
        studentId: s._id, title: item.title, amount: item.amount, category: item.category, dueDate: ago(18), period: "Fall 2026", structure: structure._id,
        discount, discountNote: sch?.title || "", payments, paidAmount,
        status: paidAmount >= net ? "paid" : paidAmount > 0 ? "partial" : "overdue", paidOn: paidAmount >= net ? payments[payments.length - 1].paidOn : null,
      });
    }
    // Next instalment, not yet due — gives every student something upcoming.
    fees.push({ studentId: s._id, title: "Examination Fee", amount: 3500, category: "exam", dueDate: ahead(6), period: "Fall 2026", status: "unpaid" });
  }
  const feeDocs = await Fee.insertMany(fees);
  const claimable = feeDocs.filter(f => f.title === "Tuition Fee" && f.status !== "paid");
  await PaymentClaim.insertMany([
    { fee: claimable[0]._id, student: claimable[0].studentId, amount: 40000, method: "bank", reference: "HBL-DEP-448120", paidOn: ago(2), note: "Deposited at HBL Gulberg branch", submittedByRole: "student" },
    { fee: claimable[2]._id, student: claimable[2].studentId, amount: 25000, method: "online", reference: "EP-TXN-99231775", paidOn: ago(1), submittedByRole: "student" },
  ]);
  const months = [3, 2, 1, 0];
  const expenses = [];
  months.forEach(m => {
    const d = new Date(); d.setMonth(d.getMonth() - m); d.setDate(8);
    expenses.push(
      { title: "Electricity & Gas", category: "utilities", amount: 185000 + m * 9000, date: d, paidTo: "LESCO / SNGPL", method: "bank", reference: `DEMO-UTIL-${m}` },
      { title: "Internet & Software Licences", category: "it", amount: 96000, date: d, paidTo: "PTCL / Microsoft", method: "bank", reference: `DEMO-IT-${m}` },
      { title: "Building Maintenance", category: "maintenance", amount: 60000 + (m % 2) * 45000, date: d, paidTo: "Al-Noor Contractors", method: "cheque", reference: `DEMO-MNT-${m}` },
    );
  });
  expenses.push({ title: "Orientation Day & Sports Gala", category: "events", amount: 240000, date: ago(40), paidTo: "Various vendors", method: "bank", reference: "DEMO-EVT-1" },
    { title: "Lab Consumables & Stationery", category: "supplies", amount: 78000, date: ago(12), paidTo: "Paper House", method: "cash", reference: "DEMO-SUP-1" });
  await Expense.insertMany(expenses.map(e => ({ ...e, recordedBy: `accounts.demo@${DEMO_DOMAIN}` })));
  log(`Finance: ${feeDocs.length} fee lines · 3 scholarships · 2 payment claims awaiting verification · ${expenses.length} expenses`);

  // ── HR & payroll ───────────────────────────────────────────────────────
  const depts = await Department.insertMany([
    { name: "Computer Science", code: "DEMO-CS", kind: "academic", head: "Dr. Ahmed Khan" }, { name: "Mathematics", code: "DEMO-MATH", kind: "academic", head: "Ayesha Malik" },
    { name: "Administration", code: "DEMO-ADM", kind: "administrative", head: "Rashid Mehmood" }, { name: "Campus Services", code: "DEMO-SVC", kind: "support", head: "Nadia Karim" },
  ]);
  const D = Object.fromEntries(depts.map(d => [d.code, d._id]));
  const teacherStaff = Object.entries(teachers).map(([slug, t], i) => ({
    name: t.name, email: t.email, designation: i === 0 ? "Associate Professor" : i < 3 ? "Assistant Professor" : "Lecturer", department: ["ayesha.malik", "usman.tariq"].includes(slug) ? D["DEMO-MATH"] : D["DEMO-CS"],
    category: "teaching", teacher: t._id, qualification: i === 0 ? "PhD Computer Science" : "MS", basicSalary: [185000, 150000, 150000, 120000, 110000][i],
    allowances: [{ label: "House Rent", amount: 30000 }, { label: "Conveyance", amount: 12000 }], deductions: [{ label: "Income Tax", amount: 9500 }, { label: "Provident Fund", amount: 6000 }],
  }));
  const otherStaff = [
    ["Rashid Mehmood", "Registrar", "DEMO-ADM", "management", 165000], ["Farah Naz", "Accounts Officer", "DEMO-ADM", "administrative", 95000], ["Imran Sheikh", "Librarian", "DEMO-SVC", "administrative", 82000],
    ["Nadia Karim", "Hostel Warden", "DEMO-SVC", "support", 70000], ["Kashif Ali", "IT Support Engineer", "DEMO-SVC", "support", 88000], ["Ghulam Rasool", "Transport Supervisor", "DEMO-SVC", "support", 58000],
  ].map(([name, designation, dept, category, basicSalary]) => ({
    name, designation, department: D[dept], category, basicSalary, email: `${name.toLowerCase().replace(/\s+/g, ".")}@${DEMO_DOMAIN}`,
    allowances: [{ label: "House Rent", amount: Math.round(basicSalary * 0.15) }], deductions: [{ label: "Income Tax", amount: Math.round(basicSalary * 0.04) }],
  }));
  const staffDocs = [];
  for (const s of [...teacherStaff, ...otherStaff]) staffDocs.push(await Staff.create({ ...s, employeeId: await nextCode("EMP", "staff", 4), joinDate: new Date(2021 + (staffDocs.length % 5), staffDocs.length % 12, 1), bankName: "HBL", bankAccount: `0042-7900${1000 + staffDocs.length}` }));
  const workdays = [];
  for (let d = new Date(), n = 0; workdays.length < 12 && n < 30; d = new Date(d.getTime() - DAY), n++) if (d.getDay() !== 0 && d.getDay() !== 6) workdays.push(iso(d));
  const staffAtt = [];
  staffDocs.forEach((s, si) => workdays.forEach((date, di) => {
    const r = rnd(si * 19 + di * 7);
    staffAtt.push({ staff: s._id, date, status: r < 0.9 ? "present" : r < 0.94 ? "leave" : r < 0.97 ? "half_day" : "absent" });
  }));
  await StaffAttendance.insertMany(staffAtt);
  const sum = (l) => l.reduce((t, x) => t + x.amount, 0);
  // Built from local year/month — toISOString() would shift the 1st of the
  // month back a day (and a month) in any timezone ahead of UTC.
  const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const now = new Date();
  const months2 = [ym(new Date(now.getFullYear(), now.getMonth() - 1, 1)), ym(now)];
  const slips = [];
  months2.forEach((month, mi) => staffDocs.forEach(s => {
    const absentDays = staffAtt.filter(a => String(a.staff) === String(s._id) && a.date.startsWith(month)).reduce((t, a) => t + (a.status === "absent" ? 1 : a.status === "half_day" ? 0.5 : 0), 0);
    const gross = s.basicSalary + sum(s.allowances), absenceDeduction = Math.round((s.basicSalary / 30) * absentDays);
    slips.push({ staff: s._id, month, basic: s.basicSalary, allowances: s.allowances, deductions: s.deductions, absentDays, absenceDeduction, gross, net: gross - sum(s.deductions) - absenceDeduction, status: mi === 0 ? "paid" : "generated", paidOn: mi === 0 ? ago(12) : null, method: mi === 0 ? "bank" : "" });
  }));
  await Payslip.insertMany(slips);
  await Expense.create({ title: `Payroll ${months2[0]} (${staffDocs.length} staff)`, category: "salaries", amount: slips.filter(p => p.month === months2[0]).reduce((t, p) => t + p.net, 0), date: ago(12), method: "bank", reference: `DEMO-PAYROLL-${months2[0]}`, recordedBy: `accounts.demo@${DEMO_DOMAIN}` });
  await StaffLeave.insertMany([
    { staff: staffDocs[3]._id, type: "sick", from: ahead(2), to: ahead(3), reason: "Medical procedure", status: "pending" },
    { staff: staffDocs[7]._id, type: "annual", from: ahead(10), to: ahead(14), reason: "Family travel", status: "pending" },
    { staff: staffDocs[1]._id, type: "casual", from: ago(9), to: ago(9), reason: "Personal work", status: "approved", reviewedBy: demoAdmin.email },
  ]);
  log(`HR: ${depts.length} departments · ${staffDocs.length} staff · ${staffAtt.length} attendance marks · payroll ${months2[0]} paid, ${months2[1]} awaiting payment`);

  // ── Library ────────────────────────────────────────────────────────────
  const books = await Book.insertMany([
    ["Introduction to Algorithms", "Cormen, Leiserson, Rivest, Stein", "Computer Science", 4], ["Artificial Intelligence: A Modern Approach", "Russell & Norvig", "Artificial Intelligence", 3],
    ["Database System Concepts", "Silberschatz, Korth, Sudarshan", "Computer Science", 3], ["Clean Code", "Robert C. Martin", "Software Engineering", 2],
    ["Design Patterns", "Gamma, Helm, Johnson, Vlissides", "Software Engineering", 2], ["Discrete Mathematics and Its Applications", "Kenneth H. Rosen", "Mathematics", 4],
    ["Probability and Statistics for Engineers", "Walpole, Myers", "Mathematics", 3], ["Operating System Concepts", "Silberschatz, Galvin", "Computer Science", 3],
    ["Computer Networking: A Top-Down Approach", "Kurose & Ross", "Computer Science", 2], ["Deep Learning", "Goodfellow, Bengio, Courville", "Artificial Intelligence", 2],
    ["The Pragmatic Programmer", "Hunt & Thomas", "Software Engineering", 2], ["Calculus: Early Transcendentals", "James Stewart", "Mathematics", 5],
  ].map(([title, author, category, copies], i) => ({ title, author, category, copies, available: copies, isbn: `DEMO-978-${1000 + i}`, shelf: `${category[0]}${1 + (i % 4)}-${10 + i}`, year: 2012 + (i % 10), publisher: "Demo Press" })));
  const loans = [
    [0, star, 6, 8, null], [1, struggling, 30, -16, null], [2, watch, 25, -11, null], [5, all[9], 4, 10, null], [3, all[12], 9, 5, null], [9, all[20], 3, 11, null],
    [6, all[4], 40, -26, 22], [7, all[15], 35, -21, 20], [4, star, 50, -36, 38],
  ];
  const issueDocs = [];
  for (const [bi, s, issuedAgo, dueIn, returnedAgo] of loans) {
    const dueOn = ahead(dueIn), returnedOn = returnedAgo != null ? ago(returnedAgo) : null;
    const lateDays = returnedOn ? Math.max(0, Math.floor((returnedOn - dueOn) / DAY)) : 0;
    issueDocs.push({ book: books[bi]._id, student: s._id, issuedOn: ago(issuedAgo), dueOn, returnedOn, status: returnedOn ? "returned" : "issued", fine: lateDays * 10, finePaid: lateDays === 0, issuedBy: `library.demo@${DEMO_DOMAIN}` });
    if (!returnedOn) await Book.updateOne({ _id: books[bi]._id }, { $inc: { available: -1 } });
  }
  await BookIssue.insertMany(issueDocs);
  log(`Library: ${books.length} titles · ${issueDocs.length} loans (2 overdue, 1 unpaid fine)`);

  // ── Campus services ────────────────────────────────────────────────────
  const routes = await TransportRoute.insertMany([
    { name: "DEMO Route 1 — Gulberg / Model Town", vehicleNo: "LEA-4471", driverName: "Muhammad Aslam", driverPhone: "+92 300-5550101", capacity: 40, monthlyFare: 6500, stops: "Liberty Chowk, Model Town Link Road, Kalma Chowk, Campus" },
    { name: "DEMO Route 2 — Johar Town / Wapda Town", vehicleNo: "LEB-2290", driverName: "Shahid Iqbal", driverPhone: "+92 300-5550102", capacity: 6, monthlyFare: 7000, stops: "Emporium Mall, Wapda Town Roundabout, Shaukat Khanum, Campus" },
  ]);
  await TransportAssignment.insertMany(all.filter((_, i) => i % 3 === 0).map((s, i) => ({ student: s._id, route: routes[i < 5 ? 1 : 0]._id, stop: i < 5 ? "Emporium Mall" : "Kalma Chowk", since: new Date("2026-08-05") })));
  const hostel = await Hostel.insertMany([{ name: "DEMO Jinnah Hall", type: "boys", warden: "Nadia Karim", wardenPhone: "+92 300-5550201" }, { name: "DEMO Fatima Hall", type: "girls", warden: "Saira Bano", wardenPhone: "+92 300-5550202" }]);
  const hostelRooms = await HostelRoom.insertMany(hostel.flatMap((h, hi) => [101, 102, 103, 201].map((n, i) => ({ hostel: h._id, number: String(n), floor: String(Math.floor(n / 100)), capacity: 2, monthlyRent: 12000, status: hi === 1 && i === 3 ? "maintenance" : "available" }))));
  const boys = all.filter((_, i) => i % 2 === 1), girls = all.filter((_, i) => i % 2 === 0);
  await HostelAllocation.insertMany([
    ...boys.slice(0, 5).map((s, i) => ({ student: s._id, room: hostelRooms[Math.floor(i / 2)]._id, from: new Date("2026-08-03") })),
    ...girls.slice(1, 4).map((s, i) => ({ student: s._id, room: hostelRooms[4 + Math.floor(i / 2)]._id, from: new Date("2026-08-03") })),
  ]);
  await Asset.insertMany([
    ["Dell OptiPlex Desktop", "it_equipment", "DEMO Computer Lab 1", 35, 145000, "good"], ["Epson Multimedia Projector", "it_equipment", "Academic Block A", 6, 180000, "good"],
    ["Student Chair with Writing Pad", "furniture", "Academic Blocks", 320, 6500, "good"], ["Split AC 1.5 Ton", "other", "Academic Block B", 14, 210000, "fair"],
    ["Oscilloscope 100MHz", "lab_equipment", "Physics Lab", 8, 95000, "needs_repair"], ["Toyota Coaster (Staff Bus)", "vehicle", "Transport Yard", 2, 14500000, "good"],
    ["Whiteboard 6x4 ft", "furniture", "Academic Blocks", 22, 9000, "good"], ["Cricket & Football Kit", "sports", "Sports Room", 12, 18000, "fair"],
  ].map(([name, category, location, quantity, unitCost, condition], i) => ({ name, category, location, quantity, unitCost, condition, tag: `DEMO-AST-${String(i + 1).padStart(3, "0")}`, purchaseDate: new Date(2022 + (i % 4), i % 12, 10) })));
  await Visitor.insertMany([
    { name: "Tariq Fatima", phone: "+92 301-5550301", purpose: "Fee query", toMeet: "Accounts Office", badgeNo: "DEMO-V-041", checkIn: new Date(Date.now() - 2 * 3600000) },
    { name: "Engr. Salman Haider", phone: "+92 301-5550302", purpose: "Guest lecture on cloud computing", toMeet: "Dr. Ahmed Khan", badgeNo: "DEMO-V-042", checkIn: new Date(Date.now() - 3600000) },
    { name: "TCS Courier", purpose: "Document delivery", toMeet: "Registrar Office", badgeNo: "DEMO-V-040", checkIn: ago(1), checkOut: new Date(ago(1).getTime() + 900000) },
    { name: "HEC Inspection Team", purpose: "Programme accreditation visit", toMeet: "Registrar", badgeNo: "DEMO-V-039", checkIn: ago(3), checkOut: new Date(ago(3).getTime() + 5 * 3600000) },
  ]);
  log(`Campus: 2 transport routes (Route 2 nearly full) · 2 hostels, 8 rooms · 8 asset lines · visitor log`);

  // ── Calendar ───────────────────────────────────────────────────────────
  const examStart = onDay(9), examEnd = onDay(20);
  await CalendarEvent.insertMany([
    { title: "Midterm Examinations", type: "exam", start: examStart, end: examEnd, audience: "all", description: `Midterm week — see your datesheet. ${TAG}` },
    { title: "Iqbal Day", type: "holiday", start: onDay(13), audience: "all", description: `Public holiday. ${TAG}` },
    { title: "Last date for fee submission", type: "deadline", start: onDay(6), audience: "students", description: `Examination fee due. ${TAG}` },
    { title: "Faculty Board Meeting", type: "meeting", start: onDay(3), audience: "teachers", location: "Conference Room", description: `Agenda: midterm arrangements. ${TAG}` },
    { title: "Parent–Teacher Meeting", type: "meeting", start: onDay(24), audience: "parents", location: "DEMO Auditorium", description: `Midterm results discussion. ${TAG}` },
    { title: "Tech Fest & Project Exhibition", type: "event", start: onDay(31), end: onDay(32), audience: "all", location: "Main Lawn", description: `Annual student showcase. ${TAG}` },
    { title: "Fall Semester Begins", type: "term", start: new Date("2026-08-03"), audience: "all", description: `Start of classes. ${TAG}` },
    { title: "Orientation Day", type: "event", start: onDay(-40), audience: "students", location: "DEMO Auditorium", description: `Welcome for new students. ${TAG}` },
  ]);

  // ── Exam session with generated datesheet (published) ──────────────────
  const exam = await ExamSession.create({ name: "Midterm — Fall 2026", kind: "midterm", academicSession: session._id, startDate: examStart, endDate: examEnd, status: "published", instructions: "Reach the examination hall 15 minutes early. Mobile phones and smart watches are not allowed. Bring your own stationery." });
  const examDates = [];
  for (let d = new Date(examStart); d <= examEnd; d = new Date(d.getTime() + DAY)) if (d.getUTCDay() !== 0 && iso(d) !== iso(onDay(13))) examDates.push(iso(d));
  const plan = planExams({ papers: work.map(w => ({ ...w })), rooms, dates: examDates, slots: exam.slots, invigilators: Object.values(teachers).map(t => t._id) });
  await ExamPaper.insertMany(plan.placed.map(p => ({
    examSession: exam._id, teacherAssignment: p.paper._id, subject: p.paper.subject, section: p.paper.section, program: p.paper.program, date: p.date, startTime: p.startTime, endTime: p.endTime, room: p.room._id, invigilator: p.invigilator,
    seats: [...studentsBySection[Object.keys(sections).find(c => String(sections[c]._id) === String(p.paper.section))]].sort((x, y) => x.rollNo.localeCompare(y.rollNo)).map((s, i) => ({ student: s._id, seatNo: i + 1 })),
  })));
  log(`Exams: “${exam.name}” — ${plan.placed.length} papers scheduled clash-free, published with seating`);

  // ── Teacher evaluation ─────────────────────────────────────────────────
  const survey = await Survey.create({ title: "Fall 2026 Teacher Evaluation", academicSession: session._id, status: "open", closesOn: ahead(14) });
  const comments = ["Explains difficult topics with clear examples.", "Would like more practice problems before quizzes.", "Very approachable and always answers questions.", "Sometimes the pace is too fast.", "Assignments are returned quickly with useful feedback.", ""];
  const responses = [];
  assignments.forEach((a, ai) => {
    const base = 3.4 + rnd(ai * 5) * 1.3;
    for (let k = 0; k < 5; k++) responses.push({
      survey: survey._id, teacherAssignment: a.doc._id, teacher: a.doc.teacher, responderKey: crypto.randomBytes(16).toString("hex"),
      ratings: survey.questions.map((_, qi) => Math.max(1, Math.min(5, Math.round(base + (rnd(ai * 11 + k * 3 + qi) - 0.5) * 1.6)))), comment: comments[(ai + k) % comments.length],
    });
  });
  await SurveyResponse.insertMany(responses);

  // ── Admissions pipeline ────────────────────────────────────────────────
  const stages = ["applied", "applied", "under_review", "under_review", "test_scheduled", "interview", "offered", "offered", "accepted", "rejected", "applied", "under_review"];
  const names = ["Sana Riaz", "Bilal Ashraf", "Maryam Zafar", "Usama Tahir", "Hadia Noor", "Saad Mehmood", "Eman Fatima", "Abdullah Shah", "Kinza Arif", "Haris Jamil", "Tooba Yasin", "Moiz Ahmed"];
  const programCodes = Object.keys(programs);
  for (let i = 0; i < names.length; i++) {
    const stage = stages[i], past = ["test_scheduled", "interview", "offered", "accepted", "rejected"].includes(stage);
    await Admission.create({
      applicationNo: await nextCode("APP", "admission"), name: names[i], email: `${names[i].toLowerCase().replace(/\s+/g, ".")}@${DEMO_DOMAIN}`, phone: `+92 33${i % 10}-55503${String(i).padStart(2, "0")}`,
      gender: i % 2 ? "male" : "female", city: cities[i % cities.length], dob: new Date(2007, i % 12, 5 + i), guardianName: `${["Khalid", "Shahida", "Anwar", "Rubina"][i % 4]} ${names[i].split(" ")[1]}`, guardianPhone: `+92 34${i % 10}-55504${String(i).padStart(2, "0")}`,
      program: programs[programCodes[i % programCodes.length]]._id, academicSession: session._id, previousInstitute: ["Punjab College", "Govt. College University", "Beaconhouse", "KIPS College"][i % 4],
      previousPercentage: 58 + Math.round(rnd(i * 3) * 38), testScore: past ? 45 + Math.round(rnd(i * 7) * 50) : null, interviewScore: ["offered", "accepted", "rejected"].includes(stage) ? 50 + Math.round(rnd(i * 13) * 45) : null,
      stage, source: i % 3 === 0 ? "online" : i % 3 === 1 ? "walk_in" : "referral", history: [{ stage: "applied", by: i % 3 === 0 ? "Applicant (online)" : demoAdmin.email, at: ago(20 - i) }, ...(stage !== "applied" ? [{ stage, by: demoAdmin.email, at: ago(8 - (i % 6)) }] : [])],
    });
  }

  // ── Helpdesk, records, certificates, alumni, interventions ─────────────
  const mkTicket = async (who, role, name, category, subject, description, priority, status, replies = []) => Ticket.create({
    ticketNo: await nextCode("TKT", "ticket"), raisedById: String(who._id), raisedByRole: role, raisedByName: name, category, subject, description, priority, status, replies, resolvedAt: status === "resolved" ? ago(1) : null,
  });
  await mkTicket(star, "student", `${star.name} (#${star.rollNo})`, "it", "Cannot connect to campus Wi-Fi in the library", "My laptop connects in the classrooms but the library access point keeps rejecting my student login since Monday.", "normal", "in_progress", [{ byRole: "admin", byName: demoAdmin.email, message: "Thanks for reporting — IT is resetting the library access point today. Please try again after 3 pm.", at: ago(1) }]);
  await mkTicket(struggling, "student", `${struggling.name} (#${struggling.rollNo})`, "fee", "Request for fee instalment plan", "Due to a family situation I cannot pay the full semester fee at once. Is it possible to pay in three instalments?", "high", "open");
  await mkTicket(all[9], "student", `${all[9].name} (#${all[9].rollNo})`, "facility", "Projector not working in Hall 102", "The projector in Hall 102 shuts off after ten minutes. Two lectures were affected this week.", "normal", "resolved", [{ byRole: "admin", byName: demoAdmin.email, message: "The lamp has been replaced. Please reopen if it happens again.", at: ago(1) }]);
  await mkTicket(teachers["sara.ahmed"], "teacher", "Sara Ahmed", "it", "Need MATLAB licence on lab PCs", "Computer Lab 1 machines 12–20 are missing the MATLAB licence needed for next week's lab.", "high", "open");
  if (strugglingParent) await mkTicket(strugglingParent, "parent", strugglingParent.name, "academic", "Concern about my son's attendance", "I received a notice that Hamza's attendance is low. I would like to meet his class teacher to understand the situation.", "normal", "open");

  await StudentRecord.insertMany([
    { student: struggling._id, kind: "discipline", title: "Repeated late arrival and missed labs", details: "Late to four consecutive morning classes; missed two lab sessions without notice.", severity: "major", actionTaken: "Written warning issued; parent informed.", date: ago(9), recordedBy: demoAdmin.email },
    { student: struggling._id, kind: "counselling", title: "Initial counselling session", details: "Student reports part-time work is affecting morning classes.", severity: "info", actionTaken: "Referred to student affairs for a fee instalment plan.", date: ago(6), recordedBy: demoAdmin.email },
    { student: star._id, kind: "achievement", title: "1st place — Inter-University Coding Competition", details: "Represented the institute at the regional ICPC warm-up round.", severity: "info", date: ago(15), recordedBy: demoAdmin.email },
    { student: all[11]._id, kind: "health", title: "Asthma — carries inhaler", details: "Parents have requested ground-floor classrooms where possible.", severity: "minor", date: ago(60), recordedBy: demoAdmin.email },
    { student: all[19]._id, kind: "achievement", title: "Captain, Institute Football Team", details: "", severity: "info", date: ago(30), recordedBy: demoAdmin.email },
  ]);
  await Certificate.create({ serialNo: await nextCode("BON", "cert-bonafide", 6), student: star._id, type: "bonafide", purpose: "bank account opening", issuedBy: demoAdmin.email, issuedOn: ago(7) });
  await Certificate.create({ serialNo: await nextCode("CHR", "cert-character", 6), student: all[8]._id, type: "character", purpose: "internship application", issuedBy: demoAdmin.email, issuedOn: ago(3) });
  await Alumni.insertMany([
    ["Hira Javed", "BS Computer Science", 2024, "Systems Limited", "Software Engineer", "Lahore", 3.71], ["Osama Saeed", "BS Computer Science", 2023, "Arbisoft", "Senior Data Engineer", "Lahore", 3.52],
    ["Anum Tahir", "BS Software Engineering", 2024, "10Pearls", "QA Automation Engineer", "Karachi", 3.38], ["Fahad Rauf", "BS Artificial Intelligence", 2025, "Careem", "ML Engineer", "Islamabad", 3.84],
  ].map(([name, program, graduationYear, currentOrganization, currentPosition, city, cgpa]) => ({ name, program, graduationYear, currentOrganization, currentPosition, city, cgpa, email: `${name.toLowerCase().replace(/\s+/g, ".")}@${DEMO_DOMAIN}`, notes: `Guest speaker volunteer ${TAG}` })));
  await Intervention.insertMany([
    { student: struggling._id, type: "parent_contact", notes: "Called the father — agreed to attend a meeting next week. Family is facing financial difficulty.", status: "done", byRole: "admin", byId: String(demoAdmin._id), byName: demoAdmin.email, createdAt: ago(5) },
    { student: struggling._id, type: "fee_plan", notes: "Proposed three instalments; awaiting accounts office approval.", followUpOn: ahead(3), status: "open", byRole: "admin", byId: String(demoAdmin._id), byName: demoAdmin.email },
  ]);

  // ── Degree requirements, cover and parent–teacher meetings ─────────────
  for (const p of Object.values(programs)) await Program.updateOne({ _id: p._id }, { requiredCredits: 130, durationTerms: 8 });
  // Sara Ahmed is away next Monday; her first period there is already covered.
  const nextMonday = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7)); return d.toISOString().slice(0, 10); })();
  const saraMonday = await TimetableEntry.find({ teacher: teachers["sara.ahmed"]._id, day: "Monday" }).sort({ startTime: 1 });
  const freeMonday = async (entry) => {
    for (const t of Object.values(teachers)) {
      if (String(t._id) === String(entry.teacher)) continue;
      const busy = await TimetableEntry.exists({ teacher: t._id, day: "Monday", startTime: { $lt: entry.endTime }, endTime: { $gt: entry.startTime } });
      if (!busy) return t;
    }
    return null;
  };
  if (saraMonday[0]) {
    const cover = await freeMonday(saraMonday[0]);
    if (cover) await Substitution.create({ date: nextMonday, entry: saraMonday[0]._id, absentTeacher: teachers["sara.ahmed"]._id, substitute: cover._id, reason: "Conference", note: "Continue from Chapter 5 — slides are on the shared drive.", arrangedBy: demoAdmin.email });
  }
  await StaffLeave.create({ staff: staffDocs[1]._id, type: "casual", from: new Date(nextMonday + "T00:00:00Z"), to: new Date(nextMonday + "T00:00:00Z"), reason: "Presenting at a conference", status: "approved", reviewedBy: demoAdmin.email });
  const slotDay = onDay(4);
  const slotRows = [];
  for (const [slug, hour] of [["ahmed.khan", 14], ["sara.ahmed", 15], ["bilal.hassan", 11]]) {
    for (let k = 0; k < 6; k++) {
      const start = new Date(slotDay.getTime() + (hour - 5) * 3600000 + k * 15 * 60000); // 5 h = PKT offset, so slots read as local afternoon/morning
      slotRows.push({ teacher: teachers[slug]._id, start, end: new Date(start.getTime() + 15 * 60000), mode: k % 3 === 2 ? "online" : "in_person", location: k % 3 === 2 ? "Google Meet link sent on booking" : "Staff Room, Block A" });
    }
  }
  const slotDocs = await MeetingSlot.insertMany(slotRows);
  if (strugglingParent) await MeetingSlot.updateOne({ _id: slotDocs[1]._id }, { status: "booked", parent: strugglingParent._id, student: struggling._id, agenda: "Attendance and the fee instalment request" });
  log(`Degree requirement 130 credit hours · substitute cover arranged for ${nextMonday} · ${slotDocs.length} parent-meeting slots (1 booked)`);

  // ── Inbox items for the people with demo logins ────────────────────────
  const note = (recipientType, recipientId, title, message, type, actionUrl, daysAgo = 0, isRead = false) => ({ recipientType, recipientId, title, message, type, actionUrl, icon: "bell", sender: `System ${TAG}`, sentAt: ago(daysAgo), isRead });
  await Notification.insertMany([
    note("student", star._id, "Midterm — Fall 2026 datesheet published", "Your exam schedule, room and seat numbers are available.", "exam", "/student/exams", 1),
    note("student", star._id, "Results published", "New course results have been published. Open your transcript to see your grades and GPA.", "grade", "/student/results", 4),
    note("student", star._id, "Payment received", "42,500 received for “Tuition Fee”. This fee is now fully paid.", "fee", "/student/fees", 24, true),
    note("student", struggling._id, "Fee payment overdue", "You have overdue fees. Please pay or submit your payment reference from the Fees page.", "fee", "/student/fees", 2),
    ...(strugglingParent ? [
      note("parent", strugglingParent._id, `${struggling.name}: Fee payment overdue`, "Semester fees are overdue. You can report a bank payment from the Fees tab.", "fee", "/parent/dashboard", 2),
      note("parent", strugglingParent._id, `${struggling.name}: Results published`, "New course results have been published.", "grade", "/parent/dashboard", 4),
    ] : []),
    note("teacher", teachers["ahmed.khan"]._id, "Midterm duties assigned", "Your papers and invigilation duties for Midterm — Fall 2026 are listed under Exam Duties.", "exam", "/teacher/exams", 1),
  ]);
  log(`Engagement: 12 applicants · 5 tickets · 5 student records · 2 certificates · 4 alumni · open teacher evaluation (${responses.length} responses)`);

  return { parentEmail: portalParents.find(p => String(p._id) === String(star.parentId))?.email, strugglingParentEmail: strugglingParent?.email, struggling, accountant: `accounts.demo@${DEMO_DOMAIN}`, librarian: `library.demo@${DEMO_DOMAIN}` };
}

// ══════════════════════════════════════════════════════════════════
//  Second demo institute + platform owner — shows that several
//  institutes share the platform without seeing each other's data.
// ══════════════════════════════════════════════════════════════════
export const DEMO_OWNER_EMAIL = "owner@demo.acadexa.test";
export const DEMO_OWNER_PASSWORD = "Demo@Owner2026";
export const RIVERSIDE_ADMIN = "admin@riverside.demo.acadexa.test";

export async function seedSecondInstitute() {
  const mongoose = (await import("mongoose")).default;
  const { Tenant, PlatformOwner } = await import("../src/models/Tenant.js");
  const { runAsTenant, runUnscoped } = await import("../src/tenancy/context.js");
  const { PLATFORM_MODELS } = await import("../src/tenancy/plugin.js");
  const AcademicSession = (await import("../src/models/AcademicSession.js")).default;
  const ProgramM = (await import("../src/models/Program.js")).default;
  const Section = (await import("../src/models/Section.js")).default;
  const Subject = (await import("../src/models/Subject.js")).default;
  const Teacher = (await import("../src/models/Teacher.js")).default;
  const TeacherAssignment = (await import("../src/models/TeacherAssignment.js")).default;
  const StudentEnrollment = (await import("../src/models/StudentEnrollment.js")).default;
  const { getSettings } = await import("../src/models/Settings.js");

  await PlatformOwner.updateOne({ email: DEMO_OWNER_EMAIL }, { $set: { password: await bcrypt.hash(DEMO_OWNER_PASSWORD, 10), name: "Platform Owner (Demo)" } }, { upsert: true });

  let t = await Tenant.findOne({ code: "RIVERSIDE" });
  if (!t) t = await Tenant.create({ code: "RIVERSIDE", name: "Riverside Public School", type: "school", plan: "basic", modules: ["admissions", "exams", "finance", "engage"], limits: { maxStudents: 300, maxTeachers: 25 }, contactName: "Mrs. Nadia Hameed", contactEmail: "principal@riverside.demo.acadexa.test" });
  // Wipe only this institute's records, then rebuild them.
  await runUnscoped(async () => {
    for (const name of mongoose.modelNames()) if (!PLATFORM_MODELS.has(name)) await mongoose.model(name).deleteMany({ tenant: t._id });
  });

  await runAsTenant(t, async () => {
    await Admin.create({ email: RIVERSIDE_ADMIN, password: "Demo@Riverside2026", isSuperAdmin: true, name: "Riverside Office" });
    const s = await getSettings(); s.instituteName = t.name; s.instituteType = "school"; s.currency = "₨"; await s.save();
    const session = await AcademicSession.create({ name: "2026-27", startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "active" });
    const grade = await ProgramM.create({ name: "Grade 8", code: "G8", academicSession: session._id });
    const section = await Section.create({ name: "A", code: "G8-A", program: grade._id, academicSession: session._id, capacity: 35 });
    const subjects = await Subject.insertMany([{ name: "Mathematics", code: "MATH8" }, { name: "English", code: "ENG8" }, { name: "General Science", code: "SCI8" }]);
    const teacher = await Teacher.create({ name: "Mr. Kamran Javed", email: "kamran@riverside.demo.acadexa.test", password: await bcrypt.hash("Demo@Teach2026", 10) });
    for (const sub of subjects) await TeacherAssignment.create({ teacher: teacher._id, academicSession: session._id, program: grade._id, section: section._id, subject: sub._id });
    const hash = await bcrypt.hash("Demo@Stu2026", 10);
    // The first roll number deliberately matches one in the DEMO institute:
    // identifiers only have to be unique inside an institute.
    const names = ["Ayaan Ahmed", "Hoorain Fatima", "Rayan Malik", "Zoha Imran", "Musa Qureshi", "Inaya Butt"];
    for (let i = 0; i < names.length; i++) {
      const st = await Student.create({ name: names[i], rollNo: i === 0 ? "DEMO-BSAI-A-001" : `RS-G8A-${String(i + 1).padStart(3, "0")}`, email: `${names[i].split(" ")[0].toLowerCase()}@riverside.demo.acadexa.test`, password: hash });
      const e = await StudentEnrollment.create({ student: st._id, academicSession: session._id, program: grade._id, section: section._id });
      await Student.updateOne({ _id: st._id }, { currentEnrollment: e._id });
      await Fee.create({ studentId: st._id, title: "Monthly Tuition — October", amount: 12000, category: "tuition", dueDate: onDay(10), period: "2026-10" });
    }
  });
  log(`Second institute: ${t.name} (code ${t.code}) · admin ${RIVERSIDE_ADMIN} / Demo@Riverside2026 · basic plan`);
  log(`Platform owner: ${DEMO_OWNER_EMAIL} / ${DEMO_OWNER_PASSWORD}`);
}
