import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { auth } from "../middleware/auth.js";
import { h, httpError, pick } from "../utils/crudRouter.js";
import { buildTranscript } from "./resultRoute.js";
import { importRoster } from "../services/rosterImport.js";
import { Alumni, BookIssue, HostelAllocation, TransportAssignment, StudentRecord, Certificate, Scholarship } from "../models/Erp.js";
import Student from "../models/studentModel.js";
import Section from "../models/Section.js";
import StudentEnrollment from "../models/StudentEnrollment.js";
import SubjectAttendance from "../models/SubjectAttendance.js";
import Fee from "../models/FeeModel.js";
import Leave from "../models/leavemodel.js";

// Student lifecycle beyond day-to-day teaching: bulk import, the extended
// profile, the single-screen "360" view, and end-of-term promotion /
// graduation. Admin only.
const router = express.Router();
router.use(auth("admin"));

export async function attendanceSummary(studentId) {
  const rows = await SubjectAttendance.find({ student: studentId }).select("status subject").populate("subject", "name code");
  const bySubject = new Map();
  let present = 0;
  for (const r of rows) {
    if (r.status === "present") present += 1;
    const key = String(r.subject?._id || "?");
    const s = bySubject.get(key) || { subject: r.subject, present: 0, absent: 0, leave: 0, total: 0 };
    s[r.status] += 1;
    s.total += 1;
    bySubject.set(key, s);
  }
  return {
    total: rows.length, present,
    rate: rows.length ? Math.round((present / rows.length) * 100) : null,
    subjects: [...bySubject.values()].map(s => ({ ...s, rate: Math.round((s.present / s.total) * 100) })),
  };
}

// ═══════════════════════════ BULK IMPORT ═══════════════════════════════════
// Rows are validated and inserted one by one so a bad row is reported
// against its line number instead of failing the whole file. Each new
// student gets a random one-time password, returned once in the response.
router.post("/students/import", h(async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (!rows.length) throw httpError(400, "No rows to import.");
  if (rows.length > 500) throw httpError(400, "Import at most 500 students at a time.");
  const section = req.body.section ? await Section.findById(req.body.section) : null;
  if (req.body.section && !section) throw httpError(404, "Section not found");
  if (section?.capacity) {
    const filled = await StudentEnrollment.countDocuments({ section: section._id, status: "active" });
    if (filled + rows.length > section.capacity) throw httpError(409, `Section ${section.name} has room for ${Math.max(0, section.capacity - filled)} more student(s); this file has ${rows.length}.`);
  }

  const created = [], errors = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || {};
    const line = i + 2; // +1 for the header row, +1 for 1-based numbering
    const name = String(r.name || "").trim(), rollNo = String(r.rollNo || "").trim(), email = String(r.email || "").trim().toLowerCase();
    if (name.length < 2 || !rollNo) { errors.push({ line, rollNo, error: "name and rollNo are required" }); continue; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errors.push({ line, rollNo, error: "invalid email" }); continue; }
    try {
      const tempPassword = crypto.randomBytes(6).toString("base64url");
      const student = await Student.create({
        name, rollNo, email: email || undefined, password: await bcrypt.hash(tempPassword, 10),
        phone: r.phone || "", parentName: r.parentName || "", parentEmail: r.parentEmail || undefined,
        registrationNo: r.registrationNo || "", gender: ["male", "female", "other"].includes(String(r.gender).toLowerCase()) ? String(r.gender).toLowerCase() : "",
        admissionDate: new Date(),
      });
      if (section) {
        const enrollment = await StudentEnrollment.create({ student: student._id, academicSession: section.academicSession, program: section.program, section: section._id });
        student.currentEnrollment = enrollment._id;
        await student.save();
      }
      created.push({ name, rollNo, tempPassword });
    } catch (e) {
      errors.push({ line, rollNo, error: e.code === 11000 ? "roll number already exists" : e.message });
    }
  }
  res.status(created.length ? 201 : 400).json({ created, errors });
}));

// Whole-school admission sheet (className, section, guardianPhone…) —
// creates classes, sections, families and students together. See
// services/rosterImport.js. dryRun: true previews without writing.
router.post("/students/import-roster", h(async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (!rows.length) throw httpError(400, "No rows to import.");
  if (rows.length > 3000) throw httpError(400, "Import at most 3000 students at a time.");
  const out = await importRoster(rows, { session: req.body.session, dryRun: req.body.dryRun !== false });
  if (out.error) throw httpError(400, out.error);
  res.status(out.dryRun ? 200 : 201).json(out);
}));

// ═══════════════════════════ PROFILE & 360 ═════════════════════════════════
const PROFILE_FIELDS = ["phone", "dob", "gender", "bloodGroup", "nationalId", "address", "city", "emergencyContact", "admissionDate", "previousInstitute", "lifecycleStatus", "parentName", "registrationNo", "parentId"];

