import express from "express";
import { auth, authAny } from "../middleware/auth.js";
import { h, httpError, scalar, crudRouter } from "../utils/crudRouter.js";
import { rateLimit } from "../services/permissions.js";
import { notify } from "../services/notify.js";
import { getSettings, nextCode } from "../models/Settings.js";
import { CalendarEvent, Ticket, StudentRecord, Certificate, Alumni } from "../models/Erp.js";
import Student from "../models/studentModel.js";
import Teacher from "../models/Teacher.js";
import Parent from "../models/Parent.js";

// Engagement: academic calendar, helpdesk tickets, per-student records,
// the issued-certificate register and the alumni directory.
const router = express.Router();
const EVERYONE = ["admin", "teacher", "student", "parent"];

// ═══════════════════════════ ACADEMIC CALENDAR ═════════════════════════════
const AUDIENCE = { student: ["all", "students"], teacher: ["all", "teachers", "staff"], parent: ["all", "parents", "students"] };
router.use("/calendar", crudRouter(CalendarEvent, {
  read: EVERYONE,
  filters: ["type"], search: ["title"], sort: { start: 1 },
  scope: (req) => {
    if (req.method !== "GET" || req.user.role === "admin") return {};
    return { audience: { $in: AUDIENCE[req.user.role] || ["all"] } };
  },
  beforeCreate: (d) => { if (d.end && new Date(d.end) < new Date(d.start)) throw httpError(400, "The end date is before the start date."); },
  beforeUpdate: (d, req, doc) => { if ((d.end ?? doc.end) && new Date(d.end ?? doc.end) < new Date(d.start ?? doc.start)) throw httpError(400, "The end date is before the start date."); },
}));

// ═══════════════════════════ HELPDESK ══════════════════════════════════════
async function displayName(user) {
  if (user.role === "admin") return user.email || "Admin";
  const Model = { student: Student, teacher: Teacher, parent: Parent }[user.role];
  const doc = Model && (await Model.findById(user.id).select("name rollNo"));
  return doc ? (doc.rollNo ? `${doc.name} (#${doc.rollNo})` : doc.name) : user.role;
}
// Non-admins only ever see tickets they raised themselves.
const ticketScope = (user) => (user.role === "admin" ? {} : { raisedById: String(user.id), raisedByRole: user.role });

router.get("/tickets", authAny(...EVERYONE), h(async (req, res) => {
  const filter = ticketScope(req.user);
  for (const k of ["status", "category", "priority"]) { const v = scalar(req.query[k]); if (v) filter[k] = v; }
  res.json(await Ticket.find(filter).sort({ updatedAt: -1 }).limit(500));
}));

router.post("/tickets", authAny(...EVERYONE), rateLimit({ max: 20, windowMs: 60 * 60 * 1000, message: "You've raised a lot of tickets in the last hour — please wait before raising another." }), h(async (req, res) => {
  const { category, subject, description, priority } = req.body;
  const ticket = await Ticket.create({
    ticketNo: await nextCode("TKT", "ticket"),
    raisedById: String(req.user.id), raisedByRole: req.user.role, raisedByName: await displayName(req.user),
    category, subject, description,
    // Only staff can escalate to "urgent"; anyone else is capped at high.
    priority: priority === "urgent" && req.user.role !== "admin" ? "high" : priority,
  });
  res.status(201).json(ticket);
}));

router.post("/tickets/:id/reply", authAny(...EVERYONE), h(async (req, res) => {
  const ticket = await Ticket.findOne({ _id: req.params.id, ...ticketScope(req.user) });
  if (!ticket) throw httpError(404, "Ticket not found");
  if (ticket.status === "closed") throw httpError(400, "This ticket is closed. Raise a new one if the problem is back.");
  const message = String(req.body.message || "").trim();
  if (!message) throw httpError(400, "Write a reply first.");
  ticket.replies.push({ byRole: req.user.role, byName: await displayName(req.user), message });
  // A reply from the person who raised it reopens a resolved ticket.
  if (req.user.role !== "admin" && ticket.status === "resolved") { ticket.status = "open"; ticket.resolvedAt = null; }
  if (req.user.role === "admin" && ticket.status === "open") ticket.status = "in_progress";
  await ticket.save();
  if (req.user.role === "admin" && ticket.raisedByRole !== "admin") {
    await notify(ticket.raisedByRole, ticket.raisedById, { title: `Reply on ${ticket.ticketNo}`, message: `The support team replied to “${ticket.subject}”.`, type: "ticket", actionUrl: `/${ticket.raisedByRole}/helpdesk` });
  }
  res.json(ticket);
}));

