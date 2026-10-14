// ══════════════════════════════════════════════════════════════════
//  API smoke test — npm run test:smoke
//
//  Starts ITS OWN copy of the server against a throwaway LOCAL MongoDB
//  and exercises every ERP module end to end, including the things that
//  must be refused. It never talks to a server it didn't start, and it
//  refuses to run unless the database is on this machine — the test
//  creates and deletes a lot of data.
//
//    mongod --dbpath /tmp/acadexa-smoke --port 27099      (in another terminal)
//    npm run test:smoke                                   (add -- --verbose to list every check)
//
//  SMOKE_MONGO_URI overrides the default mongodb://127.0.0.1:27099/….
// ══════════════════════════════════════════════════════════════════
import { spawn } from "child_process";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";

const MONGO = process.env.SMOKE_MONGO_URI || `mongodb://127.0.0.1:27099/acadexa_smoke_${Date.now()}`;
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(MONGO)) {
  console.error("Refusing to run: the smoke test only runs against a MongoDB on this machine (127.0.0.1 / localhost).");
  process.exit(1);
}
const freePort = () => new Promise(r => { const s = net.createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); }); });
const PORT = await freePort();
const backendDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const server = spawn(process.execPath, ["server.js"], {
  cwd: backendDir, stdio: ["ignore", "pipe", "pipe"],
  // Explicit env wins over backend/.env (dotenv never overrides), so this
  // child can't reach the real database or mail server.
  env: { ...process.env, MONGO_URI: MONGO, PORT: String(PORT), NODE_ENV: "development", SMTP_HOST: "127.0.0.1", SMTP_PORT: "1", VERCEL: "", DEFAULT_INSTITUTE_CODE: "", PLATFORM_OWNER_EMAIL: "owner@smoke.test", PLATFORM_OWNER_PASSWORD: "owner-pass-123" },
});
let serverLog = "";
server.stdout.on("data", d => { serverLog += d; });
server.stderr.on("data", d => { serverLog += d; });
const stop = (code) => { server.kill(); process.exit(code); };
process.on("SIGINT", () => stop(130));
server.on("exit", (code) => { if (code) { console.error("Test server exited early:\n" + serverLog.slice(-1500)); process.exit(1); } });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
let B = null;
for (let i = 0; i < 60 && !B; i++) {
  await new Promise(r => setTimeout(r, 500));
  for (const scheme of ["https", "http"]) {
    try {
      const r = await fetch(`${scheme}://127.0.0.1:${PORT}/health`);
      const j = await r.json();
      if (j.database === "connected") { B = `${scheme}://127.0.0.1:${PORT}`; break; }
    } catch { /* not up yet */ }
  }
}
if (!B) { console.error("Test server did not come up (is a local mongod running on the SMOKE_MONGO_URI port?)\n" + serverLog.slice(-1500)); stop(1); }
// Give the first-run auto-seed (default admin + sample students) time to finish.
await new Promise(r => setTimeout(r, 2500));
const VERBOSE = process.argv.includes("--verbose");

