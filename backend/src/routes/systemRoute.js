import express from "express";
import { auth, authAny } from "../middleware/auth.js";
import { h, httpError, scalar } from "../utils/crudRouter.js";
import { getSettings } from "../models/Settings.js";
import { AuditLog, ADMIN_ROLE_MODULES, adminCan } from "../services/permissions.js";
import Student from "../models/studentModel.js";
import Admin from "../models/adminModel.js";
import bcrypt from "bcryptjs";
import { newTotpSecret, verifyTotp } from "../services/security.js";
import Teacher from "../models/Teacher.js";
import Fee from "../models/FeeModel.js";
import Leave from "../models/leavemodel.js";
import StudentEnrollment from "../models/StudentEnrollment.js";
import { Admission, Staff, Book, BookIssue, Ticket, Expense, HostelAllocation, TransportAssignment, CalendarEvent } from "../models/Erp.js";

// Settings, audit trail, global search and the cross-module executive
// overview — the "system" surface that doesn't belong to any one module.
const router = express.Router();

const PUBLIC_FIELDS = "instituteName instituteType tagline address phone email website logoUrl currency principalName registrarName admissionsOpen";

// Branding for the login page, printed documents and the public
// admission form — deliberately unauthenticated and limited to fields
// that already appear on the institute's own letterhead.
router.get("/public", h(async (req, res) => {
  const s = await getSettings();
  res.json(Object.fromEntries(PUBLIC_FIELDS.split(" ").map(k => [k, s[k]])));
}));

// The signed-in user's institute (null in single-institute mode) — the
// frontend uses it to restore branding and hide modules not in the plan.
router.get("/institute", authAny("admin", "teacher", "student", "parent"), (req, res) => {
  const t = req.tenant;
  res.json(t ? { code: t.code, name: t.name, type: t.type, plan: t.plan, modules: t.modules } : null);
});

router.get("/settings", authAny("admin", "teacher", "student"), h(async (req, res) => {
  res.json(await getSettings());
}));

const SETTING_FIELDS = [...PUBLIC_FIELDS.split(" "), "minAttendancePercent", "passingPercent", "gradingScheme", "lateFeeType", "lateFeeValue", "libraryFinePerDay", "libraryMaxBooks", "libraryLoanDays"];

router.patch("/settings", auth("admin"), h(async (req, res) => {
  if (!adminCan(req.user, "system")) throw httpError(403, "Only full administrators can change institute settings.");
  const s = await getSettings();
  for (const k of SETTING_FIELDS) if (req.body[k] !== undefined) s[k] = req.body[k];
  if (req.body.gradingScheme !== undefined) {
    const scheme = (req.body.gradingScheme || [])
      .map(g => ({ grade: String(g.grade || "").trim(), min: Number(g.min), points: Number(g.points) }))
      .filter(g => g.grade && Number.isFinite(g.min) && Number.isFinite(g.points));
    if (!scheme.length) throw httpError(400, "Grading scheme needs at least one grade.");
    if (!scheme.some(g => g.min === 0)) throw httpError(400, "Grading scheme must include a grade with minimum 0 (the fail grade), or low scores would have no grade.");
    s.gradingScheme = scheme.sort((a, b) => b.min - a.min);
  }
  await s.save();
  res.json(s);
}));

// ── Two-factor sign-in for the signed-in admin ──────────────────────────
router.get("/2fa", auth("admin"), h(async (req, res) => {
  const admin = await Admin.findById(req.user.id).select("totpEnabled email");
  if (!admin) throw httpError(404, "Account not found");
  res.json({ enabled: !!admin.totpEnabled });
}));

// Starts setup: a fresh secret, not active until confirmed with a code.
router.post("/2fa/setup", auth("admin"), h(async (req, res) => {
  const admin = await Admin.findById(req.user.id);
  if (!admin) throw httpError(404, "Account not found");
  if (admin.totpEnabled) throw httpError(409, "Two-factor sign-in is already on. Turn it off first to re-link a device.");
  const secret = newTotpSecret();
  await Admin.updateOne({ _id: admin._id }, { totpSecret: secret, totpLastWindow: null });
  const settings = await getSettings();
  const issuer = encodeURIComponent(settings.instituteName || "ACADEXA");
  res.json({ secret, otpauthUrl: `otpauth://totp/${issuer}:${encodeURIComponent(admin.email)}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30` });
}));

router.post("/2fa/enable", auth("admin"), h(async (req, res) => {
  const admin = await Admin.findById(req.user.id).select("+totpSecret");
  if (!admin?.totpSecret) throw httpError(400, "Start setup first.");
  const window = verifyTotp(admin.totpSecret, req.body.code);
  if (window === null) throw httpError(400, "That code doesn't match. Check the time on your phone and try the newest code.");
  await Admin.updateOne({ _id: admin._id }, { totpEnabled: true, totpLastWindow: window });
  res.json({ enabled: true });
}));

// Turning it off needs the password AND a current code, so a stolen
// session alone can't strip the second factor.
router.post("/2fa/disable", auth("admin"), h(async (req, res) => {
  const admin = await Admin.findById(req.user.id).select("+totpSecret");
  if (!admin?.totpEnabled) throw httpError(400, "Two-factor sign-in is not on.");
  if (!(await bcrypt.compare(String(req.body.password || ""), admin.password))) throw httpError(401, "Password is incorrect.");
  if (verifyTotp(admin.totpSecret, req.body.code) === null) throw httpError(400, "That code doesn't match.");
  await Admin.updateOne({ _id: admin._id }, { totpEnabled: false, totpSecret: null, totpLastWindow: null });
  res.json({ enabled: false });
}));

