import bcrypt from "bcryptjs";
import crypto from "crypto";
import AcademicSession from "../models/AcademicSession.js";
import Program from "../models/Program.js";
import Section from "../models/Section.js";
import Student from "../models/studentModel.js";
import Parent from "../models/Parent.js";
import StudentEnrollment from "../models/StudentEnrollment.js";
import { StudentRecord } from "../models/Erp.js";
import { getContext } from "../tenancy/context.js";

// ── Roster import ───────────────────────────────────────────────────────
// Takes a whole-school admission sheet in the standard template
//   name, fatherName, gender, dateOfBirth, rollNumber, registration,
//   className, section, email, phone, guardianName, guardianPhone,
//   guardianEmail, address, enrollmentDate, status, academicYear, notes
// and builds everything the sheet implies, inside the current institute:
// the academic session, one class (programme) per className, its sections,
// one parent record per family (siblings grouped by guardian phone), every
// student with a roll number and one-time password, and their enrolment.
//
// dryRun reports exactly what would be created — plus data problems worth
// fixing first — and writes nothing.

export const ROSTER_COLUMNS = ["name", "fatherName", "gender", "dateOfBirth", "rollNumber", "registration", "className", "section", "email", "phone", "guardianName", "guardianPhone", "guardianEmail", "address", "enrollmentDate", "status", "academicYear", "notes"];

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Pakistani mobile numbers → "03XX-XXXXXXX". Accepts several numbers in one
// cell separated by , / or ;. Fixes a dropped leading zero.
export function normalizePhones(raw) {
  const fixed = [], problems = [];
  for (const part of String(raw ?? "").split(/[,/;]/)) {
    const digits = part.replace(/\D/g, "");
    if (!digits) continue;
    let d = digits;
    if (d.length === 10 && d.startsWith("3")) { d = "0" + d; problems.push(`added the missing leading 0 to ${digits}`); }
    if (d.length === 12 && d.startsWith("923")) d = "0" + d.slice(2);
    if (d.length === 11 && d.startsWith("03")) fixed.push(`${d.slice(0, 4)}-${d.slice(4)}`);
    else { fixed.push(clean(part)); problems.push(`“${clean(part)}” doesn't look like a mobile number`); }
  }
  return { phones: [...new Set(fixed)], problems };
}

// Is this the same guardian written two ways? Honorifics and filler
// ("M.", "Muhammad", "Rana", "ul"…) are ignored; then every name part must
// match, allowing one typo in parts of 5+ letters, and at least one part
// must match exactly. Deliberately conservative: a wrong merge would list
// a child under someone else's father, a missed merge only leaves two
// records for one family.
const FILLER = new Set(["m", "muhammad", "mohammad", "muhamamd", "mohd", "md", "rana", "malik", "rao", "r", "hafiz", "ul", "uz", "ur", "syed", "sheikh", "ch", "chaudhry", "mian", "haji"]);
const nameParts = (n) => clean(n).replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().replace(/[^a-z\s.-]/g, "").replace(/[.-]/g, " ").split(/\s+/).filter(t => t && !FILLER.has(t));
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
export function sameGuardian(a, b) {
  const x = nameParts(a).join(""), y = nameParts(b).join("");
  if (!x || !y) return false;
  if (x === y) return true;
  const p = nameParts(a), q = nameParts(b);
  if (p.length !== q.length) return false;
  let exact = 0;
  for (let i = 0; i < p.length; i++) {
    if (p[i] === q[i]) { exact += 1; continue; }
    if (Math.min(p[i].length, q[i].length) < 5 || editDistance(p[i], q[i]) > 1) return false;
  }
  // No part identical: still the same person if every part is a long
  // name with a single typo and there are at least two parts
  // ("Mubashar Anwer" / "Mubashir Anwar") — never for a one-word name.
  return exact > 0 || p.length >= 2;
}

export function classCode(className) {
  const n = clean(className);
  const m = /^(class|grade)\s*(\d+)$/i.exec(n);
  if (m) return `C${m[2]}`;
  const known = { "pre nursery": "PN", "pre-nursery": "PN", playgroup: "PG", "play group": "PG", nursery: "NUR", kg: "KG", prep: "PREP", kindergarten: "KG" };
  return known[n.toLowerCase()] || n.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 6);
}