let pass = 0, fail = 0;
const call = async (method, path, body, token) => {
  const r = await fetch(B + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let data; try { data = await r.json(); } catch { data = null; }
  return { status: r.status, data };
};
const ok = (name, cond, extra) => { cond ? pass++ : fail++; if (!cond || VERBOSE) console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  → " + JSON.stringify(extra)?.slice(0, 400)}`); };
const tag = Date.now().toString().slice(-6);

const A = (await call("POST", "/api/auth/admin-login", { email: "admin1@uni.edu", password: "admin123" })).data.token;
ok("admin login", !!A);
const a = (m, p, b) => call(m, p, b, A);

// settings
let r = await a("GET", "/api/system/settings"); ok("settings get", r.status === 200 && r.data.gradingScheme.length === 10, r);
r = await a("PATCH", "/api/system/settings", { instituteName: "Test University", lateFeeType: "flat", lateFeeValue: 500, gradingScheme: [{ grade: "A", min: 80, points: 4 }] });
ok("settings rejects scheme w/o fail grade", r.status === 400, r);
r = await a("PATCH", "/api/system/settings", { instituteName: "Test University", lateFeeType: "flat", lateFeeValue: 500 }); ok("settings patch", r.data.instituteName === "Test University", r);
r = await call("GET", "/api/system/public"); ok("public branding", r.data.instituteName === "Test University" && r.data.lateFeeValue === undefined, r);

// academics setup
const session = (await a("POST", "/api/academic-sessions", { name: "S" + tag, startDate: "2026-09-01", endDate: "2027-06-30" })).data;
const program = (await a("POST", "/api/programs", { name: "BS Test " + tag, code: "BST" + tag })).data;
const sec1 = (await a("POST", "/api/sections", { name: "A", code: "A" + tag, program: program._id, academicSession: session._id, capacity: 2 })).data;
const sec2 = (await a("POST", "/api/sections", { name: "B", code: "B" + tag, program: program._id, academicSession: session._id, capacity: 5 })).data;
const subject = (await a("POST", "/api/subjects", { name: "Algo " + tag, code: "AL" + tag, creditHours: 4 })).data;
const teacher = (await a("POST", "/api/teachers", { name: "Teach " + tag, email: `t${tag}@x.edu`, password: "teachpass1" })).data;
ok("academic setup", session._id && program._id && sec1._id && sec2._id && subject._id && (teacher._id || teacher.teacher?._id), { session, program, sec1, subject, teacher });
const teacherId = teacher._id || teacher.teacher?._id;
const ta = (await a("POST", "/api/teacher-assignments", { teacher: teacherId, academicSession: session._id, program: program._id, section: sec1._id, subject: subject._id })).data;
ok("teacher assignment", !!ta._id, ta);

// admissions
r = await call("POST", "/api/admissions/apply", { name: "Applicant One", email: `app${tag}@x.com`, guardianName: "Guardian One", guardianEmail: `g${tag}@x.com`, program: program._id, previousPercentage: 80, stage: "enrolled", testScore: 100 });
ok("public apply", r.status === 201 && r.data.applicationNo, r);
const appNo = r.data.applicationNo;
r = await call("GET", "/api/admissions/track/" + appNo); ok("public track shows applied (stage not injectable)", r.data.stage === "applied", r);
r = await a("GET", "/api/admissions?q=" + appNo); const app = r.data[0]; ok("admission list + merit", app?.meritScore === 80 && app.testScore === null, app);
r = await a("POST", `/api/admissions/${app._id}/enroll`, { rollNo: "R" + tag, section: sec1._id }); ok("enroll blocked before offer", r.status === 400, r);
r = await a("PATCH", `/api/admissions/${app._id}`, { testScore: 90, interviewScore: 70 }); ok("merit recomputed", r.data.meritScore === 82, r.data);
r = await a("PATCH", `/api/admissions/${app._id}/stage`, { stage: "enrolled" }); ok("stage can't be set to enrolled directly", r.status === 400, r);
await a("PATCH", `/api/admissions/${app._id}/stage`, { stage: "offered" });
r = await a("POST", `/api/admissions/${app._id}/enroll`, { rollNo: "R" + tag, section: sec1._id });
ok("enroll converts → student", r.status === 201 && r.data.tempPassword?.length >= 8 && r.data.student.password === undefined, r);
const stu = r.data.student, stuPass = r.data.tempPassword;
r = await a("POST", `/api/admissions/${app._id}/enroll`, { rollNo: "R2" + tag }); ok("double enroll blocked", r.status === 400, r);
const S1 = (await call("POST", "/api/auth/student-login", { rollNo: stu.rollNo, password: stuPass })).data.token; ok("student login w/ temp password", !!S1);
const s = (m, p, b) => call(m, p, b, S1);
r = await s("POST", "/api/auth/change-password", { currentPassword: stuPass, newPassword: "short" }); ok("weak new password rejected", r.status === 400, r);
r = await s("POST", "/api/auth/change-password", { currentPassword: "wrong", newPassword: "newpassword1" }); ok("wrong current password rejected", r.status === 401, r);
r = await s("POST", "/api/auth/change-password", { currentPassword: stuPass, newPassword: "newpassword1" }); ok("password change", r.status === 200, r);
r = await call("POST", "/api/auth/student-login", { rollNo: stu.rollNo, password: "newpassword1" }); ok("login with new password", !!r.data.token, r);

// bulk import (capacity 2, 1 used)
r = await a("POST", "/api/lifecycle/students/import", { section: sec1._id, rows: [{ name: "X1", rollNo: "I1" + tag }, { name: "X2", rollNo: "I2" + tag }] }); ok("import respects section capacity", r.status === 409, r);
r = await a("POST", "/api/lifecycle/students/import", { section: sec2._id, rows: [{ name: "Imp One", rollNo: "I1" + tag, email: "bad" }, { name: "Imp Two", rollNo: "I2" + tag, email: `i2${tag}@x.com` }, { name: "Dup", rollNo: stu.rollNo }] });
ok("import: 1 created, 2 row errors", r.status === 201 && r.data.created.length === 1 && r.data.errors.length === 2, r.data);

// finance
r = await a("POST", "/api/finance/structures", { name: "Sem Fee " + tag, program: program._id, items: [{ title: "Tuition " + tag, category: "tuition", amount: 50000 }, { title: "Lab " + tag, category: "lab", amount: 5000 }] }); ok("fee structure", r.status === 201, r);
const fsId = r.data._id;
r = await a("POST", "/api/finance/scholarships", { student: stu._id, title: "Merit 150", type: "percent", value: 150 }); ok("scholarship >100% rejected", r.status === 400, r);
r = await a("POST", "/api/finance/scholarships", { student: stu._id, title: "Merit 50", type: "percent", value: 50 }); ok("scholarship", r.status === 201, r);
r = await a("POST", `/api/finance/structures/${fsId}/generate`, { dueDate: "2026-01-01" }); ok("generate needs period", r.status === 400, r);
r = await a("POST", `/api/finance/structures/${fsId}/generate`, { dueDate: "2026-01-01", period: "Fall" }); ok("generate bills 2 students × 2 items", r.data.created === 4 && r.data.total === 50000 + 5000 + 25000 + 5000, r.data);
r = await a("POST", `/api/finance/structures/${fsId}/generate`, { dueDate: "2026-01-01", period: "Fall" }); ok("regenerate is idempotent", r.data.created === 0, r.data);
r = await s("GET", "/api/fees/" + stu._id); const tuition = r.data.find(f => f.category === "tuition");
ok("student sees discounted fee", tuition.discount === 25000 && tuition.netAmount === 25000 && tuition.balance === 25000, tuition);
r = await s("POST", `/api/finance/fees/${tuition._id}/pay`, { amount: 100 }); ok("student cannot record payment", r.status === 403, r);
r = await a("POST", `/api/finance/fees/${tuition._id}/pay`, { amount: 99999 }); ok("overpayment rejected", r.status === 400, r);
r = await a("POST", `/api/finance/fees/${tuition._id}/pay`, { amount: -5 }); ok("negative payment rejected", r.status === 400, r);
r = await a("POST", `/api/finance/fees/${tuition._id}/pay`, { amount: 10000, method: "bank" }); ok("partial payment", r.data.fee.status === "partial" && r.data.fee.balance === 15000 && /^RCP-/.test(r.data.receiptNo), r.data);
r = await a("POST", "/api/finance/late-fees/apply"); ok("late fee applied to overdue", r.data.applied === 4 && r.data.total === 2000, r.data);
r = await a("POST", "/api/finance/late-fees/apply"); ok("late fee not applied twice", r.data.applied === 0, r.data);
r = await a("PATCH", `/api/finance/fees/${tuition._id}/adjust`, { fine: 0 }); ok("fine waived", r.data.fee.balance === 15000, r.data);
r = await a("PATCH", "/api/fees/" + tuition._id); ok("legacy mark-paid settles balance w/ receipt", r.data.fee.status === "paid" && r.data.fee.payments.length === 2 && r.data.fee.paidAmount === 25000, r.data);
r = await a("DELETE", `/api/finance/fees/${tuition._id}`); ok("paid fee can't be deleted", r.status === 400, r);
await a("POST", "/api/finance/expenses", { title: "Electricity", category: "utilities", amount: 7000 });
r = await a("GET", "/api/finance/summary"); ok("finance summary", r.data.totals.collected >= 25000 && r.data.totals.expenses >= 7000 && r.data.months.length === 12 && r.data.defaulters.length >= 1, r.data.totals);

// results
const T = (await call("POST", "/api/auth/teacher-login", { email: `t${tag}@x.edu`, password: "teachpass1" })).data.token; ok("teacher login", !!T);
const t = (m, p, b) => call(m, p, b, T);
r = await t("GET", `/api/results/class/${ta._id}`); ok("gradebook lists section students", r.data.rows.length === 1 && r.data.components.length === 4, r.data);
r = await t("PUT", `/api/results/class/${ta._id}`, { rows: [{ student: stu._id, marks: { Midterm: 45 } }] }); ok("marks above max rejected", r.status === 400, r);
const outsider = (await a("GET", "/api/students")).data.find(x => x.rollNo === "I2" + tag);
r = await t("PUT", `/api/results/class/${ta._id}`, { rows: [{ student: stu._id, marks: { Assignments: 9, Quizzes: 8, Midterm: 24, Final: 40 } }, { student: outsider._id, marks: { Final: 50 } }] }); ok("marks saved (outsider dropped)", r.data.saved === 1, r.data);
r = await s("GET", "/api/results/mine"); ok("unpublished results hidden from student", r.data.terms.length === 0, r.data);
r = await a("POST", "/api/results/publish", { teacherAssignment: ta._id }); ok("publish", r.data.updated === 1, r.data);
r = await s("GET", "/api/results/mine"); const c = r.data.terms[0]?.courses[0];
ok("transcript: 81% → A- 3.7, 4 credits", c?.percentage === 81 && c.grade === "A-" && r.data.cgpa === 3.7 && r.data.totalCredits === 4, r.data);
r = await t("PUT", `/api/results/class/${ta._id}`, { rows: [{ student: stu._id, marks: { Final: 50 } }] }); ok("published results locked for teacher", r.status === 409, r);
r = await a("GET", `/api/results/merit?section=${sec1._id}`); ok("merit list", r.data[0]?.rank === 1, r.data);
r = await s("GET", `/api/results/transcript/${stu._id}`); ok("student can't use admin transcript route", r.status === 403, r);

// LMS
const cw = (await t("POST", `/api/teacher/classes/${ta._id}/coursework`, { title: "HW1", dueDate: "2030-01-01", totalMarks: 10 })).data;
r = await s("POST", `/api/lms/student/coursework/${cw._id}/submit`, { link: "javascript:alert(1)" }); ok("bad link rejected", r.status === 400, r);
r = await s("POST", `/api/lms/student/coursework/${cw._id}/submit`, { text: "my answer" }); ok("submit", r.status === 201 && r.data.late === false, r);
r = await t("GET", `/api/lms/teacher/coursework/${cw._id}/submissions`); const sub = r.data.rows[0].submission; ok("teacher sees submission", !!sub, r.data);
r = await t("PATCH", `/api/lms/teacher/submissions/${sub._id}/grade`, { marks: 11 }); ok("grade above total rejected", r.status === 400, r);
r = await t("PATCH", `/api/lms/teacher/submissions/${sub._id}/grade`, { marks: 9, feedback: "good" }); ok("graded", r.data.marks === 9, r);
r = await s("POST", `/api/lms/student/coursework/${cw._id}/submit`, { text: "changed" }); ok("resubmit after grading blocked", r.status === 400, r);
const quiz = (await t("POST", `/api/teacher/classes/${ta._id}/quizzes`, { title: "Q1", scheduledAt: "2020-01-01T00:00", durationMinutes: 10 })).data;
r = await t("PUT", `/api/lms/teacher/quizzes/${quiz._id}/questions`, { questions: [{ text: "2+2?", options: ["3", "4"], correctIndex: 5 }] }); ok("invalid answer key rejected", r.status === 400, r);
r = await t("PUT", `/api/lms/teacher/quizzes/${quiz._id}/questions`, { questions: [{ text: "2+2?", options: ["3", "4"], correctIndex: 1, marks: 2 }, { text: "Sky?", options: ["blue", "red"], correctIndex: 0, marks: 3 }] }); ok("questions saved", r.data.totalMarks === 5, r);
r = await s("GET", "/api/student/quizzes"); ok("student quiz list hides question bank", r.data.length === 1 && r.data[0].questions === undefined, r.data);
const twoStarts = await Promise.all([s("POST", `/api/lms/student/quizzes/${quiz._id}/start`), s("POST", `/api/lms/student/quizzes/${quiz._id}/start`)]);
ok("two simultaneous starts share one attempt", twoStarts.every(x => x.status === 200) && twoStarts[0].data.startedAt === twoStarts[1].data.startedAt, twoStarts.map(x => [x.status, x.data]));
r = await s("POST", `/api/lms/student/quizzes/${quiz._id}/start`); ok("start hides answers", r.data.questions.length === 2 && r.data.questions[0].correctIndex === undefined && !JSON.stringify(r.data).includes("correctIndex"), r.data);
r = await t("PUT", `/api/lms/teacher/quizzes/${quiz._id}/questions`, { questions: [] }); ok("questions locked after start", r.status === 409, r);
r = await s("POST", `/api/lms/student/quizzes/${quiz._id}/submit`, { answers: [1, 1] }); ok("auto-graded 2/5", r.data.score === 2 && r.data.maxScore === 5, r.data);
r = await s("POST", `/api/lms/student/quizzes/${quiz._id}/submit`, { answers: [1, 0] }); ok("second submit blocked", r.status === 400, r);
r = await t("GET", `/api/lms/teacher/quizzes/${quiz._id}/results`); ok("quiz results + item stats", r.data.average === 2 && r.data.questionStats[0].correctRate === 100, r.data);

// HR
const dept = (await a("POST", "/api/hr/departments", { name: "CS " + tag, code: "cs" + tag })).data;
r = await a("POST", "/api/hr/staff", { name: "Staff One", department: dept._id, teacher: teacherId, basicSalary: 60000, allowances: [{ label: "House", amount: 10000 }], deductions: [{ label: "Tax", amount: 5000 }] }); ok("staff + auto employee id", /^EMP-/.test(r.data.employeeId), r);
const staff = r.data; const today = new Date().toISOString().slice(0, 10), month = today.slice(0, 7);
r = await a("POST", "/api/hr/attendance", { date: "2099-01-01", records: [{ staff: staff._id, status: "absent" }] }); ok("future staff attendance rejected", r.status === 400, r);
r = await a("POST", "/api/hr/attendance", { date: `${month}-01`, records: [{ staff: staff._id, status: "absent" }] }); ok("staff attendance", r.data.saved === 1, r);
r = await a("POST", "/api/hr/payroll/run", { month }); ok("payroll run: 70000 - 5000 - 2000 = 63000", r.data.created >= 1, r.data);
r = await a("GET", `/api/hr/payroll?month=${month}&staff=${staff._id}`); ok("payslip net", r.data[0].net === 63000 && r.data[0].absenceDeduction === 2000, r.data[0]);
r = await a("POST", "/api/hr/payroll/pay", { month }); ok("payroll paid", r.data.paid >= 1, r.data);
r = await a("POST", "/api/hr/payroll/run", { month }); ok("paid slips locked on re-run", r.data.created === 0 && r.data.locked >= 1, r.data);
r = await t("GET", "/api/hr/my/payslips"); ok("teacher sees own payslip", r.data.payslips.length === 1, r.data);
r = await t("GET", "/api/hr/staff"); ok("teacher blocked from staff list", r.status === 403, r);

// Library
const book = (await a("POST", "/api/library/books", { title: "CLRS " + tag, author: "Cormen", copies: 1 })).data; ok("book", book.available === 1, book);
r = await a("POST", "/api/library/issues", { book: book._id, student: stu._id }); ok("issue", r.status === 201, r); const issue = r.data;
r = await a("POST", "/api/library/issues", { book: book._id, student: outsider._id }); ok("no copies left", r.status === 409, r);
r = await a("PATCH", `/api/library/books/${book._id}`, { copies: 0 }); ok("copies can't drop below loans", r.status === 400, r);
r = await s("GET", "/api/library/mine"); ok("student sees loan", r.data.length === 1, r.data);
r = await a("PATCH", `/api/library/issues/${issue._id}/return`); ok("return", r.data.status === "returned" && r.data.fine === 0, r.data);
r = await a("GET", `/api/library/books/${book._id}`); ok("copy back on shelf", r.data.available === 1, r.data);

// Campus
const route = (await a("POST", "/api/campus/transport/routes", { name: "R1 " + tag, capacity: 1 })).data;
r = await a("POST", "/api/campus/transport/assignments", { student: stu._id, route: route._id }); ok("transport assign", r.status === 201, r);
r = await a("POST", "/api/campus/transport/assignments", { student: outsider._id, route: route._id }); ok("route full", r.status === 409, r);
const hostel = (await a("POST", "/api/campus/hostel/hostels", { name: "H " + tag })).data;
const room = (await a("POST", "/api/campus/hostel/rooms", { hostel: hostel._id, number: "101", capacity: 1 })).data;
r = await a("POST", "/api/campus/hostel/allocations", { student: stu._id, room: room._id }); ok("hostel allocate", r.status === 201, r); const alloc = r.data;
r = await a("POST", "/api/campus/hostel/allocations", { student: outsider._id, room: room._id }); ok("room full", r.status === 409, r);
r = await a("PATCH", `/api/campus/hostel/allocations/${alloc._id}`, { status: "vacated" }); ok("generic allocation write not exposed", r.status === 404, r);
r = await s("GET", "/api/campus/mine"); ok("student sees transport+hostel", r.data.transport && r.data.hostel, r.data);
r = await a("PATCH", `/api/campus/hostel/allocations/${alloc._id}/vacate`); ok("vacate", r.data.status === "vacated", r);

// Engage
r = await a("POST", "/api/engage/calendar", { title: "Staff meet", type: "meeting", start: "2027-01-01", audience: "teachers" });
await a("POST", "/api/engage/calendar", { title: "Eid", type: "holiday", start: "2027-02-01", audience: "all" });
r = await s("GET", "/api/engage/calendar"); ok("calendar audience scoping", r.data.some(e => e.title === "Eid") && !r.data.some(e => e.title === "Staff meet"), r.data);
r = await s("POST", "/api/engage/calendar", { title: "hack", start: "2027-01-01" }); ok("student can't create events", r.status === 403, r);
r = await s("POST", "/api/engage/tickets", { subject: "WiFi down", description: "No internet in lab", category: "it", priority: "urgent" }); ok("ticket (urgent capped)", r.status === 201 && r.data.priority === "high" && /^TKT-/.test(r.data.ticketNo), r); const tk = r.data;
r = await t("GET", "/api/engage/tickets"); ok("teacher can't see student's ticket", r.data.length === 0, r.data);
r = await t("POST", `/api/engage/tickets/${tk._id}/reply`, { message: "x" }); ok("teacher can't reply to it", r.status === 404, r);
r = await a("POST", `/api/engage/tickets/${tk._id}/reply`, { message: "On it" }); ok("admin reply → in_progress", r.data.status === "in_progress", r);
r = await a("POST", "/api/engage/certificates", { student: stu._id, type: "bonafide", purpose: "Visa" }); ok("certificate serial", /^BON-/.test(r.data.serialNo), r); const cert = r.data;
r = await call("GET", "/api/engage/certificates/verify/" + cert.serialNo.toLowerCase()); ok("public verify", r.data.status === "valid" && r.data.studentName === "Applicant One", r);
r = await a("DELETE", "/api/engage/certificates/" + cert._id); ok("certificate not deletable", r.status === 400, r);

// Parent portal
const parents = (await a("GET", "/api/parents")).data; const parent = parents.find(p => p.email === `g${tag}@x.com`); ok("parent created by admission", !!parent && parent.password === undefined, parents);
r = await call("POST", "/api/auth/parent-login", { email: parent.email, password: "anything" }); ok("parent login off by default", r.status === 401, r);
r = await a("PATCH", `/api/parents/${parent._id}/portal`, { enabled: true }); ok("enable needs password", r.status === 400, r);
r = await a("PATCH", `/api/parents/${parent._id}/portal`, { enabled: true, password: "parentpass1" }); ok("portal enabled", r.data.portalEnabled && r.data.password === undefined, r);
const P = (await call("POST", "/api/auth/parent-login", { email: parent.email, password: "parentpass1" })).data.token; ok("parent login", !!P);
const p = (m, x, b) => call(m, x, b, P);
r = await p("GET", "/api/parent-portal/children"); ok("parent sees own child", r.data.length === 1 && r.data[0]._id === stu._id, r.data);
r = await p("GET", `/api/parent-portal/children/${stu._id}/overview`); ok("child overview", r.data.transcript.cgpa === 3.7 && r.data.fees.items.length === 2 && r.data.subjects.length === 1, r.data);
r = await p("GET", `/api/parent-portal/children/${outsider._id}/overview`); ok("parent can't see another child", r.status === 404, r);
for (const path of ["/api/students", "/api/fees", "/api/chat/conversations", "/api/notifications", "/api/finance/summary"]) { r = await p("GET", path); ok("parent blocked from " + path, r.status === 403, r); }

// ── Smart layer ────────────────────────────────────────────────────────────
// (runs while `stu` is still the only student in sec1, taught through `ta`)
const O = (await call("POST", "/api/auth/student-login", { rollNo: "I2" + tag, password: (await a("PATCH", `/api/students/${outsider._id}`, { password: "outsider1" }), "outsider1") })).data.token;
ok("second student login", !!O);
const o = (m, p, b) => call(m, p, b, O);

// early-warning
r = await a("GET", "/api/success/overview"); const riskRow = r.data.rows.find(x => x.student._id === stu._id);
ok("risk: overdue fee is flagged with a reason", riskRow && riskRow.score > 0 && riskRow.reasons.some(x => x.factor === "fees") && r.data.summary.total >= 2, riskRow);
r = await a("GET", `/api/success/overview?section=${sec1._id}`); ok("risk: section filter", r.data.rows.length === 1, r.data.summary);
r = await t("GET", `/api/success/class/${ta._id}`); ok("risk: teacher sees own class", r.data.rows.length === 1 && r.data.rows[0].student._id === stu._id, r.data);
r = await t("GET", `/api/success/student/${outsider._id}`); ok("risk: teacher blocked from other students", r.status === 403, r);
r = await t("POST", "/api/success/interventions", { student: outsider._id, notes: "x" }); ok("intervention: teacher blocked for other students", r.status === 403, r);
r = await t("POST", "/api/success/interventions", { student: stu._id, type: "parent_contact", notes: "Called guardian about fees." }); ok("intervention logged", r.status === 201 && r.data.byRole === "teacher", r); const iv = r.data;
r = await a("PATCH", `/api/success/interventions/${iv._id}`, { status: "done" }); ok("intervention closed", r.data.status === "done", r);
r = await s("GET", "/api/success/overview"); ok("risk: students can't see the list", r.status === 403, r);

// auto timetable
const SLOTS = [{ start: "08:30", end: "10:00" }, { start: "10:15", end: "11:45" }];
r = await a("POST", "/api/smart/timetable/generate", { academicSession: session._id, days: ["Monday", "Tuesday"], slots: SLOTS }); ok("timetable: needs a room", r.status === 400, r);
const tiny = (await a("POST", "/api/rooms", { name: "Tiny " + tag, type: "classroom", capacity: 0 })).data;
const hall = (await a("POST", "/api/rooms", { name: "Hall " + tag, type: "classroom", capacity: 40 })).data;
r = await a("POST", "/api/smart/timetable/generate", { academicSession: session._id, days: ["Monday"], slots: [{ start: "09:00", end: "10:00" }, { start: "09:30", end: "10:30" }] }); ok("timetable: overlapping periods rejected", r.status === 400, r);
r = await a("POST", "/api/smart/timetable/generate", { academicSession: session._id, days: ["Monday", "Tuesday"], slots: SLOTS });
ok("timetable preview: 4 periods (4 credit hours), big-enough room, nothing written", r.status === 200 && r.data.placed.length === 4 && r.data.placed.every(p => p.room === hall.name) && !r.data.committed, r.data);
ok("timetable preview: spread over both days, no slot reused", new Set(r.data.placed.map(p => p.day + p.startTime)).size === 4 && new Set(r.data.placed.map(p => p.day)).size === 2, r.data.placed);
r = await a("GET", `/api/schedule?academicSession=${session._id}`); ok("timetable preview wrote nothing", r.data.length === 0, r.data.length);
r = await a("POST", "/api/smart/timetable/generate", { academicSession: session._id, days: ["Monday"], slots: SLOTS }); ok("timetable: reports what doesn't fit", r.data.placed.length === 2 && r.data.unplaced.length === 2 && /section|teacher|slot/i.test(r.data.unplaced[0].reason), r.data);
r = await a("POST", "/api/smart/timetable/generate", { academicSession: session._id, days: ["Monday", "Tuesday"], slots: SLOTS, commit: true }); ok("timetable committed", r.status === 201 && r.data.placed.length === 4, r.data);
r = await a("POST", "/api/smart/timetable/generate", { academicSession: session._id, days: ["Monday", "Tuesday"], slots: SLOTS, commit: true }); ok("timetable: re-run adds nothing", r.data.placed.length === 0 && r.data.kept === 4, r.data);
r = await s("GET", "/api/schedule/student"); ok("student sees generated timetable", r.data.length === 4 && r.data[0].room?.name === hall.name, r.data.length);
void tiny;

// exams
const day = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
r = await a("POST", "/api/examsuite/sessions", { name: "Midterm " + tag, academicSession: session._id, startDate: day(10), endDate: day(3) }); ok("exam: end before start rejected", r.status === 400, r);
const es = (await a("POST", "/api/examsuite/sessions", { name: "Midterm " + tag, academicSession: session._id, startDate: day(3), endDate: day(12) })).data; ok("exam session", !!es._id && es.slots.length === 2, es);
r = await a("POST", `/api/examsuite/sessions/${es._id}/status`, { status: "published" }); ok("exam: can't publish an empty datesheet", r.status === 400, r);
r = await a("POST", `/api/examsuite/sessions/${es._id}/generate`); ok("exam datesheet generated", r.data.scheduled === 1 && r.data.unplaced.length === 0, r.data);
r = await a("POST", `/api/examsuite/sessions/${es._id}/generate`); ok("exam: regenerate keeps existing papers", r.data.scheduled === 0 && r.data.kept === 1, r.data);
r = await a("GET", `/api/examsuite/sessions/${es._id}/papers`); const paper = r.data[0]; ok("exam paper has room + seat + no Sunday", paper.room?.name === hall.name && paper.seats[0].seatNo === 1 && new Date(paper.date).getUTCDay() !== 0, paper);
r = await s("GET", "/api/examsuite/mine"); ok("exam: hidden from students until published", r.data.length === 0, r.data);
await a("POST", `/api/examsuite/sessions/${es._id}/status`, { status: "published" });
r = await a("POST", `/api/examsuite/sessions/${es._id}/generate`, { replace: true }); ok("exam: published datesheet is locked", r.status === 409, r);
r = await s("GET", "/api/examsuite/mine"); ok("exam: student datesheet with seat; admit card blocked by overdue fee", r.data[0]?.papers[0]?.seatNo === 1 && r.data[0].admitCard.feeBlocked === true && r.data[0].admitCard.allowed === false, r.data[0]);
r = await o("GET", "/api/examsuite/mine"); ok("exam: other section sees no papers", r.data.length === 0, r.data);
r = await t("GET", "/api/examsuite/teaching"); ok("exam: teacher sees paper + invigilation", r.data.length === 1 && r.data[0].invigilating === true && r.data[0].seats === undefined, r.data);

// live attendance
r = await t("POST", `/api/smart/attendance/${ta._id}/open`, { minutes: 5 }); ok("attendance session opened", r.status === 201, r); const as = r.data;
r = await t("GET", `/api/smart/attendance/session/${as._id}`); const liveCode = r.data.code; ok("teacher gets rotating code", /^\d{6}$/.test(liveCode) && r.data.total === 1 && r.data.checkedIn.length === 0, r.data);
r = await s("GET", "/api/smart/attendance/open"); ok("student sees open session without the code", r.data.length === 1 && !JSON.stringify(r.data).includes(liveCode) && r.data[0].done === false, r.data);
r = await s("POST", "/api/smart/attendance/checkin", { code: liveCode === "000000" ? "000001" : "000000" }); ok("wrong code rejected", r.status === 400, r);
r = await o("POST", "/api/smart/attendance/checkin", { code: liveCode }); ok("right code is useless to a student from another class", r.status === 400, r);
r = await s("POST", "/api/smart/attendance/checkin", { code: (await t("GET", `/api/smart/attendance/session/${as._id}`)).data.code }); ok("check-in marks present", r.data.marked === true, r);
r = await t("GET", `/api/teacher/classes/${ta._id}/attendance?date=${day(0)}`); ok("attendance record written", r.data.students[0].status === "present", r.data);
r = await t("POST", `/api/smart/attendance/session/${as._id}/close`, { markAbsent: true }); ok("session closed, present student not overwritten", r.data.present === 1 && r.data.markedAbsent === 0, r.data);
r = await s("POST", "/api/smart/attendance/checkin", { code: liveCode }); ok("closed session accepts nothing", r.status === 400, r);

// payment claims
const labFee = (await s("GET", "/api/fees/" + stu._id)).data.find(f => f.category === "lab");
r = await s("POST", "/api/smart/claims", { fee: labFee._id, amount: 99999, reference: "TXN1" }); ok("claim above balance rejected", r.status === 400, r);
r = await o("POST", "/api/smart/claims", { fee: labFee._id, amount: 100, reference: "TXN1" }); ok("can't claim against someone else's fee", r.status === 404, r);
r = await s("POST", "/api/smart/claims", { fee: labFee._id, amount: 1000 }); ok("claim needs a reference", r.status === 400, r);
r = await s("POST", "/api/smart/claims", { fee: labFee._id, amount: 1000, reference: "TXN-778", method: "bank" }); ok("claim submitted", r.status === 201 && r.data.status === "pending", r); const claim = r.data;
r = await s("POST", "/api/smart/claims", { fee: labFee._id, amount: 500, reference: "TXN-779" }); ok("one pending claim per fee", r.status === 409, r);
r = await s("GET", "/api/fees/" + stu._id); ok("claim alone credits nothing", r.data.find(f => f._id === labFee._id).paidAmount === 0, r.data);
r = await s("POST", `/api/finance/claims/${claim._id}/review`, { decision: "approve" }); ok("students can't approve claims", r.status === 403, r);
r = await a("POST", `/api/finance/claims/${claim._id}/review`, { decision: "reject" }); ok("rejection needs a reason", r.status === 400, r);
r = await a("POST", `/api/finance/claims/${claim._id}/review`, { decision: "approve" }); ok("claim approved → receipt", r.data.status === "approved" && /^RCP-/.test(r.data.receiptNo), r);
r = await a("POST", `/api/finance/claims/${claim._id}/review`, { decision: "approve" }); ok("claim can't be approved twice", r.status === 400, r);
r = await s("GET", "/api/fees/" + stu._id); ok("approved claim credited once", r.data.find(f => f._id === labFee._id).paidAmount === 1000 && r.data.find(f => f._id === labFee._id).status === "partial", r.data);

// teacher evaluation
const survey = (await a("POST", "/api/smart/surveys", { title: "Fall evaluation " + tag, academicSession: session._id, status: "open" })).data; ok("survey created with default questions", survey.questions?.length === 5, survey);
r = await s("GET", "/api/smart/surveys/pending"); ok("student has 1 evaluation to fill", r.data.length === 1 && r.data[0].teacher?.name, r.data);
r = await s("POST", `/api/smart/surveys/${survey._id}/respond`, { teacherAssignment: ta._id, ratings: [5, 5, 9, 1, 2] }); ok("out-of-range rating rejected", r.status === 400, r);
r = await o("POST", `/api/smart/surveys/${survey._id}/respond`, { teacherAssignment: ta._id, ratings: [1, 1, 1, 1, 1] }); ok("can't rate a teacher you don't have", r.status === 404, r);
r = await s("POST", `/api/smart/surveys/${survey._id}/respond`, { teacherAssignment: ta._id, ratings: [5, 4, 4, 3, 5], comment: "Great lectures" }); ok("evaluation submitted", r.status === 201, r);
r = await s("POST", `/api/smart/surveys/${survey._id}/respond`, { teacherAssignment: ta._id, ratings: [1, 1, 1, 1, 1] }); ok("can't respond twice", r.status === 409, r);
r = await s("GET", "/api/smart/surveys/pending"); ok("nothing left to fill", r.data.length === 0, r.data);
r = await a("GET", `/api/smart/surveys/${survey._id}/results`); ok("results aggregate, with no trace of who answered", r.data.total === 1 && r.data.classes[0].overall === 4.2 && !JSON.stringify(r.data).includes(stu._id), r.data);
await a("PATCH", `/api/smart/surveys/${survey._id}`, { status: "closed" });
r = await t("GET", "/api/smart/surveys/mine"); ok("teacher's results withheld below 3 responses", r.data.length === 1 && r.data[0].withheld === true && r.data[0].comments === undefined, r.data);
r = await a("PATCH", `/api/smart/surveys/${survey._id}`, { questions: ["Changed?"] }); ok("questions locked once answered", r.status === 409, r);

// inbox + needs-attention
r = await s("GET", "/api/smart/inbox"); ok("student inbox has event notifications", r.data.unread >= 3 && r.data.items.some(n => n.type === "fee") && r.data.items.some(n => n.type === "exam") && r.data.items.some(n => n.type === "grade"), r.data.items.map(n => n.title));
r = await o("GET", "/api/smart/inbox"); ok("inbox is per-user", !r.data.items.some(n => /Midterm|Graded/.test(n.title)), r.data.items.map(n => n.title));
r = await s("POST", "/api/smart/inbox/read", {}); r = await s("GET", "/api/smart/inbox"); ok("mark all read", r.data.unread === 0, r.data.unread);
r = await s("GET", "/api/smart/today"); ok("student attention feed", Array.isArray(r.data) && r.data.some(i => i.key === "fees-overdue") && r.data.some(i => i.key === "exams") && r.data.every(i => i.count > 0 && i.to.startsWith("/student/")), r.data);
r = await t("GET", "/api/smart/today"); ok("teacher attention feed", Array.isArray(r.data) && r.data.every(i => i.to.startsWith("/teacher/")), r.data);
r = await a("GET", "/api/smart/today"); ok("admin attention feed", Array.isArray(r.data) && r.data.some(i => i.key === "urgent") && r.data.every(i => i.to.startsWith("/admin/")), r.data);

// ── Round 3: automations, account security, cover, meetings, instalments, similarity, degree, insights ──
// automations
r = await a("GET", "/api/automations"); ok("automations listed, all off by default", r.data.length === 6 && r.data.every(x => x.enabled === false), r.data);
r = await t("GET", "/api/automations"); ok("teachers can't see automations", r.status === 403, r);
r = await call("GET", "/api/automations/cron"); ok("cron endpoint refuses without secret", r.status === 401, r);
await a("POST", "/api/fees", { title: "Late test fee", amount: 500, due: day(-1), studentId: outsider._id, category: "other" });
r = await a("POST", "/api/automations/fee-overdue/run"); ok("run now: newly overdue fee notified", r.data.acted === 1, r.data);
r = await a("POST", "/api/automations/fee-overdue/run"); ok("automation is idempotent", r.data.acted === 0, r.data);
r = await a("POST", "/api/automations/risk-escalation/run"); ok("risk escalation runs", r.status === 200 && typeof r.data.acted === "number", r.data);
r = await a("POST", "/api/automations/nope/run"); ok("unknown automation 404", r.status === 404, r);
r = await a("PATCH", "/api/automations/library-due", { enabled: true, email: true }); ok("automation switched on", r.data.enabled === true && r.data.email === true, r.data);

// password reset (token minted directly — the real one only travels by email)
r = await call("POST", "/api/auth/forgot-password", { role: "student", identifier: stu.rollNo }); ok("forgot password: generic answer", r.status === 200 && /If an account matches/.test(r.data.message), r);
r = await call("POST", "/api/auth/forgot-password", { role: "student", identifier: "no-such-roll" }); ok("forgot password: same answer for unknown account", r.status === 200 && /If an account matches/.test(r.data.message), r);
r = await call("POST", "/api/auth/reset-password", { token: "deadbeef", password: "whatever123" }); ok("bad reset token rejected", r.status === 400, r);
{
  const mongoose = (await import("mongoose")).default;
  const conn = await mongoose.createConnection(MONGO).asPromise();
  const { PasswordReset } = await import("../src/services/security.js");
  const crypto = await import("crypto");
  const token = crypto.randomBytes(32).toString("hex");
  const mainTenant = (await conn.collection("tenants").findOne({ code: "MAIN" }))?._id;
  await conn.collection(PasswordReset.collection.name).insertOne({ tenant: mainTenant, role: "student", userId: new mongoose.Types.ObjectId(stu._id), tokenHash: crypto.createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 600000), usedAt: null, createdAt: new Date(), updatedAt: new Date() });
  r = await call("POST", "/api/auth/reset-password", { token, password: "short" }); ok("reset needs 8+ chars", r.status === 400, r);
  r = await call("POST", "/api/auth/reset-password", { token, password: "resetpass99" }); ok("password reset", r.status === 200, r);
  r = await call("POST", "/api/auth/reset-password", { token, password: "resetpass77" }); ok("reset link is single-use", r.status === 400, r);
  r = await call("POST", "/api/auth/student-login", { rollNo: stu.rollNo, password: "resetpass99" }); ok("login with reset password", !!r.data.token, r);
  await conn.close();
}

// two-factor sign-in
{
  const { totpAt } = await import("../src/services/security.js");
  const A2 = (await call("POST", "/api/auth/admin-login", { email: "admin1@uni.edu", password: "admin123" })).data.token;
  r = await call("POST", "/api/system/2fa/setup", null, A2); ok("2fa setup returns secret + otpauth uri", /^[A-Z2-7]{32}$/.test(r.data.secret) && r.data.otpauthUrl.startsWith("otpauth://totp/"), r.data);
  const secret = r.data.secret, w = Math.floor(Date.now() / 30000);
  r = await call("POST", "/api/system/2fa/enable", { code: "123456" === totpAt(secret, w) ? "654321" : "123456" }, A2); ok("2fa: wrong code doesn't enable", r.status === 400, r);
  r = await call("POST", "/api/system/2fa/enable", { code: totpAt(secret, w) }, A2); ok("2fa enabled", r.data.enabled === true, r);
  r = await call("POST", "/api/auth/admin-login", { email: "admin1@uni.edu", password: "admin123" }); ok("2fa: password alone no longer enough", r.status === 401 && r.data.twoFactorRequired === true, r);
  r = await call("POST", "/api/admin/admin-login", { email: "admin1@uni.edu", password: "admin123" }); ok("2fa: legacy admin login route enforces it too", r.status === 401 && r.data.twoFactorRequired === true, r);
  r = await call("POST", "/api/auth/admin-login", { email: "admin1@uni.edu", password: "admin123", otp: totpAt(secret, w) }); ok("2fa: code already used at enable time is rejected (replay)", r.status === 401, r);
  r = await call("POST", "/api/auth/admin-login", { email: "admin1@uni.edu", password: "admin123", otp: totpAt(secret, w + 1) }); ok("2fa: login with fresh code", !!r.data.token, r);
  const A3 = r.data.token;
  r = await call("POST", "/api/system/2fa/disable", { password: "wrong", code: totpAt(secret, w + 1) }, A3); ok("2fa: disabling needs the password", r.status === 401, r);
  r = await call("POST", "/api/system/2fa/disable", { password: "admin123", code: totpAt(secret, w) }, A3); ok("2fa disabled", r.data.enabled === false, r);
  r = await call("POST", "/api/auth/admin-login", { email: "admin1@uni.edu", password: "admin123" }); ok("password-only login works again", !!r.data.token, r);
}

// substitute cover (the timetable generated above put `teacher` on Monday & Tuesday)
const t2 = (await a("POST", "/api/teachers", { name: "Cover Teacher " + tag, email: `c${tag}@x.edu`, password: "coverpass1" })).data;
const t2id = t2._id || t2.teacher?._id;
const T2 = (await call("POST", "/api/auth/teacher-login", { email: `c${tag}@x.edu`, password: "coverpass1" })).data.token;
const nextMonday = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7)); return d.toISOString().slice(0, 10); })();
r = await a("GET", `/api/ops/substitutions/plan?teacher=${teacherId}&from=${nextMonday}&to=${nextMonday}`);
ok("cover plan: Monday's periods with a free colleague suggested", r.data.periods.length === 2 && r.data.periods.every(p => p.suggestions.some(s => s.teacher._id === t2id)), r.data);
const period = r.data.periods[0];
r = await a("POST", "/api/ops/substitutions", { date: nextMonday, entry: period.entry._id, substitute: teacherId }); ok("cover: absent teacher can't cover themself", r.status === 400, r);
r = await a("POST", "/api/ops/substitutions", { date: day(1) === nextMonday ? day(2) : day(1), entry: period.entry._id, substitute: t2id }); ok("cover: date must match the period's weekday", r.status === 400, r);
r = await a("POST", "/api/ops/substitutions", { date: nextMonday, entry: period.entry._id, substitute: t2id, note: "Chapter 4" }); ok("cover arranged", r.status === 201 && r.data.substitute.name.startsWith("Cover"), r);
r = await call("GET", "/api/ops/substitutions/mine", null, T2); ok("substitute sees the cover", r.data.length === 1 && r.data[0].entry.subject.name.startsWith("Algo"), r.data);
r = await call("GET", "/api/smart/inbox", null, T2); ok("substitute notified", r.data.items.some(n => /^Cover/.test(n.title)), r.data.items);
r = await a("GET", `/api/ops/substitutions/plan?teacher=${teacherId}&from=${nextMonday}&to=${nextMonday}`); ok("plan shows the period as covered", r.data.covered === 1, r.data.covered);

