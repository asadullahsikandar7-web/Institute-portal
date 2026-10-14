// ══════════════════════════════════════════════════════════════════
//  ACADEXA DEMO SEED — npm run seed:demo  /  npm run seed:demo:reset
// ══════════════════════════════════════════════════════════════════
// Every single record this script creates is reachable from one of two
// anchors: an email ending in DEMO_DOMAIN (.test is IANA-reserved for
// testing, RFC 2606 — it can never collide with a real institute's
// domain), or the academic session named exactly DEMO_SESSION_NAME. The
// reset command below deletes ONLY records reachable from those two
// anchors, in dependency order — nothing it touches can ever be a real
// record, and it will happily run against the same database your real
// admin/student accounts already live in without touching them.
//
// This script talks to whatever MONGO_URI your .env points at — same as
// the real server. There is no separate demo database configured for
// this project, so "safe" here means "clearly tagged and cleanly
// reversible," not "a different connection."
//
// Usage:
//   npm run seed:demo         seed the demo dataset (safe to re-run — it
//                              resets any previous demo data first)
//   npm run seed:demo:reset   remove the demo dataset only, seed nothing
import "../src/tenancy/register.js"; // institute isolation — must be the first import
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

import Admin from "../src/models/adminModel.js";
import Student from "../src/models/studentModel.js";
import Teacher from "../src/models/Teacher.js";
import Parent from "../src/models/Parent.js";
import AcademicSession from "../src/models/AcademicSession.js";
import Program from "../src/models/Program.js";
import Section from "../src/models/Section.js";
import Subject from "../src/models/Subject.js";
import TeacherAssignment from "../src/models/TeacherAssignment.js";
import StudentEnrollment from "../src/models/StudentEnrollment.js";
import SubjectAttendance from "../src/models/SubjectAttendance.js";
import Assignment from "../src/models/Assignment.js";
import Quiz from "../src/models/Quiz.js";
import AcademicAnnouncement from "../src/models/AcademicAnnouncement.js";
import ChatGroup from "../src/models/ChatGroup.js";
import GroupMessage from "../src/models/GroupMessage.js";
import Attendance from "../src/models/attendanceModel.js";
import Leave from "../src/models/leavemodel.js";
import Notification from "../src/models/notificationModel.js";
import { seedErp, resetErp, DEMO_PARENT_PASSWORD, DEMO_STAFF_PASSWORD, seedSecondInstitute, DEMO_OWNER_PASSWORD } from "./seedDemoErp.js";
import { Tenant } from "../src/models/Tenant.js";
import { runUnscoped } from "../src/tenancy/context.js";
import { resolveInstitute, inInstitute, instituteArg } from "./lib/institute.js";

const DEMO_DOMAIN = "demo.acadexa.test";
const DEMO_SESSION_NAME = "2026-27 (Demo)";
const RESET_ONLY = process.argv.includes("--reset");

const DEMO_ADMIN_PASSWORD   = "AcadexaDemo#2026";
const DEMO_TEACHER_PASSWORD = "Demo@Teach2026";
const DEMO_STUDENT_PASSWORD = "Demo@Stu2026";

function log(msg) { console.log(`  ${msg}`); }
function emailDomainFilter() { return { email: { $regex: `@${DEMO_DOMAIN}$`, $options: "i" } }; }

