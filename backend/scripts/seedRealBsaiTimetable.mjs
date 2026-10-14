// ══════════════════════════════════════════════════════════════════
//  REAL BS AI TIMETABLE SEED — npm run seed:bsai-timetable
// ══════════════════════════════════════════════════════════════════
// Loads the user's actual, real BS Artificial Intelligence — Section A
// weekly timetable (transcribed directly from the source image, confirmed
// row→day mapping: Row1=Monday..Row5=Friday) into the real academic
// hierarchy: reuses the existing "2026-27 (Demo)" AcademicSession, the
// existing "BS Artificial Intelligence" Program, and its existing Section
// A — creates only what's genuinely new (the 7 real teachers, 10 real
// subjects with real course codes, 4 real rooms, 8 real TeacherAssignments,
// and 17 real TimetableEntry rows).
//
// Every write is an upsert keyed on a natural unique field (Teacher.email,
// Subject.code, Room.name, TeacherAssignment's compound index, and
// TimetableEntry's compound index) — safe to re-run any number of times,
// never creates duplicates, never touches unrelated data.
//
// Two "TBA" course slots (CSC262L, CSC243L) have no teacher assigned in the
// source timetable — no TeacherAssignment or placeholder "TBA" teacher
// account is created for those; the TimetableEntry rows are inserted with
// teacher: null, exactly as the spec requires (see TimetableEntry.js's
// comment for why a fake placeholder teacher account was deliberately not
// used instead).
import "../src/tenancy/register.js"; // institute isolation — must be the first import
import dotenv from "dotenv";
import mongoose from "mongoose";
import { resolveInstitute, inInstitute } from "./lib/institute.js";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

import AcademicSession from "../src/models/AcademicSession.js";
import Program from "../src/models/Program.js";
import Section from "../src/models/Section.js";
import Subject from "../src/models/Subject.js";
import Teacher from "../src/models/Teacher.js";
import Room from "../src/models/Room.js";
import TeacherAssignment from "../src/models/TeacherAssignment.js";
import TimetableEntry from "../src/models/TimetableEntry.js";
import { findAllConflicts } from "../src/services/timetableConflicts.js";

const TEMP_TEACHER_PASSWORD = "BsaiTeach#2026"; // placeholder login — real emails/passwords unknown, see final report

function log(msg) { console.log(`  ${msg}`); }

// ── Real teachers, exactly as they appear in the source timetable
// (honorific spelling preserved verbatim, including the "Miss." vs "Miss"
// inconsistency between entries — reported, not silently fixed) ──────────
const TEACHERS = [
  { name: "Miss. Alina Yaqoob", email: "alina.yaqoob@bsai.acadexa.local" },
  { name: "Mr. Abdul Malik", email: "abdul.malik@bsai.acadexa.local" },
  { name: "Miss. Maria Rabbani", email: "maria.rabbani@bsai.acadexa.local" },
  { name: "Mr. Faisal Naeem", email: "faisal.naeem@bsai.acadexa.local" },
  { name: "Mr. Shahid Mehmood", email: "shahid.mehmood@bsai.acadexa.local" },
  { name: "Mr. Obaid ur Rehman", email: "obaid.ur.rehman@bsai.acadexa.local" },
  { name: "Miss Sobia Ayub", email: "sobia.ayub@bsai.acadexa.local" },
];

// ── Real subjects — real course codes from the timetable, not the
// DEMO-* demo catalog (a different, unrelated set of subjects) ───────────
const SUBJECTS = [
  { code: "CSC221", name: "Software Engineering" },
  { code: "CSC221L", name: "Software Engineering Lab" }, // in the spec's subject list; no slot for it in the actual image grid
  { code: "CSC213", name: "Data Structures" },
  { code: "CSC213L", name: "Data Structures Lab" },
  { code: "CSC262", name: "Artificial Intelligence" },
  { code: "CSC262L", name: "Artificial Intelligence Lab" },
  { code: "CSC243", name: "Computer Organization and Assembly Language" },
  { code: "CSC243L", name: "Computer Organization and Assembly Language Lab" },
  { code: "GEN211", name: "Islamic Studies" },
  { code: "MTH112", name: "Calculus and Analytical Geometry" },
];