// parent–teacher meetings
const tomorrow10 = new Date(Date.now() + 86400000); tomorrow10.setHours(10, 0, 0, 0);
r = await t("POST", "/api/ops/meetings/slots", { start: tomorrow10.toISOString(), end: new Date(tomorrow10.getTime() + 3600000).toISOString(), minutes: 15 }); ok("teacher publishes 4 slots", r.data.created === 4, r);
r = await t("POST", "/api/ops/meetings/slots", { start: tomorrow10.toISOString(), end: new Date(tomorrow10.getTime() + 3600000).toISOString(), minutes: 15 }); ok("re-publishing skips existing slots", r.data.created === 0 && r.data.skipped === 4, r);
r = await p("GET", "/api/ops/meetings/available"); const avail = r.data[0]; ok("parent sees the child's teacher with open slots", avail?.teachers.some(x => x.slots.length === 4), r.data);
const slotId = avail.teachers.find(x => x.slots.length).slots[0]._id;
r = await p("POST", `/api/ops/meetings/${slotId}/book`, { student: outsider._id }); ok("parent can't book for someone else's child", r.status === 404, r);
r = await p("POST", `/api/ops/meetings/${slotId}/book`, { student: stu._id, agenda: "Fee plan and attendance" }); ok("meeting booked", r.data.status === "booked" && r.data.student.name === "Applicant One", r);
r = await p("POST", `/api/ops/meetings/${avail.teachers.find(x => x.slots.length).slots[1]._id}/book`, { student: stu._id }); ok("one upcoming meeting per teacher", r.status === 409, r);
r = await t("GET", "/api/ops/meetings/mine"); ok("teacher sees the booking", r.data.some(s => s.status === "booked" && s.parent?.name), r.data.length);
r = await p("POST", `/api/ops/meetings/${slotId}/cancel`); ok("parent cancels → slot reopens", r.data.cancelled === true, r);
r = await call("GET", "/api/ops/meetings/available", null, S1); ok("students can't use meeting booking", r.status === 403, r);