// ── Reset: delete only what's reachable from the two demo anchors ──────────
async function resetDemoData() {
  console.log("\n🧹 Removing any existing ACADEXA demo data…");

  const demoTeachers = await Teacher.find(emailDomainFilter()).select("_id");
  const demoStudents = await Student.find(emailDomainFilter()).select("_id");
  const demoParents  = await Parent.find(emailDomainFilter()).select("_id");
  const demoTeacherIds = demoTeachers.map(t => t._id);
  const demoStudentIds = demoStudents.map(s => s._id);
  const demoParentIds  = demoParents.map(p => p._id);

  const demoSessions = await AcademicSession.find({ name: DEMO_SESSION_NAME }).select("_id");
  const demoSessionIds = demoSessions.map(s => s._id);

  const demoPrograms = await Program.find({ $or: [
    { academicSession: { $in: demoSessionIds } },
    { code: { $regex: "^DEMO-" } },
  ] }).select("_id");
  const demoProgramIds = demoPrograms.map(p => p._id);

  const demoSections = await Section.find({ program: { $in: demoProgramIds } }).select("_id");
  const demoSectionIds = demoSections.map(s => s._id);

  const demoSubjects = await Subject.find({ code: { $regex: "^DEMO-" } }).select("_id");
  const demoSubjectIds = demoSubjects.map(s => s._id);

  const demoAssignments = await TeacherAssignment.find({ teacher: { $in: demoTeacherIds } }).select("_id");
  const demoAssignmentIds = demoAssignments.map(a => a._id);

  const demoGroups = await ChatGroup.find({ teacherAssignment: { $in: demoAssignmentIds } }).select("_id");
  const demoGroupIds = demoGroups.map(g => g._id);

  const results = {};
  // ERP + smart-layer demo data first — it references the students,
  // teachers and assignments deleted below.
  results.erp             = await resetErp({ studentIds: demoStudentIds, teacherIds: demoTeacherIds, parentIds: demoParentIds, sessionIds: demoSessionIds, assignmentIds: demoAssignmentIds });
  results.groupMessages   = (await GroupMessage.deleteMany({ group: { $in: demoGroupIds } })).deletedCount;
  results.chatGroups      = (await ChatGroup.deleteMany({ _id: { $in: demoGroupIds } })).deletedCount;
  results.announcements   = (await AcademicAnnouncement.deleteMany({ teacherAssignment: { $in: demoAssignmentIds } })).deletedCount;
  results.assignments     = (await Assignment.deleteMany({ teacherAssignment: { $in: demoAssignmentIds } })).deletedCount;
  results.quizzes         = (await Quiz.deleteMany({ teacherAssignment: { $in: demoAssignmentIds } })).deletedCount;
  results.subjectAtt      = (await SubjectAttendance.deleteMany({ teacherAssignment: { $in: demoAssignmentIds } })).deletedCount;
  results.teacherAssign   = (await TeacherAssignment.deleteMany({ _id: { $in: demoAssignmentIds } })).deletedCount;
  results.enrollments     = (await StudentEnrollment.deleteMany({ student: { $in: demoStudentIds } })).deletedCount;
  results.legacyAtt       = (await Attendance.deleteMany({ studentId: { $in: demoStudentIds } })).deletedCount;
  results.leaves          = (await Leave.deleteMany({ studentId: { $in: demoStudentIds } })).deletedCount;
  results.notifications   = (await Notification.deleteMany({ $or: [
    { recipientId: { $in: demoStudentIds } },
    { sender: { $regex: "\\(Demo\\)$" } },
  ] })).deletedCount;
  results.sections        = (await Section.deleteMany({ _id: { $in: demoSectionIds } })).deletedCount;
  results.programs        = (await Program.deleteMany({ _id: { $in: demoProgramIds } })).deletedCount;
  results.subjects        = (await Subject.deleteMany({ _id: { $in: demoSubjectIds } })).deletedCount;
  results.sessions        = (await AcademicSession.deleteMany({ _id: { $in: demoSessionIds } })).deletedCount;
  results.parents         = (await Parent.deleteMany({ _id: { $in: demoParentIds } })).deletedCount;
  results.students        = (await Student.deleteMany({ _id: { $in: demoStudentIds } })).deletedCount;
  results.teachers        = (await Teacher.deleteMany({ _id: { $in: demoTeacherIds } })).deletedCount;
  results.admin           = (await Admin.deleteMany(emailDomainFilter())).deletedCount;

  const total = Object.values(results).reduce((a, b) => a + b, 0);
  console.log(`✅ Removed ${total} demo records across ${Object.keys(results).length} collections.`);
  return results;
}

// ── Small deterministic helpers (no external random-name dependency) ───────
const WEEKDAY_MS = 86400000;
function schoolDaysBack(n) {
  // Last n weekdays (Mon-Fri) ending today, oldest first — realistic
  // attendance shouldn't include weekends.
  const days = [];
  let d = new Date();
  while (days.length < n) {
    if (d.getDay() !== 0 && d.getDay() !== 6) days.unshift(new Date(d));
    d = new Date(d.getTime() - WEEKDAY_MS);
  }
  return days.map(x => x.toISOString().split("T")[0]);
}
// Weighted realistic status — not every student is 100% present.
function weightedStatus(seed) {
  const r = seed % 100;
  if (r < 82) return "present";
  if (r < 93) return "absent";
  return "leave";
}
function pakPhone(i) { return `+92 3${(10 + (i % 40))}-${(1000000 + i * 137).toString().slice(0, 7)}`; }