// ── Real rooms — only fields actually known are set; capacity/building
// are left null, and `type` is inferred only from the room's own name
// ("...Lab..." => lab), never guessed from a code prefix ─────────────────
const ROOMS = [
  { name: "A2H2", type: "classroom" },
  { name: "B205", type: "classroom" },
  { name: "B103", type: "classroom" },
  { name: "Computer Lab 4 BSAI", type: "lab" },
];

// ── Real TeacherAssignments — only for subjects with a confirmed teacher
// in the timetable. CSC262L and CSC243L are intentionally absent (TBA). ──
const ASSIGNMENTS = [
  { teacherEmail: "alina.yaqoob@bsai.acadexa.local", subjectCode: "CSC221" },
  { teacherEmail: "alina.yaqoob@bsai.acadexa.local", subjectCode: "CSC221L" },
  { teacherEmail: "abdul.malik@bsai.acadexa.local", subjectCode: "CSC213" },
  { teacherEmail: "maria.rabbani@bsai.acadexa.local", subjectCode: "CSC213L" },
  { teacherEmail: "shahid.mehmood@bsai.acadexa.local", subjectCode: "CSC262" },
  { teacherEmail: "faisal.naeem@bsai.acadexa.local", subjectCode: "CSC243" },
  { teacherEmail: "obaid.ur.rehman@bsai.acadexa.local", subjectCode: "GEN211" },
  { teacherEmail: "sobia.ayub@bsai.acadexa.local", subjectCode: "MTH112" },
];

// ── The real weekly schedule — row→day mapping confirmed by the user:
// Row1=Monday, Row2=Tuesday, Row3=Wednesday, Row4=Thursday, Row5=Friday.
// teacherEmail: null means TBA in the source image. ───────────────────────
const SCHEDULE = [
  // Monday
  { day: "Monday", startTime: "12:00", endTime: "13:30", subjectCode: "CSC221", type: "Lecture", roomName: "Computer Lab 4 BSAI", teacherEmail: "alina.yaqoob@bsai.acadexa.local" },
  { day: "Monday", startTime: "13:30", endTime: "15:00", subjectCode: "CSC213L", type: "Lab", roomName: "Computer Lab 4 BSAI", teacherEmail: "maria.rabbani@bsai.acadexa.local" },
  { day: "Monday", startTime: "15:00", endTime: "16:30", subjectCode: "CSC213", type: "Lecture", roomName: "A2H2", teacherEmail: "abdul.malik@bsai.acadexa.local" },
  // Tuesday
  { day: "Tuesday", startTime: "12:00", endTime: "13:30", subjectCode: "CSC262L", type: "Lab", roomName: "Computer Lab 4 BSAI", teacherEmail: null },
  { day: "Tuesday", startTime: "13:30", endTime: "15:00", subjectCode: "CSC213L", type: "Lab", roomName: "Computer Lab 4 BSAI", teacherEmail: "maria.rabbani@bsai.acadexa.local" },
  { day: "Tuesday", startTime: "15:00", endTime: "16:30", subjectCode: "CSC213", type: "Lecture", roomName: "Computer Lab 4 BSAI", teacherEmail: "abdul.malik@bsai.acadexa.local" },
  // Wednesday
  { day: "Wednesday", startTime: "10:30", endTime: "12:00", subjectCode: "CSC243L", type: "Lab", roomName: "Computer Lab 4 BSAI", teacherEmail: null },
  { day: "Wednesday", startTime: "12:00", endTime: "13:30", subjectCode: "GEN211", type: "Lecture", roomName: "B103", teacherEmail: "obaid.ur.rehman@bsai.acadexa.local" },
  { day: "Wednesday", startTime: "13:30", endTime: "15:00", subjectCode: "CSC221", type: "Lecture", roomName: "Computer Lab 4 BSAI", teacherEmail: "alina.yaqoob@bsai.acadexa.local" },
  { day: "Wednesday", startTime: "15:00", endTime: "16:30", subjectCode: "CSC262L", type: "Lab", roomName: "Computer Lab 4 BSAI", teacherEmail: null },
  // Thursday
  { day: "Thursday", startTime: "09:00", endTime: "10:30", subjectCode: "MTH112", type: "Lecture", roomName: "B205", teacherEmail: "sobia.ayub@bsai.acadexa.local" },
  { day: "Thursday", startTime: "10:30", endTime: "12:00", subjectCode: "CSC243L", type: "Lab", roomName: "Computer Lab 4 BSAI", teacherEmail: null },
  { day: "Thursday", startTime: "13:30", endTime: "14:30", subjectCode: "CSC243", type: "Lecture", roomName: "Computer Lab 4 BSAI", teacherEmail: "faisal.naeem@bsai.acadexa.local" },
  { day: "Thursday", startTime: "15:00", endTime: "16:00", subjectCode: "CSC262", type: "Lecture", roomName: "Computer Lab 4 BSAI", teacherEmail: "shahid.mehmood@bsai.acadexa.local" },
  // Friday
  { day: "Friday", startTime: "09:00", endTime: "10:30", subjectCode: "MTH112", type: "Lecture", roomName: "B205", teacherEmail: "sobia.ayub@bsai.acadexa.local" },
  { day: "Friday", startTime: "10:30", endTime: "11:30", subjectCode: "CSC243", type: "Lecture", roomName: "Computer Lab 4 BSAI", teacherEmail: "faisal.naeem@bsai.acadexa.local" },
  { day: "Friday", startTime: "15:00", endTime: "16:00", subjectCode: "CSC262", type: "Lecture", roomName: "A2H2", teacherEmail: "shahid.mehmood@bsai.acadexa.local" },
];