// fee instalments (outsider's tuition is unpaid)
const outFees = (await a("GET", `/api/fees/${outsider._id}`)).data; const outTuition = outFees.find(f => f.category === "tuition");
r = await a("POST", `/api/finance/fees/${outTuition._id}/installments`, { count: 1 }); ok("instalments: count must be 2–12", r.status === 400, r);
r = await a("POST", `/api/finance/fees/${outTuition._id}/installments`, { count: 3, intervalDays: 30 });
ok("fee split into 3 instalments that add up exactly", r.status === 201 && r.data.created === 3 && Math.abs(r.data.installments.reduce((x, f) => x + f.amount, 0) - outTuition.amount) < 0.01 && r.data.installments[2].title.endsWith("(3/3)"), r.data);
r = await a("POST", `/api/finance/fees/${r.data.installments[0]._id}/installments`, { count: 2 }); ok("an instalment can't be split again", r.status === 400, r);
r = await a("POST", `/api/finance/fees/${labFee._id}/installments`, { count: 2 }); ok("part-paid fee can't be split", r.status === 400, r);

// similarity check — two students in the same section hand in near-identical work
const mate = (await a("POST", "/api/lifecycle/students/import", { section: sec1._id, rows: [{ name: "Class Mate", rollNo: "M" + tag }] })).data.created[0];
const M = (await call("POST", "/api/auth/student-login", { rollNo: mate.rollNo, password: mate.tempPassword })).data.token;
const hw = (await t("POST", `/api/teacher/classes/${ta._id}/coursework`, { title: "Essay", dueDate: "2030-01-01" })).data;
const essay = "A stack is a linear data structure that follows the last in first out principle where the most recently added element is removed first and it supports push and pop operations in constant time which makes it useful for recursion undo features and expression evaluation";
await s("POST", `/api/lms/student/coursework/${hw._id}/submit`, { text: essay });
await call("POST", `/api/lms/student/coursework/${hw._id}/submit`, { text: essay.replace("useful for", "handy for") + " in compilers" }, M);
r = await t("GET", `/api/lms/teacher/coursework/${hw._id}/similarity`); ok("similarity flags the copied pair", r.data.compared === 2 && r.data.pairs.length === 1 && r.data.pairs[0].score >= 70, r.data);
r = await call("GET", `/api/lms/teacher/coursework/${hw._id}/similarity`, null, T2); ok("other teachers can't run it", r.status === 404, r);