async function seedDemoData() {
  console.log("\n🌱 Seeding ACADEXA demo data into", mongoose.connection.host, "/", mongoose.connection.name);

  // ── Admin ────────────────────────────────────────────────────────────
  // adminModel.js hashes the password itself via a pre("save") hook —
  // unlike Teacher/Student below, which hash in the route/script instead
  // (see Teacher.js's own comment on that split). Passing an
  // already-hashed string here would get hashed a second time and lock the
  // demo admin out entirely, so this one gets the plain password.
  const demoAdmin = await Admin.create({ email: `admin.demo@${DEMO_DOMAIN}`, password: DEMO_ADMIN_PASSWORD, isSuperAdmin: false });
  log(`Admin: ${demoAdmin.email}`);

  // ── Academic Session ────────────────────────────────────────────────
  const session = await AcademicSession.create({
    name: DEMO_SESSION_NAME, startDate: new Date("2026-08-01"), endDate: new Date("2027-05-31"),
    status: "active", createdBy: demoAdmin._id,
  });

  // ── Programs ─────────────────────────────────────────────────────────
  const programDefs = [
    { name: "BS Artificial Intelligence", code: "DEMO-BSAI" },
    { name: "BS Computer Science", code: "DEMO-BSCS" },
    { name: "BS Software Engineering", code: "DEMO-BSSE" },
  ];
  const programs = {};
  for (const p of programDefs) {
    programs[p.code] = await Program.create({ ...p, academicSession: session._id, status: "active" });
  }
  log(`Programs: ${programDefs.map(p => p.name).join(", ")}`);

  // ── Sections ─────────────────────────────────────────────────────────
  const sectionDefs = [
    { code: "DEMO-BSAI-A", name: "A", program: "DEMO-BSAI" },
    { code: "DEMO-BSAI-B", name: "B", program: "DEMO-BSAI" },
    { code: "DEMO-BSCS-A", name: "A", program: "DEMO-BSCS" },
  ];
  const sections = {};
  for (const s of sectionDefs) {
    sections[s.code] = await Section.create({
      name: s.name, code: s.code, program: programs[s.program]._id, academicSession: session._id,
      capacity: 40, status: "active",
    });
  }
  log(`Sections: BS AI-A, BS AI-B, BS CS-A`);

  // ── Subjects ─────────────────────────────────────────────────────────
  const subjectDefs = [
    { name: "Data Structures", code: "DEMO-CS201", creditHours: 3 },
    { name: "Object Oriented Programming", code: "DEMO-CS202", creditHours: 3 },
    { name: "Database Systems", code: "DEMO-CS301", creditHours: 3 },
    { name: "Artificial Intelligence", code: "DEMO-AI301", creditHours: 3 },
    { name: "Probability & Statistics", code: "DEMO-MATH201", creditHours: 3 },
    { name: "Discrete Structures", code: "DEMO-MATH101", creditHours: 3 },
    { name: "Software Engineering", code: "DEMO-SE301", creditHours: 3 },
  ];
  const subjects = {};
  for (const s of subjectDefs) subjects[s.code] = await Subject.create({ ...s, status: "active" });
  log(`Subjects: ${subjectDefs.length} created`);

  // ── Teachers ─────────────────────────────────────────────────────────
  const teacherDefs = [
    { name: "Ahmed Khan",    slug: "ahmed.khan" },
    { name: "Sara Ahmed",    slug: "sara.ahmed" },
    { name: "Bilal Hassan",  slug: "bilal.hassan" },
    { name: "Ayesha Malik",  slug: "ayesha.malik" },
    { name: "Usman Tariq",   slug: "usman.tariq" },
  ];
  const teacherHash = await bcrypt.hash(DEMO_TEACHER_PASSWORD, 10);
  const teachers = {};
  for (const t of teacherDefs) {
    teachers[t.slug] = await Teacher.create({
      name: t.name, email: `${t.slug}@${DEMO_DOMAIN}`, password: teacherHash, phone: pakPhone(t.slug.length), isActive: true,
    });
  }
  log(`Teachers: ${teacherDefs.map(t => t.name).join(", ")}`);

  // ── Teacher Assignments ──────────────────────────────────────────────
  const assignDefs = [
    { teacher: "ahmed.khan",   section: "DEMO-BSAI-A", subject: "DEMO-CS201" },
    { teacher: "sara.ahmed",   section: "DEMO-BSAI-A", subject: "DEMO-CS202" },
    { teacher: "bilal.hassan", section: "DEMO-BSAI-A", subject: "DEMO-AI301" },
    { teacher: "ayesha.malik", section: "DEMO-BSAI-A", subject: "DEMO-MATH201" },
    { teacher: "ahmed.khan",   section: "DEMO-BSAI-B", subject: "DEMO-CS201" },
    { teacher: "ayesha.malik", section: "DEMO-BSAI-B", subject: "DEMO-CS301" },
    { teacher: "sara.ahmed",   section: "DEMO-BSCS-A", subject: "DEMO-CS202" },
    { teacher: "usman.tariq",  section: "DEMO-BSCS-A", subject: "DEMO-MATH101" },
    { teacher: "bilal.hassan", section: "DEMO-BSCS-A", subject: "DEMO-SE301" },
  ];
  const assignments = [];
  for (const a of assignDefs) {
    const doc = await TeacherAssignment.create({
      teacher: teachers[a.teacher]._id, academicSession: session._id,
      program: sections[a.section].program, section: sections[a.section]._id, subject: subjects[a.subject]._id,
      status: "active", assignedBy: demoAdmin._id,
    });
    assignments.push({ ...a, doc });
  }
  log(`Teacher Assignments: ${assignments.length} created`);

  // ── Students + Parents + Enrollment ──────────────────────────────────
  const rosterDefs = {
    "DEMO-BSAI-A": ["Zainab Fatima","Hamza Yousuf","Mahnoor Iqbal","Ali Raza","Fatima Sheikh","Danish Aslam","Sana Pervez","Talha Rafiq"],
    "DEMO-BSAI-B": ["Iqra Nadeem","Hassan Butt","Amna Siddiqui","Faizan Qureshi","Rabia Chaudhry","Omar Farooq","Nimra Javed","Waqas Anwar"],
    "DEMO-BSCS-A": ["Areeba Khalid","Zohaib Mirza","Komal Aziz","Shahzaib Malik","Laiba Saleem","Adeel Rashid","Hira Bashir","Junaid Akhtar"],
  };
  const parentFirstNames = ["Tariq","Naveed","Shazia","Rizwan","Farzana","Imran","Nasreen","Javed","Saima","Aslam","Rukhsana","Yasir"];
  // sectionCode -> legacy free-text program name, for the pre-existing
  // Student.program string field (kept only for backward compatibility —
  // StudentEnrollment above is the real, authoritative link).
  const sectionProgramName = { "DEMO-BSAI-A": "BS Artificial Intelligence", "DEMO-BSAI-B": "BS Artificial Intelligence", "DEMO-BSCS-A": "BS Computer Science" };
  const studentHash = await bcrypt.hash(DEMO_STUDENT_PASSWORD, 10);
  const studentsBySection = {};
  let globalIdx = 0;

  for (const [sectionCode, names] of Object.entries(rosterDefs)) {
    studentsBySection[sectionCode] = [];
    for (let i = 0; i < names.length; i++) {
      globalIdx++;
      const [first, last] = names[i].split(" ");
      const slug = `${first.toLowerCase()}.${last.toLowerCase()}`;
      const rollNo = `${sectionCode}-${String(i + 1).padStart(3, "0")}`;
      const parentFirst = parentFirstNames[globalIdx % parentFirstNames.length];

      const parent = await Parent.create({
        name: `${parentFirst} ${last}`, phone: pakPhone(globalIdx),
        email: `${parentFirst.toLowerCase()}.${last.toLowerCase()}@${DEMO_DOMAIN}`, status: "active",
      });

      const student = await Student.create({
        name: names[i], email: `${slug}@${DEMO_DOMAIN}`, rollNo, registrationNo: `REG-${rollNo}`,
        password: studentHash, parentName: parent.name, parentEmail: parent.email, parentId: parent._id,
        program: sectionProgramName[sectionCode], isActive: true,
      });

      const enrollment = await StudentEnrollment.create({
        student: student._id, academicSession: session._id, program: sections[sectionCode].program,
        section: sections[sectionCode]._id, status: "active",
      });
      await Student.findByIdAndUpdate(student._id, { currentEnrollment: enrollment._id });

      studentsBySection[sectionCode].push(student);
    }
  }
  log(`Students: ${globalIdx} created across 3 sections, each with a linked parent`);

  // ── Subject attendance (last 10 school days, realistic variation) ──────
  const days = schoolDaysBack(10);
  const subjectAttDocs = [];
  for (const a of assignments) {
    const roster = studentsBySection[a.section];
    let seed = a.doc._id.toString().charCodeAt(0);
    for (const student of roster) {
      for (const date of days) {
        seed = (seed * 31 + date.length) % 1000;
        subjectAttDocs.push({
          student: student._id, academicSession: session._id, program: sections[a.section].program,
          section: sections[a.section]._id, subject: subjects[a.subject]._id, teacherAssignment: a.doc._id,
          markedBy: teachers[a.teacher]._id, date, status: weightedStatus(seed),
        });
      }
    }
  }
  await SubjectAttendance.insertMany(subjectAttDocs);
  log(`Subject attendance: ${subjectAttDocs.length} records over ${days.length} school days`);

  // ── Legacy (flat) attendance — same window, whole-day per student ──────
  const legacyAttDocs = [];
  const allStudents = Object.values(studentsBySection).flat();
  allStudents.forEach((student, i) => {
    days.forEach((date, di) => {
      legacyAttDocs.push({ studentId: student._id, date, status: weightedStatus((i + 1) * (di + 3) * 17) });
    });
  });
  await Attendance.insertMany(legacyAttDocs);
  log(`Legacy attendance: ${legacyAttDocs.length} records`);

  // ── Leaves — a handful, mixed statuses ──────────────────────────────
  // Status values are lowercase ("approved"/"rejected") to match what the
  // admin Leave Requests UI actually filters on (src/asad.jsx's
  // LeavePanelPage) — the model's own enum ("Approved"/"Rejected",
  // capitalized) is never enforced in practice because leaveroutes.js's
  // PATCH uses findByIdAndUpdate without runValidators, so the frontend's
  // lowercase convention is the real, working one. Worth reconciling in the
  // model itself later; the seed data has to match reality, not the
  // aspirational schema.
  const leaveDefs = [
    { student: allStudents[0], type: "Medical", from: days[2], to: days[2], reason: "Fever and flu", status: "approved" },
    { student: allStudents[3], type: "Family Emergency", from: days[5], to: days[6], reason: "Family wedding out of city", status: "approved" },
    { student: allStudents[7], type: "Medical", from: days[8], to: days[8], reason: "Dental appointment", status: "rejected" },
    { student: allStudents[12], type: "Medical", from: days[9], to: days[9], reason: "Not feeling well", status: "pending" },
    { student: allStudents[18], type: "casual", from: days[9], to: days[9], reason: "Family emergency", status: "pending" },
  ];
  for (const l of leaveDefs) {
    await Leave.create({ studentId: l.student._id, type: l.type, from: l.from, to: l.to, reason: l.reason, status: l.status, appliedAt: new Date() });
  }
  log(`Leave requests: ${leaveDefs.length} created (2 approved, 1 rejected, 2 pending)`);

  // ── Coursework + Quizzes ────────────────────────────────────────────
  let courseworkCount = 0, quizCount = 0;
  const inDays = n => new Date(Date.now() + n * WEEKDAY_MS);
  const courseworkTitles = ["Assignment 1: Fundamentals", "Assignment 2: Applied Problem Set"];
  const quizTitles = ["Quiz 1: Core Concepts", "Quiz 2: Midterm Prep"];
  for (const a of assignments) {
    await Assignment.create({
      teacherAssignment: a.doc._id, createdBy: teachers[a.teacher]._id,
      title: courseworkTitles[0], description: `Covers the first three weeks of ${subjectDefs.find(s=>s.code===a.subject).name}.`,
      dueDate: inDays(5), totalMarks: 20, status: "active",
    });
    await Assignment.create({
      teacherAssignment: a.doc._id, createdBy: teachers[a.teacher]._id,
      title: courseworkTitles[1], description: "Builds on lecture material — show your working.",
      dueDate: inDays(-2), totalMarks: 20, status: "active",
    });
    courseworkCount += 2;
    await Quiz.create({
      teacherAssignment: a.doc._id, createdBy: teachers[a.teacher]._id,
      title: quizTitles[0], description: "Short, closed-book.", scheduledAt: inDays(3), durationMinutes: 30, totalMarks: 10, status: "active",
    });
    quizCount += 1;
  }
  log(`Coursework: ${courseworkCount} assignments · Quizzes: ${quizCount}`);

  // ── Announcements (teacher, fanned into Notification like the real route) ─
  let annCount = 0, notifCount = 0;
  for (const a of assignments.slice(0, 4)) {
    const roster = studentsBySection[a.section];
    const title = "Class Update";
    const message = `Reminder: next class for ${subjectDefs.find(s=>s.code===a.subject).name} covers Chapter ${1 + (annCount % 5)}. Please review beforehand.`;
    await AcademicAnnouncement.create({ teacherAssignment: a.doc._id, createdBy: teachers[a.teacher]._id, title, message, recipientCount: roster.length });
    await Notification.insertMany(roster.map(s => ({
      recipientId: s._id, recipientType: "student", title, message, type: "announcement", sender: `${teacherDefs.find(t=>t.slug===a.teacher).name} (Demo)`, sentAt: new Date(),
    })));
    annCount++; notifCount += roster.length;
  }
  // one institute-wide admin announcement too
  await Notification.create({ recipientId: null, recipientType: "student", title: "Welcome to the new academic year", message: "Classes for 2026-27 begin Monday — please check your section and timetable.", type: "announcement", sender: "Admin (Demo)", sentAt: new Date() });
  log(`Announcements: ${annCount} class-level (${notifCount} notified) + 1 institute-wide`);

  // ── Academic chat groups, with a couple of seeded messages ─────────────
  let groupCount = 0, msgCount = 0;
  for (const a of assignments) {
    const group = await ChatGroup.create({ teacherAssignment: a.doc._id, createdBy: teachers[a.teacher]._id, mode: "teacher_all", status: "active" });
    groupCount++;
    if (groupCount <= 3) {
      const roster = studentsBySection[a.section];
      await GroupMessage.create({ group: group._id, sender: teachers[a.teacher]._id, senderModel: "Teacher", message: "Welcome to the group! Use this space for class questions and updates." });
      await GroupMessage.create({ group: group._id, sender: roster[0]._id, senderModel: "Student", message: "Thank you, sir/ma'am! Looking forward to the semester." });
      msgCount += 2;
    }
  }
  log(`Academic groups: ${groupCount} created (${msgCount} seed messages)`);

  // ── ERP + smart layer (finance, HR, library, exams, risk stories…) ──────
  const erp = await seedErp({ demoAdmin, session, programs, sections, subjects, teachers, assignments, studentsBySection, DEMO_DOMAIN });

  console.log("\n✅ Demo seed complete.\n");
  console.log("── Demo login credentials ──────────────────────────────────────────────");
  console.log(`  Admin (full)    ${demoAdmin.email}  /  ${DEMO_ADMIN_PASSWORD}`);
  console.log(`  Accountant      ${erp.accountant}  /  ${DEMO_STAFF_PASSWORD}   (finance + payroll only)`);
  console.log(`  Librarian       ${erp.librarian}  /  ${DEMO_STAFF_PASSWORD}   (library only)`);
  console.log(`  Teacher         ${teachers["ahmed.khan"].email}  /  ${DEMO_TEACHER_PASSWORD}`);
  console.log(`  Student         roll ${studentsBySection["DEMO-BSAI-A"][0].rollNo}  /  ${DEMO_STUDENT_PASSWORD}   (top of the class)`);
  console.log(`  Student at risk roll ${erp.struggling.rollNo}  /  ${DEMO_STUDENT_PASSWORD}   (low attendance, fees overdue)`);
  console.log(`  Parent          ${erp.strugglingParentEmail}  /  ${DEMO_PARENT_PASSWORD}   (parent of the at-risk student)`);
  console.log(`  Parent          ${erp.parentEmail}  /  ${DEMO_PARENT_PASSWORD}`);
  console.log("  (institute code DEMO — the default, so no code is needed on the login page)");
  console.log("─────────────────────────────────────────────────────────────────────────\n");
}

(async () => {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set — check backend/.env"); process.exit(1); }
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to ${mongoose.connection.host}/${mongoose.connection.name}`);
  try {
    // A brand-new database becomes a multi-institute demo: the main demo
    // university (code DEMO) plus a second institute to show isolation.
    // An existing single-institute database (no institutes yet) is seeded
    // exactly as before, unscoped.
    const fresh = !(await Tenant.exists({})) && !(await runUnscoped(async () => (await Admin.exists({})) || (await Student.exists({}))));
    const institute = fresh || instituteArg()
      ? await resolveInstitute({ code: instituteArg() || "DEMO", create: { name: "ACADEXA Demo University", type: "university" } })
      : await resolveInstitute();
    if (institute) console.log(`Institute: ${institute.name} (${institute.code})`);
    await inInstitute(institute, async () => {
      await resetDemoData();
      if (!RESET_ONLY) await seedDemoData();
    });
    if (!RESET_ONLY && institute && institute.code === "DEMO") await seedSecondInstitute();
  } catch (e) {
    console.error("❌ Seed failed:", e);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();


//i want to build something special so i never affoesd a ,essafe refordimg to thr poedennujnj jthrtr jjj jkrnr jke u5ihu5