async function run() {
  if (!process.env.MONGO_URI) { console.error("MONGO_URI not set — check backend/.env"); process.exit(1); }
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`\n🗓️  Seeding real BS AI timetable into ${mongoose.connection.host}/${mongoose.connection.name}\n`);
  // On a multi-institute database pass --institute CODE.
  const institute = await resolveInstitute();
  await inInstitute(institute, seedTimetable);
  await mongoose.disconnect();
}

async function seedTimetable() {

  const session = await AcademicSession.findOne({ status: "active" });
  if (!session) throw new Error("No active AcademicSession found — cannot proceed without one.");
  log(`Reusing academic session: ${session.name}`);

  const program = await Program.findOne({ name: /artificial intelligence/i });
  if (!program) throw new Error('No "BS Artificial Intelligence" Program found — cannot proceed.');
  log(`Reusing program: ${program.name} (${program.code})`);

  const section = await Section.findOne({ program: program._id, name: "A" });
  if (!section) throw new Error('No Section "A" found for BS Artificial Intelligence — cannot proceed.');
  log(`Reusing section: ${section.name} (${section.code})`);

  // ── Teachers (upsert by email) ─────────────────────────────────────────
  const passwordHash = await bcrypt.hash(TEMP_TEACHER_PASSWORD, 10);
  const teacherByEmail = {};
  for (const t of TEACHERS) {
    let doc = await Teacher.findOne({ email: t.email });
    if (!doc) {
      doc = await Teacher.create({ name: t.name, email: t.email, password: passwordHash, isActive: true });
      log(`+ Created teacher: ${t.name} <${t.email}>`);
    } else {
      log(`= Teacher already exists: ${t.name}`);
    }
    teacherByEmail[t.email] = doc;
  }

  // ── Subjects (upsert by code) ───────────────────────────────────────────
  const subjectByCode = {};
  for (const s of SUBJECTS) {
    let doc = await Subject.findOne({ code: s.code });
    if (!doc) {
      doc = await Subject.create({ code: s.code, name: s.name });
      log(`+ Created subject: ${s.code} — ${s.name}`);
    } else {
      log(`= Subject already exists: ${s.code}`);
    }
    subjectByCode[s.code] = doc;
  }

  // ── Rooms (upsert by name) ──────────────────────────────────────────────
  const roomByName = {};
  for (const r of ROOMS) {
    let doc = await Room.findOne({ name: r.name });
    if (!doc) {
      doc = await Room.create({ name: r.name, type: r.type });
      log(`+ Created room: ${r.name} (${r.type})`);
    } else {
      log(`= Room already exists: ${r.name}`);
    }
    roomByName[r.name] = doc;
  }

  // ── TeacherAssignments (upsert on the model's own compound index) ──────
  const assignmentByKey = {}; // subjectCode -> TeacherAssignment doc
  for (const a of ASSIGNMENTS) {
    const teacher = teacherByEmail[a.teacherEmail];
    const subject = subjectByCode[a.subjectCode];
    let doc = await TeacherAssignment.findOne({
      teacher: teacher._id, academicSession: session._id, program: program._id, section: section._id, subject: subject._id,
    });
    if (!doc) {
      doc = await TeacherAssignment.create({
        teacher: teacher._id, academicSession: session._id, program: program._id, section: section._id, subject: subject._id, status: "active",
      });
      log(`+ Assigned ${teacher.name} → ${subject.code}`);
    } else {
      log(`= Assignment already exists: ${teacher.name} → ${subject.code}`);
    }
    assignmentByKey[a.subjectCode] = doc;
  }

  // ── Validate the proposed schedule for conflicts BEFORE inserting ──────
  const candidateEntries = SCHEDULE.map(e => ({
    day: e.day, startTime: e.startTime, endTime: e.endTime,
    teacher: e.teacherEmail ? teacherByEmail[e.teacherEmail]._id : null,
    room: roomByName[e.roomName]._id,
    section: section._id,
    subject: subjectByCode[e.subjectCode]._id,
  }));
  const conflicts = findAllConflicts(candidateEntries);
  if (conflicts.length > 0) {
    console.log("\n⚠️  CONFLICTS DETECTED — aborting insert, no schedule rows written:");
    conflicts.forEach(c => console.log(`  [${c.type}] ${c.a.day} ${c.a.startTime}-${c.a.endTime} vs ${c.b.day} ${c.b.startTime}-${c.b.endTime}`));
    process.exitCode = 1;
    await mongoose.disconnect();
    return;
  }
  log("Conflict check passed — no teacher, room, or section conflicts.");

  // ── TimetableEntry (upsert on the model's own compound index) ──────────
  let created = 0, existed = 0;
  for (const e of SCHEDULE) {
    const subject = subjectByCode[e.subjectCode];
    const room = roomByName[e.roomName];
    const teacherAssignment = assignmentByKey[e.subjectCode] || null;
    const teacher = e.teacherEmail ? teacherByEmail[e.teacherEmail]._id : null;

    const query = {
      academicSession: session._id, program: program._id, section: section._id,
      day: e.day, startTime: e.startTime, subject: subject._id, room: room._id,
    };
    const existingDoc = await TimetableEntry.findOne(query);
    if (existingDoc) {
      existed++;
      continue;
    }
    await TimetableEntry.create({
      ...query,
      endTime: e.endTime,
      type: e.type,
      teacherAssignment: teacherAssignment ? teacherAssignment._id : null,
      teacher,
    });
    created++;
  }
  log(`Timetable entries: ${created} created, ${existed} already existed.`);

  console.log("\n✅ Real BS AI timetable seed complete.\n");
  console.log("── Placeholder teacher login credentials (please have them reset on first login) ──");
  console.log(`  Password for all 7 new teacher accounts: ${TEMP_TEACHER_PASSWORD}`);
  TEACHERS.forEach(t => console.log(`  ${t.name.padEnd(24)} ${t.email}`));
  console.log("─────────────────────────────────────────────────────────────────────────────────\n");
}

run().catch(err => {
  console.error("Seed failed:", err);
  process.exitCode = 1;
});