// degree progress + insights
await a("PATCH", `/api/programs/${program._id}`, { requiredCredits: 8 });
r = await s("GET", "/api/results/mine"); ok("degree progress on transcript", r.data.degree?.requiredCredits === 8 && r.data.degree.earned === 4 && r.data.degree.percent === 50, r.data.degree);
r = await a("GET", "/api/ops/insights"); ok("insights", r.data.gradeDistribution.length === 10 && r.data.subjectPerformance.length >= 1 && r.data.feeForecast && r.data.attendanceByWeekday.length >= 1, r.data);

// 360, promotion
r = await a("GET", `/api/lifecycle/students/${stu._id}/360`); ok("student 360", r.data.transcript.cgpa === 3.7 && r.data.certificates.length === 1 && r.data.loans.length === 1 && r.data.student.password === undefined, r.data);
r = await a("POST", "/api/lifecycle/promote", { fromSection: sec1._id, toSection: sec1._id }); ok("promote to same section rejected", r.status === 400, r);
r = await a("POST", "/api/lifecycle/promote", { fromSection: sec1._id, toSection: sec2._id }); ok("promote (whole section moves)", r.data.moved === 2, r);
r = await a("GET", `/api/enrollments?student=${stu._id}`); ok("history kept: completed + active", r.data.length === 2 && r.data.filter(e => e.status === "active").length === 1, r.data);
r = await a("POST", "/api/lifecycle/promote", { fromSection: sec2._id, outcome: "graduate", studentIds: [stu._id] }); ok("graduate", r.data.moved === 1, r);
r = await a("GET", "/api/engage/alumni"); ok("alumni record w/ cgpa", r.data.some(x => x.rollNo === stu.rollNo && x.cgpa === 3.7), r.data);

