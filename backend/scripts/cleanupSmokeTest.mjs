// ══════════════════════════════════════════════════════════════════
//  One-off cleanup — removes the records an automated API smoke test
//  wrote into this database by mistake on 14 Oct 2026, ~01:41–01:44 PKT.
//
//  What happened: the test was meant for a throwaway local database but
//  hit the real backend on port 5001 instead. It created a fake session,
//  program, teacher, students, fees, staff, payroll, etc., renamed the
//  institute to "Test University" and switched on a flat late fee.
//
//  Usage (from backend/):
//    node scripts/cleanupSmokeTest.mjs            dry run — lists what it WOULD remove
//    node scripts/cleanupSmokeTest.mjs --apply    actually removes it
//
//  Safety: a record is only ever selected if it was created inside the
//  test's time window AND either carries one of the test's unmistakable
//  markers (six-digit-tagged names, @x.edu / @x.com addresses) or hangs
//  off a record that does. Nothing older than the window can be touched.
//  With --apply, everything removed is first saved to
//  scripts/cleanupSmokeTest.backup.json.
// ══════════════════════════════════════════════════════════════════
import dotenv from "dotenv";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });
const APPLY = process.argv.includes("--apply");

// 14 Oct 2026 01:36–01:50 PKT (UTC+5), with a few minutes' margin either side.
// (CLEANUP_FROM / CLEANUP_TO exist only so the script itself could be
// tested against a local copy of the same test data.)
const FROM = new Date(process.env.CLEANUP_FROM || "2026-10-13T20:36:00Z");
const TO = new Date(process.env.CLEANUP_TO || "2026-10-13T20:50:00Z");
const idWindow = {
  $gte: mongoose.Types.ObjectId.createFromTime(Math.floor(FROM / 1000)),
  $lte: mongoose.Types.ObjectId.createFromTime(Math.floor(TO / 1000)),
};