router.get("/roles", auth("admin"), (req, res) => res.json(ADMIN_ROLE_MODULES));

router.get("/audit", auth("admin"), h(async (req, res) => {
  const filter = {};
  for (const k of ["actorRole", "module", "method", "actorId"]) {
    const v = scalar(req.query[k]);
    if (v) filter[k] = v;
  }
  const q = scalar(req.query.q);
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ path: rx }, { actorLabel: rx }];
  }
  if (scalar(req.query.failed) === "1") filter.status = { $gte: 400 };
  const limit = Math.min(Number(scalar(req.query.limit)) || 200, 500);
  res.json(await AuditLog.find(filter).sort({ at: -1 }).limit(limit));
}));

// One query box across the people/record collections an admin looks up
// most. Capped per collection so a one-letter query stays cheap.
router.get("/search", auth("admin"), h(async (req, res) => {
  const q = (scalar(req.query.q) || "").trim();
  if (q.length < 2) return res.json([]);
  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const [students, teachers, staff, books, admissions, tickets] = await Promise.all([
    Student.find({ $or: [{ name: rx }, { rollNo: rx }, { email: rx }, { registrationNo: rx }] }).select("name rollNo").limit(6),
    Teacher.find({ $or: [{ name: rx }, { email: rx }] }).select("name email").limit(5),
    Staff.find({ $or: [{ name: rx }, { employeeId: rx }] }).select("name employeeId designation").limit(5),
    Book.find({ $or: [{ title: rx }, { author: rx }, { isbn: rx }] }).select("title author").limit(5),
    Admission.find({ $or: [{ name: rx }, { applicationNo: rx }] }).select("name applicationNo stage").limit(5),
    Ticket.find({ $or: [{ subject: rx }, { ticketNo: rx }] }).select("subject ticketNo status").limit(5),
  ]);
  res.json([
    ...students.map(s => ({ kind: "Student", title: s.name, sub: `Roll #${s.rollNo}`, to: `/admin/student360/${s._id}` })),
    ...teachers.map(t => ({ kind: "Teacher", title: t.name, sub: t.email, to: "/admin/teachers" })),
    ...staff.map(s => ({ kind: "Staff", title: s.name, sub: `${s.employeeId} · ${s.designation || "—"}`, to: "/admin/staff" })),
    ...books.map(b => ({ kind: "Book", title: b.title, sub: b.author, to: "/admin/library" })),
    ...admissions.map(a => ({ kind: "Applicant", title: a.name, sub: `${a.applicationNo} · ${a.stage}`, to: "/admin/admissions" })),
    ...tickets.map(t => ({ kind: "Ticket", title: t.subject, sub: `${t.ticketNo} · ${t.status}`, to: "/admin/helpdesk" })),
  ]);
}));

// Executive overview: the headline number from every module on one screen.
router.get("/overview", auth("admin"), h(async (req, res) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const in30 = new Date(now.getTime() + 30 * 86400000);
  const [
    students, activeEnrollments, teachers, staff, fees, monthExpenses, admissionsByStage,
    openTickets, booksOut, overdueBooks, hostelResidents, transportRiders, pendingLeaves, upcoming,
  ] = await Promise.all([
    Student.countDocuments(),
    StudentEnrollment.countDocuments({ status: "active" }),
    Teacher.countDocuments({ isActive: true }),
    Staff.countDocuments({ status: "active" }),
    Fee.find().select("amount discount fine paidAmount status payments paidOn"),
    Expense.aggregate([{ $match: { date: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    Admission.aggregate([{ $group: { _id: "$stage", count: { $sum: 1 } } }]),
    Ticket.countDocuments({ status: { $in: ["open", "in_progress"] } }),
    BookIssue.countDocuments({ status: "issued" }),
    BookIssue.countDocuments({ status: "issued", dueOn: { $lt: now } }),
    HostelAllocation.countDocuments({ status: "active" }),
    TransportAssignment.countDocuments(),
    Leave.countDocuments({ status: "pending" }),
    CalendarEvent.find({ start: { $gte: now, $lte: in30 } }).sort({ start: 1 }).limit(6),
  ]);

  let billed = 0, collected = 0, outstanding = 0, collectedThisMonth = 0;
  for (const f of fees) {
    billed += f.netAmount;
    const paid = f.status === "paid" ? Math.max(f.paidAmount, f.netAmount) : f.paidAmount;
    collected += paid;
    outstanding += f.balance;
    if (f.payments.length) {
      for (const p of f.payments) if (p.paidOn >= monthStart) collectedThisMonth += p.amount;
    } else if (f.status === "paid" && f.paidOn && f.paidOn >= monthStart) {
      collectedThisMonth += f.netAmount; // legacy "mark paid" rows carry no payment lines
    }
  }

  res.json({
    people: { students, activeEnrollments, teachers, staff },
    // Money totals only for accounts that could open the finance module anyway.
    finance: !adminCan(req.user, "finance") ? null : { billed, collected, outstanding, collectedThisMonth, expensesThisMonth: monthExpenses[0]?.total || 0, collectionRate: billed ? Math.round((collected / billed) * 100) : 0 },
    admissions: Object.fromEntries(admissionsByStage.map(a => [a._id, a.count])),
    operations: { openTickets, booksOut, overdueBooks, hostelResidents, transportRiders, pendingLeaves },
    upcoming,
  });
}));

export default router;