// RBAC sub-roles + audit + search + overview
r = await a("POST", "/api/admin/admins", { email: `lib${tag}@x.edu`, password: "librarian1", adminRole: "librarian" }); ok("create librarian", r.status === 201, r);
const L = (await call("POST", "/api/auth/admin-login", { email: `lib${tag}@x.edu`, password: "librarian1" })).data.token;
const l = (m, x, b) => call(m, x, b, L);
r = await l("GET", "/api/library/books"); ok("librarian: library ok", r.status === 200, r);
r = await l("GET", "/api/students"); ok("librarian: can read students", r.status === 200, r);
r = await l("DELETE", "/api/students/" + outsider._id); ok("librarian: can't delete students", r.status === 403, r);
r = await l("GET", "/api/finance/summary"); ok("librarian: no finance", r.status === 403, r);
r = await l("POST", "/api/fees", { title: "x", amount: 1, due: "2027-01-01", applyToAll: true }); ok("librarian: can't bill", r.status === 403, r);
r = await l("GET", "/api/system/audit"); ok("librarian: no audit", r.status === 403, r);
r = await l("PATCH", "/api/system/settings", { instituteName: "pwn" }); ok("librarian: no settings write", r.status === 403, r);
r = await l("GET", "/api/admin/admins"); ok("librarian: no admin mgmt", r.status === 403, r);
r = await l("GET", "/api/system/overview"); ok("librarian overview hides finance", r.status === 200 && r.data.finance === null, r.data);
r = await a("GET", "/api/system/audit?limit=500"); ok("audit trail recorded, no values", r.data.length > 50 && r.data.every(e => !JSON.stringify(e).includes("parentpass1")) && r.data.some(e => e.path.includes("parent-login") && e.status === 401), r.data.length);
r = await a("GET", "/api/system/search?q=Applicant"); ok("global search", r.data.some(x => x.kind === "Student") && r.data.some(x => x.kind === "Applicant"), r.data);
r = await a("GET", "/api/system/overview"); ok("overview", r.data.people.students > 0 && r.data.finance.collected > 0, r.data);
r = await a("GET", "/api/analytics"); ok("legacy analytics still works", r.status === 200, r);
r = await call("GET", "/api/students?status[$ne]=x", null, A); ok("legacy route unaffected", r.status === 200);