(async () => {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set — check backend/.env"); process.exit(1); }
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log(`Connected to ${db.databaseName}  —  ${APPLY ? "APPLY mode" : "DRY RUN (nothing will be changed)"}\n`);

  const plan = []; // [collection, filter]
  const col = (name) => db.collection(name);
  const ids = async (name, filter) => (await col(name).find({ _id: idWindow, ...filter }).project({ _id: 1 }).toArray()).map(d => d._id);
  const add = (name, filter) => plan.push([name, { _id: idWindow, ...filter }]);

  // ── Anchors: records the test named with its own six-digit tag ──────────
  const sessions = await ids("academicsessions", { name: /^S\d{6}$/ });
  const programs = await ids("programs", { code: /^BST\d{6}$/ });
  const subjects = await ids("subjects", { code: /^AL\d{6}$/ });
  const teachers = await ids("teachers", { email: /^t\d{6}@x\.edu$/ });
  const students = await ids("students", { rollNo: /^(R|I1|I2)\d{6}$/ });
  const parents = await ids("parents", { email: /^g\d{6}@x\.com$/ });
  const departments = await ids("departments", { code: /^CS\d{6}$/ });
  const books = await ids("books", { title: /^CLRS \d{6}$/ });
  const routes = await ids("transportroutes", { name: /^R1 \d{6}$/ });
  const hostels = await ids("hostels", { name: /^H \d{6}$/ });
  const structures = await ids("feestructures", { name: /^Sem Fee \d{6}$/ });

  // ── Dependents: reachable only through an anchor ───────────────────────
  const sections = await ids("sections", { program: { $in: programs } });
  const tas = await ids("teacherassignments", { teacher: { $in: teachers } });
  const staff = await ids("staffs", { department: { $in: departments } });
  const rooms = await ids("hostelrooms", { hostel: { $in: hostels } });
  const coursework = await ids("assignments", { teacherAssignment: { $in: tas } });
  const quizzes = await ids("quizzes", { teacherAssignment: { $in: tas } });
  const groups = await ids("chatgroups", { teacherAssignment: { $in: tas } });
  const people = [...students.map(String), ...teachers.map(String), ...parents.map(String)];

  add("groupmessages", { group: { $in: groups } });
  add("chatgroups", { _id: { $in: groups } });
  add("submissions", { student: { $in: students } });
  add("quizattempts", { student: { $in: students } });
  add("assignments", { _id: { $in: coursework } });
  add("quizzes", { _id: { $in: quizzes } });
  add("courseresults", { teacherAssignment: { $in: tas } });
  add("gradebookconfigs", { teacherAssignment: { $in: tas } });
  add("subjectattendances", { teacherAssignment: { $in: tas } });
  add("fees", { studentId: { $in: students } });
  add("scholarships", { student: { $in: students } });
  add("feestructures", { _id: { $in: structures } });
  add("paymentclaims", { student: { $in: students } });
  add("bookissues", { book: { $in: books } });
  add("books", { _id: { $in: books } });
  add("transportassignments", { route: { $in: routes } });
  add("transportroutes", { _id: { $in: routes } });
  add("hostelallocations", { room: { $in: rooms } });
  add("hostelrooms", { _id: { $in: rooms } });
  add("hostels", { _id: { $in: hostels } });
  add("payslips", { staff: { $in: staff } });
  add("staffattendances", { staff: { $in: staff } });
  add("staffleaves", { staff: { $in: staff } });
  add("staffs", { _id: { $in: staff } });
  add("departments", { _id: { $in: departments } });
  add("certificates", { student: { $in: students } });
  add("alumnis", { student: { $in: students } });
  add("studentrecords", { student: { $in: students } });
  add("tickets", { raisedById: { $in: people } });
  add("notifications", { recipientId: { $in: [...students, ...parents, ...teachers] } });
  add("admissions", { email: /^app\d{6}@x\.com$/ });
  add("studentenrollments", { student: { $in: students } });
  add("teacherassignments", { _id: { $in: tas } });
  add("sections", { _id: { $in: sections } });
  add("subjects", { _id: { $in: subjects } });
  add("programs", { _id: { $in: programs } });
  add("academicsessions", { _id: { $in: sessions } });
  add("students", { _id: { $in: students } });
  add("parents", { _id: { $in: parents } });
  add("teachers", { _id: { $in: teachers } });
  // The test's librarian login (password "librarian1") — remove promptly.
  add("admins", { email: /^lib\d{6}@x\.edu$/ });
  // Free-standing rows with no tag: matched on exact test values + the window.
  add("expenses", { $or: [{ title: "Electricity", amount: 7000 }, { title: /^Payroll \d{4}-\d{2} \(\d+ staff\)$/, reference: /^PAYROLL-/ }] });
  add("calendarevents", { $or: [{ title: "Staff meet", type: "meeting" }, { title: "Eid", type: "holiday" }] });

  const backup = {};
  let total = 0;
  for (const [name, filter] of plan) {
    const docs = await col(name).find(filter).toArray();
    if (!docs.length) continue;
    total += docs.length;
    const label = (d) => d.name || d.title || d.email || d.rollNo || d.code || d.serialNo || d.ticketNo || d.applicationNo || d.month || "";
    console.log(`${name.padEnd(22)} ${String(docs.length).padStart(4)}   ${docs.slice(0, 4).map(label).filter(Boolean).join(", ")}${docs.length > 4 ? ", …" : ""}`);
    if (APPLY) {
      backup[name] = docs;
      await col(name).deleteMany({ _id: { $in: docs.map(d => d._id) } });
    }
  }

  // ── Settings the test overwrote ────────────────────────────────────────
  const settings = await col("settings").findOne({ key: "main" });
  if (settings?.instituteName === "Test University" || (settings?.lateFeeType === "flat" && settings?.lateFeeValue === 500)) {
    console.log(`\nsettings: instituteName="${settings.instituteName}", lateFee=${settings.lateFeeType}/${settings.lateFeeValue}  →  reset to "ACADEXA Institute", no late fee`);
    console.log("          (set your real institute name afterwards under Settings → Institute & Policies)");
    if (APPLY) {
      backup.settings = [settings];
      await col("settings").updateOne({ _id: settings._id }, { $set: { instituteName: "ACADEXA Institute", lateFeeType: "none", lateFeeValue: 0 } });
    }
  }

  // ── Things this script deliberately does NOT change ────────────────────
  const fined = await col("fees").countDocuments({ fine: 500, updatedAt: { $gte: FROM, $lte: TO }, studentId: { $nin: students } });
  if (fined) console.log(`\n⚠  ${fined} fee line(s) belonging to REAL students were updated in the window with a fine of 500.\n   The test's "apply late fees" step may have fined them. Review under Fee Collection and waive\n   (the ⚙ button on each line) — this script leaves real students' fees alone.`);
  const realSlips = await col("payslips").countDocuments({ _id: idWindow, staff: { $nin: staff } });
  if (realSlips) console.log(`\n⚠  ${realSlips} payslip(s) for REAL staff were generated/paid in the window by the test's payroll run.\n   Review under Payroll — this script leaves them alone.`);
  console.log(`\nAudit-log entries from the window are kept on purpose: they are the record of what the test did.`);

  if (APPLY) {
    const file = path.join(__dirname, "cleanupSmokeTest.backup.json");
    fs.writeFileSync(file, JSON.stringify(backup, null, 2));
    console.log(`\n✅ Removed ${total} record(s). Backup of everything removed: ${file}`);
  } else {
    console.log(`\n${total} record(s) would be removed. Re-run with --apply to remove them.`);
  }
  await mongoose.disconnect();
})().catch(e => { console.error("❌ Cleanup failed:", e); process.exit(1); });