router.patch("/students/:id/profile", h(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) throw httpError(404, "Student not found");
  student.set(pick(req.body, PROFILE_FIELDS));
  // A student who has left can no longer be treated as active elsewhere.
  if (req.body.lifecycleStatus) student.isActive = req.body.lifecycleStatus === "active";
  await student.save();
  res.json(student.toSafeObject());
}));

router.get("/students/:id/360", h(async (req, res) => {
  const id = req.params.id;
  const student = await Student.findById(id).populate("parentId").populate({ path: "currentEnrollment", populate: [{ path: "program", select: "name code" }, { path: "section", select: "name" }, { path: "academicSession", select: "name" }] });
  if (!student) throw httpError(404, "Student not found");
  const [enrollments, attendance, fees, transcript, leaves, loans, hostel, transport, records, certificates, scholarships] = await Promise.all([
    StudentEnrollment.find({ student: id }).populate("program", "name code").populate("section", "name").populate("academicSession", "name").sort({ enrolledAt: -1 }),
    attendanceSummary(id),
    Fee.find({ studentId: id }).sort({ dueDate: -1 }),
    buildTranscript(id, { publishedOnly: false }),
    Leave.find({ studentId: id }).sort({ appliedAt: -1 }).limit(20),
    BookIssue.find({ student: id }).populate("book", "title author").sort({ issuedOn: -1 }).limit(20),
    HostelAllocation.findOne({ student: id, status: "active" }).populate({ path: "room", populate: { path: "hostel", select: "name" } }),
    TransportAssignment.findOne({ student: id }).populate("route", "name vehicleNo"),
    StudentRecord.find({ student: id }).sort({ date: -1 }),
    Certificate.find({ student: id }).sort({ issuedOn: -1 }),
    Scholarship.find({ student: id }),
  ]);
  res.json({
    student: student.toSafeObject(), enrollments, attendance, transcript, leaves, loans, hostel, transport, records, certificates, scholarships,
    fees: {
      items: fees,
      billed: fees.reduce((s, f) => s + f.netAmount, 0),
      balance: fees.reduce((s, f) => s + f.balance, 0),
    },
  });
}));

// ═══════════════════════════ PROMOTION / GRADUATION ════════════════════════
// Moves a whole section (or a chosen subset) forward at the end of a term.
// Enrolments are append-only (see StudentEnrollment.js): the old row is
// closed as "completed" and a new one opened — history is never rewritten.
router.post("/promote", h(async (req, res) => {
  const { fromSection, toSection, studentIds, outcome = "promote" } = req.body;
  if (!fromSection) throw httpError(400, "Choose the section to promote from.");
  if (!["promote", "graduate"].includes(outcome)) throw httpError(400, "outcome must be promote or graduate");

  const filter = { section: fromSection, status: "active" };
  if (Array.isArray(studentIds) && studentIds.length) filter.student = { $in: studentIds };
  const current = await StudentEnrollment.find(filter).populate("program", "name");
  if (!current.length) throw httpError(400, "No active students found in that section.");

  let target = null;
  if (outcome === "promote") {
    if (!toSection) throw httpError(400, "Choose the section to promote into.");
    if (String(toSection) === String(fromSection)) throw httpError(400, "The destination must be a different section.");
    target = await Section.findById(toSection);
    if (!target || target.status !== "active") throw httpError(404, "Destination section not found or inactive.");
    if (target.capacity) {
      const filled = await StudentEnrollment.countDocuments({ section: target._id, status: "active" });
      if (filled + current.length > target.capacity) throw httpError(409, `${target.name} has room for ${Math.max(0, target.capacity - filled)} more student(s); you selected ${current.length}.`);
    }
  }

  const now = new Date();
  for (const e of current) {
    e.status = "completed";
    e.endedAt = now;
    await e.save();
    if (outcome === "promote") {
      const next = await StudentEnrollment.create({ student: e.student, academicSession: target.academicSession, program: target.program, section: target._id });
      await Student.updateOne({ _id: e.student }, { currentEnrollment: next._id });
    } else {
      const student = await Student.findByIdAndUpdate(e.student, { currentEnrollment: null, lifecycleStatus: "graduated" }, { new: true });
      if (student && !(await Alumni.exists({ student: student._id }))) {
        const { cgpa } = await buildTranscript(student._id, { publishedOnly: false });
        await Alumni.create({ name: student.name, student: student._id, rollNo: student.rollNo, email: student.email || "", phone: student.phone || "", program: e.program?.name || "", graduationYear: now.getFullYear(), cgpa });
      }
    }
  }
  res.json({ outcome, moved: current.length });
}));

export default router;