r = await l("GET", "/api/ops/insights"); ok("insights hide money from non-finance staff", r.status === 200 && r.data.feeForecast === null, r.data.feeForecast);

// ── Whole-school roster import ───────────────────────────────────────────
{
  const sheet = [
    { name: "Ali Khan", fatherName: "M. Akram Khan", gender: "Male", className: "Grade 2", section: "Blue", guardianName: "M. Akram Khan", guardianPhone: "3001234567", academicYear: "2026-27" },
    { name: "Sara Khan", fatherName: "Muhammad Akram Khan", gender: "Female", className: "Grade 4", guardianName: "Muhammad Akram Khan", guardianPhone: "0300-1234567", academicYear: "2026-27" },
    { name: "Bilal Raza", fatherName: "Raza Ahmed", gender: "M", className: "Grade 2", section: "Blue", guardianPhone: "0300-1234567, 0321-7654321", academicYear: "2026-27" },
    { name: "Ali Khan", fatherName: "M. Akram Khan", gender: "Male", className: "Grade 2", section: "Blue", guardianPhone: "3001234567", academicYear: "2026-27" },
    { name: "", className: "Grade 2" },
  ];
  r = await a("POST", "/api/lifecycle/students/import-roster", { rows: sheet, dryRun: true });
  ok("roster preview: 3 students, 2 classes, duplicate + blank caught", r.data.students === 3 && r.data.classes.length === 2 && r.data.warnings.some(w => w.level === "error" && /appears twice/.test(w.message)) && r.data.warnings.some(w => /name is empty/.test(w.message)), r.data);
  ok("roster preview: siblings grouped despite spelling, other guardian on same phone kept apart", r.data.families === 2 && r.data.familiesWithSiblings === 1 && r.data.warnings.some(w => w.level === "check"), r.data);
  r = await a("GET", "/api/students"); const before = r.data.length;
  r = await a("POST", "/api/lifecycle/students/import-roster", { rows: sheet, dryRun: false });
  ok("roster import creates students with per-class roll numbers", r.status === 201 && r.data.credentials.length === 3 && r.data.credentials.some(c => c.rollNo === "C2-001") && r.data.credentials.some(c => c.rollNo === "C4-001"), r.data.credentials);
  const ali = r.data.credentials.find(c => c.name === "Ali Khan");
  r = await call("POST", "/api/auth/student-login", { rollNo: ali.rollNo, password: ali.password }); ok("imported student can sign in", !!r.data.token, r);
  r = await a("GET", "/api/students"); ok("students added", r.data.length === before + 3, r.data.length);
  const kids = r.data.filter(x => ["Ali Khan", "Sara Khan"].includes(x.name));
  ok("siblings share one parent record with a fixed phone", kids.length === 2 && kids[0].parentId?._id === kids[1].parentId?._id && kids[0].parentId?.phone.startsWith("0300-1234567"), kids.map(k => k.parentId));
  r = await a("POST", "/api/lifecycle/students/import-roster", { rows: sheet, dryRun: false }); ok("re-importing the same sheet adds nobody", r.data.credentials.length === 0, r.data);
}