const GENDER = { male: "male", m: "male", boy: "male", female: "female", f: "female", girl: "female", other: "other" };
function parseDate(s) {
  const v = clean(s);
  if (!v) return null;
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v); // 05/03/2019 — day first, as written in Pakistan
  const d = dmy ? new Date(Date.UTC(+dmy[3], +dmy[2] - 1, +dmy[1])) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
// One-time passwords without look-alike characters (no 0/O, 1/l/I).
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const tempPassword = () => Array.from(crypto.randomBytes(8), b => ALPHABET[b % ALPHABET.length]).join("");

function sessionDates(name) {
  const m = /^(\d{4})/.exec(name);
  const y = m ? +m[1] : new Date().getFullYear();
  return { startDate: new Date(Date.UTC(y, 3, 1)), endDate: new Date(Date.UTC(y + 1, 2, 31)) }; // April–March school year
}

export async function importRoster(rawRows, { session: sessionName, dryRun = true, passwords = {} } = {}) {
  const warnings = [];
  const rows = [];
  rawRows.forEach((r, i) => {
    const line = i + 2; // header is line 1
    const name = clean(r.name);
    const className = clean(r.className);
    if (!name && !className) return; // blank line
    if (!name || !className) { warnings.push({ line, level: "error", message: `Skipped — ${!name ? "name" : "className"} is empty.` }); return; }
    const guardian = clean(r.guardianName) || clean(r.fatherName);
    const { phones, problems } = normalizePhones(r.guardianPhone || r.phone);
    problems.forEach(p => warnings.push({ line, level: "fixed", message: `${name}: ${p}` }));
    const gender = GENDER[clean(r.gender).toLowerCase()] || "";
    if (r.gender && !gender) warnings.push({ line, level: "warn", message: `${name}: unknown gender “${clean(r.gender)}” left blank` });
    rows.push({
      line, name, fatherName: clean(r.fatherName), gender, dob: parseDate(r.dateOfBirth),
      rollNo: clean(r.rollNumber), registration: clean(r.registration), className, section: clean(r.section) || "A",
      email: clean(r.email).toLowerCase(), phone: clean(r.phone), guardian, phones, guardianEmail: clean(r.guardianEmail).toLowerCase(),
      address: clean(r.address), enrolledOn: parseDate(r.enrollmentDate), active: !/^(inactive|left|withdrawn)$/i.test(clean(r.status)),
      academicYear: clean(r.academicYear), notes: clean(r.notes),
    });
  });
  if (!rows.length) return { dryRun, error: "No usable rows found.", warnings };

  // Session: the one named, else the most common academicYear in the sheet.
  const years = rows.reduce((m, r) => (r.academicYear ? m.set(r.academicYear, (m.get(r.academicYear) || 0) + 1) : m), new Map());
  const name = clean(sessionName) || [...years.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(2)}`;
  const others = [...years.keys()].filter(y => y !== name);
  if (others.length) warnings.push({ level: "info", message: `All students go into session ${name}. ${others.map(y => `${years.get(y)} row(s) say “${y}”`).join(", ")} — kept as a note on each student.` });

  // Plan limit (a clearer message than the per-record refusal).
  const limit = getContext()?.doc?.limits?.maxStudents;
  if (limit) {
    const have = await Student.countDocuments();
    if (have + rows.length > limit) return { dryRun, error: `This institute's plan allows ${limit} students; it has ${have} and the sheet adds ${rows.length}.`, warnings };
  }

  // Duplicates inside the sheet (same student entered twice) and same-name pupils in one class.
  const seen = new Map();
  for (const r of rows) {
    const key = `${r.name}|${r.fatherName}|${r.className}`.toLowerCase();
    if (seen.has(key)) { r.duplicateOf = seen.get(key); warnings.push({ line: r.line, level: "error", message: `${r.name} (${r.fatherName}) appears twice in ${r.className} — line ${seen.get(key)} is used, this one skipped.` }); }
    else seen.set(key, r.line);
  }
  const byClassName = new Map();
  for (const r of rows.filter(x => !x.duplicateOf)) {
    const k = `${r.className}|${r.section}|${r.name}`.toLowerCase();
    byClassName.set(k, [...(byClassName.get(k) || []), r]);
  }
  for (const list of byClassName.values()) if (list.length > 1) warnings.push({ level: "info", message: `${list.length} pupils named “${list[0].name}” in ${list[0].className}${list[0].section !== "A" ? ` ${list[0].section}` : ""} (${list.map(x => x.fatherName).join(" / ")}) — roll numbers will tell them apart.` });
  const usable = rows.filter(r => !r.duplicateOf);

  // Already in the system? (re-running the same sheet must not double-enrol)
  const existing = await Student.find({ name: { $in: usable.map(r => r.name) } }).select("name parentName rollNo");
  const exists = new Set(existing.map(s => `${s.name}|${s.parentName}`.toLowerCase()));
  const fresh = usable.filter(r => {
    if (!exists.has(`${r.name}|${r.fatherName}`.toLowerCase())) return true;
    warnings.push({ line: r.line, level: "skip", message: `${r.name} (${r.fatherName}) is already in the system — skipped.` });
    return false;
  });

  // Classes and sections the sheet needs.
  const classes = new Map();
  for (const r of fresh) {
    const c = classes.get(r.className) || { name: r.className, code: classCode(r.className), sections: new Map() };
    c.sections.set(r.section, (c.sections.get(r.section) || 0) + 1);
    classes.set(r.className, c);
  }
  // Families: siblings share a guardian phone AND the same guardian (allowing
  // for spelling variants — see sameGuardian). A phone shared by different
  // guardians (a relative's or a shop's number) gives separate families.
  const byPhone = new Map();
  for (const r of fresh) {
    const key = r.phones[0] || `name:${nameParts(r.guardian).join("")}`;
    byPhone.set(key, [...(byPhone.get(key) || []), r]);
  }
  const families = new Map();
  for (const [phone, kids] of byPhone) {
    const clusters = [];
    for (const k of kids) {
      const home = clusters.find(c => sameGuardian(c[0].guardian, k.guardian));
      if (home) home.push(k); else clusters.push([k]);
    }
    clusters.forEach((c, i) => families.set(`${phone}#${i}`, c));
    if (clusters.length > 1 && !phone.startsWith("name:")) {
      warnings.push({ level: "check", message: `Phone ${phone} is listed for ${clusters.length} different guardians — ${clusters.map(c => `${c[0].guardian} (${c.map(k => k.name).join(", ")})`).join("; ")}. Kept as separate families; check whether it's a shared or mistyped number.` });
    }
    for (const c of clusters) {
      const spellings = [...new Set(c.map(k => k.guardian))];
      if (spellings.length > 1) warnings.push({ level: "info", message: `Siblings ${c.map(k => k.name).join(", ")}: guardian written as ${spellings.map(n => `“${n}”`).join(" / ")} — treated as one family.` });
    }
  }

  const plan = {
    session: name,
    classes: [...classes.values()].map(c => ({ name: c.name, code: c.code, sections: [...c.sections.entries()].map(([s, n]) => ({ name: s, students: n })) })),
    students: fresh.length,
    families: families.size,
    familiesWithSiblings: [...families.values()].filter(k => k.length > 1).length,
    missing: { dateOfBirth: fresh.filter(r => !r.dob).length, rollNumber: fresh.filter(r => !r.rollNo).length, email: fresh.filter(r => !r.email).length, guardianPhone: fresh.filter(r => !r.phones.length).length },
  };
  if (dryRun) return { dryRun: true, ...plan, warnings };

  // ── write ──────────────────────────────────────────────────────────────
  const session = (await AcademicSession.findOne({ name })) || (await AcademicSession.create({ name, ...sessionDates(name), status: "active" }));
  const programs = new Map(), sections = new Map();
  for (const c of classes.values()) {
    let p = await Program.findOne({ name: new RegExp(`^${escapeRegex(c.name)}$`, "i") });
    if (!p) {
      let code = c.code, n = 1;
      while (await Program.exists({ code })) code = `${c.code}${++n}`;
      p = await Program.create({ name: c.name, code, academicSession: session._id });
    }
    programs.set(c.name, p);
    for (const s of c.sections.keys()) {
      let sec = await Section.findOne({ program: p._id, academicSession: session._id, name: new RegExp(`^${escapeRegex(s)}$`, "i") });
      if (!sec) sec = await Section.create({ name: s, code: `${p.code}-${s}`.toUpperCase().replace(/\s+/g, ""), program: p._id, academicSession: session._id });
      sections.set(`${c.name}|${s}`, sec);
    }
  }

  // Next free roll number per class, continuing after any already used.
  const nextRoll = new Map();
  const reserved = new Set(); // roll numbers already given out in this import
  const rollFor = async (p) => {
    if (!nextRoll.has(p.code)) {
      const used = await Student.find({ rollNo: new RegExp(`^${escapeRegex(p.code)}-\\d+$`) }).select("rollNo");
      nextRoll.set(p.code, used.reduce((m, s) => Math.max(m, Number(s.rollNo.split("-").pop())), 0));
    }
    for (;;) {
      const n = nextRoll.get(p.code) + 1;
      nextRoll.set(p.code, n);
      const roll = `${p.code}-${String(n).padStart(3, "0")}`;
      if (!(await Student.exists({ rollNo: roll })) && !reserved.has(roll)) return roll;
    }
  };

  // Roll numbers are handed out down each class in the order of the sheet,
  // before families are created (which would otherwise set the order).
  const rollOf = new Map();
  for (const r of fresh) {
    const program = programs.get(r.className);
    const wanted = r.rollNo && !reserved.has(r.rollNo) && !(await Student.exists({ rollNo: r.rollNo })) ? r.rollNo : await rollFor(program);
    if (r.rollNo && r.rollNo !== wanted) warnings.push({ line: r.line, level: "fixed", message: `${r.name}: roll number ${r.rollNo} was taken — given ${wanted}.` });
    rollOf.set(r, wanted);
    reserved.add(wanted);
  }

  const credentials = [];
  let parentsCreated = 0;
  for (const kids of families.values()) {
    const first = kids[0];
    // Re-use a family already in the system (same phone, same guardian).
    const candidates = first.phones[0] ? await Parent.find({ phone: new RegExp(`^${escapeRegex(first.phones[0])}`) }) : [];
    let parent = candidates.find(p => sameGuardian(p.name, first.guardian)) || null;
    if (!parent) {
      const whatsapp = /whats\s*app/i.test(first.notes) && first.phones[1] ? first.phones[1] : "";
      parent = await Parent.create({ name: first.guardian || "Guardian", phone: first.phones.join(", "), whatsappNumber: whatsapp, email: first.guardianEmail });
      parentsCreated += 1;
    }
    for (const r of kids) {
      const program = programs.get(r.className);
      const section = sections.get(`${r.className}|${r.section}`);
      const rollNo = rollOf.get(r);
      // Reuse a password already handed out for this roll number (e.g. a
      // logins sheet printed before the live import); otherwise a fresh one.
      const password = passwords[`${rollNo}|${r.name}`] || tempPassword();
      const student = await Student.create({
        name: r.name, rollNo, password: await bcrypt.hash(password, 10), email: r.email || undefined, phone: r.phone,
        gender: r.gender, dob: r.dob, parentName: r.fatherName || r.guardian, parentEmail: r.guardianEmail || undefined, parentId: parent._id,
        registrationNo: r.registration, address: r.address, admissionDate: r.enrolledOn, isActive: r.active, lifecycleStatus: r.active ? "active" : "withdrawn",
      });
      const enrollment = await StudentEnrollment.create({ student: student._id, academicSession: session._id, program: program._id, section: section._id, enrolledAt: r.enrolledOn || new Date() });
      await Student.updateOne({ _id: student._id }, { currentEnrollment: enrollment._id });
      const note = [r.academicYear && r.academicYear !== name ? `Academic year on admission sheet: ${r.academicYear}` : "", r.notes].filter(Boolean).join(". ");
      if (note) await StudentRecord.create({ student: student._id, kind: "note", title: "Imported from admission sheet", details: note, recordedBy: "Roster import" });
      credentials.push({ name: r.name, fatherName: r.fatherName, className: r.className, section: r.section, rollNo, password });
    }
  }
  credentials.sort((a, b) => a.rollNo.localeCompare(b.rollNo, undefined, { numeric: true }));
  return { dryRun: false, ...plan, parentsCreated, credentials, warnings };
}