router.patch("/tickets/:id", auth("admin"), h(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) throw httpError(404, "Ticket not found");
  const { status, priority, assignedTo } = req.body;
  if (status !== undefined) {
    ticket.status = status;
    ticket.resolvedAt = ["resolved", "closed"].includes(status) ? ticket.resolvedAt || new Date() : null;
  }
  if (priority !== undefined) ticket.priority = priority;
  if (assignedTo !== undefined) ticket.assignedTo = String(assignedTo);
  await ticket.save();
  res.json(ticket);
}));

// ═══════════════════════════ CERTIFICATES ══════════════════════════════════
// Public: anyone holding a printed certificate can confirm it is genuine
// and still valid. Returns only what is printed on the document itself.
router.get("/certificates/verify/:serial", rateLimit({ max: 60 }), h(async (req, res) => {
  const cert = await Certificate.findOne({ serialNo: String(req.params.serial).toUpperCase() }).populate("student", "name rollNo");
  if (!cert) throw httpError(404, "No certificate with that serial number has been issued by this institute.");
  const settings = await getSettings();
  res.json({ serialNo: cert.serialNo, type: cert.type, status: cert.status, issuedOn: cert.issuedOn, studentName: cert.student?.name, rollNo: cert.student?.rollNo, institute: settings.instituteName });
}));

router.patch("/certificates/:id/revoke", auth("admin"), h(async (req, res) => {
  const cert = await Certificate.findByIdAndUpdate(req.params.id, { status: "revoked" }, { new: true }).populate("student", "name rollNo");
  if (!cert) throw httpError(404, "Certificate not found");
  res.json(cert);
}));

const CERT_PREFIX = { bonafide: "BON", character: "CHR", transfer: "TRF", completion: "CMP", id_card: "IDC", fee_clearance: "FCL" };
router.use("/certificates", crudRouter(Certificate, {
  fields: ["student", "type", "purpose"],
  populate: [{ path: "student", select: "name rollNo registrationNo photo dob parentName", populate: { path: "currentEnrollment", populate: [{ path: "program", select: "name code" }, { path: "section", select: "name" }, { path: "academicSession", select: "name" }] } }],
  filters: ["student", "type", "status"], sort: { issuedOn: -1 },
  beforeCreate: async (d, req) => {
    if (!CERT_PREFIX[d.type]) throw httpError(400, "Choose a certificate type.");
    if (!(await Student.exists({ _id: d.student }))) throw httpError(404, "Student not found");
    return { ...d, serialNo: await nextCode(CERT_PREFIX[d.type], `cert-${d.type}`, 6), issuedBy: req.user.email || "Admin" };
  },
  // An issued serial may already be in someone's hands — revoke, don't erase.
  beforeDelete: () => { throw httpError(400, "Issued certificates can't be deleted. Revoke it instead."); },
}));

// ═══════════════════════════ STUDENT RECORDS & ALUMNI ══════════════════════
router.use("/records", crudRouter(StudentRecord, {
  fields: ["student", "kind", "title", "details", "date", "severity", "actionTaken"],
  populate: [{ path: "student", select: "name rollNo" }],
  filters: ["student", "kind", "severity"], search: ["title", "details"], sort: { date: -1 },
  beforeCreate: (d, req) => ({ ...d, recordedBy: req.user.email || "Admin" }),
}));
router.use("/alumni", crudRouter(Alumni, { filters: ["graduationYear", "program"], search: ["name", "rollNo", "currentOrganization", "city"], sort: { graduationYear: -1, name: 1 } }));

export default router;
