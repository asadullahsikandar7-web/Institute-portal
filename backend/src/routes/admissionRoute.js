import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { auth } from "../middleware/auth.js";
import { h, httpError, pick, crudRouter } from "../utils/crudRouter.js";
import { rateLimit } from "../services/permissions.js";
import { getSettings, nextCode } from "../models/Settings.js";
import { Admission, ADMISSION_STAGES } from "../models/Erp.js";
import Student from "../models/studentModel.js";
import Parent from "../models/Parent.js";
import Section from "../models/Section.js";
import StudentEnrollment from "../models/StudentEnrollment.js";

// Admissions pipeline: application → review → test/interview → offer →
// acceptance → enrolment. Enrolment is a conversion, not a status edit —
// it creates the Student (+ Parent, + StudentEnrollment) in one step.
const router = express.Router();

const APPLICANT_FIELDS = ["name", "email", "phone", "dob", "gender", "address", "city", "guardianName", "guardianPhone", "guardianEmail", "program", "academicSession", "previousInstitute", "previousPercentage"];
const STAFF_FIELDS = [...APPLICANT_FIELDS, "testScore", "interviewScore", "source", "notes"];

// Public online application. No auth by design, so it is throttled, takes
// only applicant-supplied fields (never stage/scores), and can be switched
// off entirely from Settings.
router.post("/apply", rateLimit({ max: 5, windowMs: 60 * 60 * 1000, message: "Too many applications from this network. Please try again later." }), h(async (req, res) => {
  const settings = await getSettings();
  if (!settings.admissionsOpen) throw httpError(403, "Admissions are currently closed.");
  const data = pick(req.body, APPLICANT_FIELDS);
  if (!data.name || (!data.email && !data.phone)) throw httpError(400, "Name and at least one of email or phone are required.");
  const application = await Admission.create({
    ...data,
    applicationNo: await nextCode("APP", "admission"),
    source: "online",
    history: [{ stage: "applied", by: "Applicant (online)" }],
  });
  res.status(201).json({ applicationNo: application.applicationNo, message: "Application received." });
}));

// Applicants track their own status with the number they were given —
// returns the stage only, nothing else on the record.
router.get("/track/:applicationNo", rateLimit({ max: 30 }), h(async (req, res) => {
  const a = await Admission.findOne({ applicationNo: String(req.params.applicationNo).toUpperCase() }).select("applicationNo name stage updatedAt");
  if (!a) throw httpError(404, "No application found with that number.");
  res.json({ applicationNo: a.applicationNo, name: a.name, stage: a.stage, updatedAt: a.updatedAt });
}));

router.get("/stats", auth("admin"), h(async (req, res) => {
  const rows = await Admission.aggregate([{ $group: { _id: "$stage", count: { $sum: 1 } } }]);
  const byStage = Object.fromEntries(ADMISSION_STAGES.map(s => [s, 0]));
  rows.forEach(r => { byStage[r._id] = r.count; });
  const total = rows.reduce((s, r) => s + r.count, 0);
  res.json({ byStage, total, conversionRate: total ? Math.round((byStage.enrolled / total) * 100) : 0 });
}));

router.patch("/:id/stage", auth("admin"), h(async (req, res) => {
  const { stage, note } = req.body;
  if (!ADMISSION_STAGES.includes(stage)) throw httpError(400, "Unknown stage.");
  if (stage === "enrolled") throw httpError(400, "Use “Enroll” to convert an applicant into a student.");
  const a = await Admission.findById(req.params.id);
  if (!a) throw httpError(404, "Application not found");
  if (a.stage === "enrolled") throw httpError(400, "This applicant is already enrolled.");
  a.stage = stage;
  a.history.push({ stage, by: req.user.email || "Admin", note: note || "" });
  await a.save();
  res.json(await a.populate(POPULATE));
}));

// Converts an accepted applicant into a real student account. Refuses
// rather than half-completes: the roll number must be free and, when a
// section is given, it must have room and belong to the same program.
router.post("/:id/enroll", auth("admin"), h(async (req, res) => {
  const { rollNo, section: sectionId, createParent = true } = req.body;
  const a = await Admission.findById(req.params.id);
  if (!a) throw httpError(404, "Application not found");
  if (a.stage === "enrolled") throw httpError(400, "This applicant is already enrolled.");
  if (!["offered", "accepted"].includes(a.stage)) throw httpError(400, "Only applicants who have been offered or have accepted a place can be enrolled.");
  if (!rollNo || !String(rollNo).trim()) throw httpError(400, "Roll number is required.");
  if (!a.email) throw httpError(400, "Add the applicant's email first — it is used for their login details.");
  if (await Student.exists({ rollNo: String(rollNo).trim() })) throw httpError(409, "That roll number is already in use.");

  let section = null;
  if (sectionId) {
    section = await Section.findById(sectionId);
    if (!section) throw httpError(404, "Section not found");
    if (a.program && String(section.program) !== String(a.program)) throw httpError(400, "That section belongs to a different program than the one applied for.");
    if (section.capacity) {
      const filled = await StudentEnrollment.countDocuments({ section: section._id, status: "active" });
      if (filled >= section.capacity) throw httpError(409, `Section ${section.name} is full (${filled}/${section.capacity}).`);
    }
  }

  let parent = null;
  if (createParent && a.guardianName && (a.guardianPhone || a.guardianEmail)) {
    parent = await Parent.create({ name: a.guardianName, phone: a.guardianPhone, email: a.guardianEmail });
  }

  // One-time password, returned once in this response for the office to
  // hand over — never stored in plain text and never derivable from the
  // roll number.
  const tempPassword = crypto.randomBytes(6).toString("base64url");
  const student = await Student.create({
    name: a.name,
    email: a.email,
    rollNo: String(rollNo).trim(),
    password: await bcrypt.hash(tempPassword, 10),
    phone: a.phone,
    parentName: a.guardianName,
    parentEmail: a.guardianEmail,
    parentId: parent?._id || null,
    registrationNo: a.applicationNo,
    dob: a.dob,
    gender: a.gender,
    address: a.address,
    city: a.city,
    previousInstitute: a.previousInstitute,
    admissionDate: new Date(),
  });

  if (section) {
    const enrollment = await StudentEnrollment.create({ student: student._id, academicSession: section.academicSession, program: section.program, section: section._id });
    student.currentEnrollment = enrollment._id;
    await student.save();
  }

  a.stage = "enrolled";
  a.student = student._id;
  a.history.push({ stage: "enrolled", by: req.user.email || "Admin", note: `Roll #${student.rollNo}` });
  await a.save();

  res.status(201).json({ student: student.toSafeObject(), tempPassword, application: await a.populate(POPULATE) });
}));

const POPULATE = [{ path: "program", select: "name code" }, { path: "academicSession", select: "name" }, { path: "student", select: "name rollNo" }];

router.use("/", crudRouter(Admission, {
  fields: STAFF_FIELDS,
  populate: POPULATE,
  filters: ["stage", "program", "academicSession", "source"],
  search: ["name", "applicationNo", "email", "phone"],
  beforeCreate: async (data, req) => ({
    ...data,
    applicationNo: await nextCode("APP", "admission"),
    history: [{ stage: "applied", by: req.user.email || "Admin" }],
  }),
  beforeDelete: (doc) => {
    if (doc.stage === "enrolled") throw httpError(400, "An enrolled applicant's record is kept as the admission history of that student.");
  },
}));

export default router;