// ── Multi-institute isolation ────────────────────────────────────────────
{
  const h2 = (code) => ({ "X-Institute": code });
  const callI = async (method, path, body, token, code) => {
    const r = await fetch(B + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(code ? h2(code) : {}) }, body: body ? JSON.stringify(body) : undefined });
    let data; try { data = await r.json(); } catch { data = null; }
    return { status: r.status, data };
  };
  r = await call("GET", "/api/platform/mode"); ok("platform mode: multi-institute, MAIN is default", r.data.multiTenant === true && r.data.defaultInstitute?.code === "MAIN", r.data);
  r = await call("POST", "/api/platform/login", { email: "owner@smoke.test", password: "wrong" }); ok("owner login rejects bad password", r.status === 401, r);
  const O = (await call("POST", "/api/platform/login", { email: "owner@smoke.test", password: "owner-pass-123" })).data.token; ok("owner login", !!O);
  r = await call("GET", "/api/platform/tenants", null, A); ok("institute admin can't open the platform console", r.status === 401, r);
  r = await call("GET", "/api/students", null, O); ok("owner token can't read institute data", r.status === 403, r);
  r = await call("POST", "/api/platform/tenants", { name: "Second School", code: "second", type: "school", plan: "basic", modules: ["finance", "admissions"], limits: { maxStudents: 2 }, adminEmail: "admin1@uni.edu", adminPassword: "second-pass-1" }, O);
  ok("owner creates a second institute (same admin email as MAIN is fine)", r.status === 201 && r.data.code === "SECOND", r);
  const second = r.data;
  r = await call("POST", "/api/platform/tenants", { name: "Dup", code: "SECOND", adminEmail: "x@x.com", adminPassword: "xxxxxxxx" }, O); ok("institute codes are unique", r.status === 409, r);
  r = await call("GET", "/api/platform/mode"); ok("with two institutes there's no implicit default", r.data.defaultInstitute === null, r.data);
  r = await call("POST", "/api/auth/admin-login", { email: "admin1@uni.edu", password: "admin123" }); ok("login without an institute code is refused", r.status === 400 && r.data.instituteRequired === true, r);
  r = await callI("POST", "/api/auth/admin-login", { email: "admin1@uni.edu", password: "admin123" }, null, "NOPE"); ok("unknown institute code", r.status === 404, r);
  r = await callI("POST", "/api/auth/admin-login", { email: "admin1@uni.edu", password: "admin123" }, null, "SECOND"); ok("MAIN's password doesn't work at SECOND", r.status === 401, r);
  r = await callI("POST", "/api/auth/admin-login", { email: "admin1@uni.edu", password: "second-pass-1" }, null, "SECOND"); ok("SECOND admin signs in", !!r.data.token && r.data.institute?.code === "SECOND", r.data);
  const X = r.data.token;
  const x = (m, p, b) => callI(m, p, b, X);
  r = await x("GET", "/api/students"); ok("new institute starts empty", Array.isArray(r.data) && r.data.length === 0, r.data);
  r = await x("POST", "/api/students", { name: "Same Roll", email: "same@x.com", rollNo: stu.rollNo, password: "pass1234" }); ok("same roll no allowed in another institute", r.status === 201, r);
  const xs = r.data;
  r = await x("GET", `/api/lifecycle/students/${stu._id}/360`); ok("can't open another institute's student by id", r.status === 404 || r.status === 403, r);
  r = await x("PATCH", `/api/students/${stu._id}`, { name: "Hijacked" }); ok("can't edit another institute's student", r.status === 404, r);
  r = await a("GET", `/api/students`); ok("MAIN student untouched and SECOND's not visible", r.data.some(s => s._id === stu._id && s.name !== "Hijacked") && !r.data.some(s => s._id === xs._id), r.data.length);
  r = await x("GET", "/api/finance/summary"); ok("finance totals only cover SECOND", r.data.totals.billed === 0 && r.data.defaulters.length === 0, r.data.totals);
  r = await x("GET", "/api/system/audit"); ok("audit log only shows SECOND's own activity", r.data.every(e => !e.path.includes("/api/finance/structures")), r.data.length);
  r = await x("GET", "/api/system/search?q=Applicant"); ok("global search stays inside the institute", r.data.length === 0, r.data);
  r = await callI("GET", "/api/students", null, A, "SECOND"); ok("token + different institute header refused", r.status === 403 && r.data.instituteMismatch === true, r);
  r = await a("GET", "/api/system/institute"); ok("token keeps working for MAIN after a 2nd institute exists", r.data?.code === "MAIN", r.data);
  r = await x("GET", "/api/library/books"); ok("module outside the plan is blocked", r.status === 403 && r.data.notInPlan === "library", r);
  r = await x("GET", "/api/fees"); ok("module in the plan works", r.status === 200, r);
  r = await x("POST", "/api/students", { name: "Two Two", email: "t2@x.com", rollNo: "S2-002", password: "pass1234" }); ok("2nd student within limit", r.status === 201, r);
  r = await x("POST", "/api/students", { name: "Three", email: "t3@x.com", rollNo: "S2-003", password: "pass1234" }); ok("student limit enforced", r.status >= 400 && /plan allows 2/.test(r.data.error), r);
  r = await callI("POST", "/api/admissions/apply", { name: "Public Applicant", email: "pub@x.com" }, null, "SECOND"); ok("public form lands in the right institute", r.status === 201, r);
  r = await x("GET", "/api/admissions"); ok("…and shows only there", r.data.length === 1 && r.data[0].name === "Public Applicant", r.data.length);
  r = await a("GET", "/api/admissions"); ok("…not in MAIN", !r.data.some(z => z.name === "Public Applicant"), r.data.length);
  r = await callI("GET", "/api/system/public", null, null, "SECOND"); ok("branding per institute", r.data.instituteName === "Second School", r.data);
  r = await call("PATCH", `/api/platform/tenants/${second._id}`, { status: "suspended" }, O); ok("owner suspends institute", r.data.status === "suspended", r);
  await new Promise(res => setTimeout(res, 50));
  r = await x("GET", "/api/students"); ok("suspended institute is locked out", r.status === 403 && r.data.suspended === true, r);
  r = await a("GET", "/api/students"); ok("other institutes unaffected", r.status === 200, r);
  r = await call("PATCH", `/api/platform/tenants/${second._id}`, { status: "active" }, O);
  r = await call("GET", "/api/platform/tenants", null, O); const row = r.data.tenants.find(t => t.code === "SECOND");
  ok("console usage counts per institute", row?.usage.students === 2 && r.data.tenants.find(t => t.code === "MAIN").usage.students > 2, r.data.tenants.map(t => [t.code, t.usage.students]));
  r = await call("POST", `/api/platform/tenants/${second._id}/admin-password`, { email: "admin1@uni.edu", password: "recovered-99" }, O); ok("owner recovers a locked-out admin", r.data.reset === "admin1@uni.edu", r);
  r = await callI("POST", "/api/auth/admin-login", { email: "admin1@uni.edu", password: "recovered-99" }, null, "SECOND"); ok("…who can sign in again", !!r.data.token, r);
  r = await callI("POST", "/api/auth/admin-login", { email: "admin1@uni.edu", password: "admin123" }, null, "MAIN"); ok("MAIN's admin with the same email is unaffected", !!r.data.token, r);
}

// throttle (last: it locks this IP out of the endpoint)
let got429 = false; for (let i = 0; i < 20; i++) { r = await call("POST", "/api/auth/teacher-login", { email: "nobody@x.edu", password: "x" }); if (r.status === 429) { got429 = true; break; } }
ok("login throttle kicks in", got429);
console.log(`\n${pass} passed, ${fail} failed`);
stop(fail ? 1 : 0);
