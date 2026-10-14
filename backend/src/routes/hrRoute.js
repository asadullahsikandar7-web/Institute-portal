import express from "express";
import { auth } from "../middleware/auth.js";
import { h, httpError, scalar, crudRouter } from "../utils/crudRouter.js";
import { nextCode } from "../models/Settings.js";
import { Department, Staff, StaffAttendance, Payslip, StaffLeave, Expense } from "../models/Erp.js";

// HR & payroll: departments, staff records, staff attendance, leave, and
// a monthly payroll run that freezes each person's pay into a Payslip.
const router = express.Router();

const sum = (items) => (items || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
const round2 = (n) => Math.round(n * 100) / 100;

// A teacher's own payslips — the only non-admin route in this module.
// Resolved through Staff.teacher, never a client-supplied staff id.
router.get("/my/payslips", auth("teacher"), h(async (req, res) => {
  const staff = await Staff.findOne({ teacher: req.user.id });
  if (!staff) return res.json({ staff: null, payslips: [] });
  res.json({ staff: { name: staff.name, employeeId: staff.employeeId, designation: staff.designation }, payslips: await Payslip.find({ staff: staff._id }).sort({ month: -1 }) });
}));

router.use(auth("admin"));

// ═══════════════════════════ STAFF ATTENDANCE ══════════════════════════════
router.get("/attendance", h(async (req, res) => {
  const date = scalar(req.query.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) throw httpError(400, "date (YYYY-MM-DD) is required");
  const [staff, records] = await Promise.all([
    Staff.find({ status: { $in: ["active", "on_leave"] } }).populate("department", "name code").sort({ name: 1 }),
    StaffAttendance.find({ date }),
  ]);
  const byStaff = new Map(records.map(r => [String(r.staff), r]));
  res.json(staff.map(s => ({ staff: s, status: byStaff.get(String(s._id))?.status || null })));
}));

router.post("/attendance", h(async (req, res) => {
  const { date, records } = req.body;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) throw httpError(400, "date (YYYY-MM-DD) is required");
  if (date > new Date().toISOString().slice(0, 10)) throw httpError(400, "Attendance can't be marked for a future date.");
  const valid = ["present", "absent", "half_day", "leave", "holiday"];
  const ops = (Array.isArray(records) ? records : [])
    .filter(r => r.staff && valid.includes(r.status))
    .map(r => ({ updateOne: { filter: { staff: r.staff, date }, update: { $set: { status: r.status } }, upsert: true } }));
  if (!ops.length) throw httpError(400, "Nothing to save.");
  await StaffAttendance.bulkWrite(ops);
  res.json({ saved: ops.length });
}));

// ═══════════════════════════ PAYROLL ═══════════════════════════════════════
// Generates one payslip per active staff member for the month. Unpaid
// absence is deducted at basic/30 per day (half days count 0.5). Re-running
// refreshes slips that are still "generated" and never touches paid ones.
router.post("/payroll/run", h(async (req, res) => {
  const month = scalar(req.body.month);
  if (!/^\d{4}-\d{2}$/.test(month || "")) throw httpError(400, "month (YYYY-MM) is required");
  if (month > new Date().toISOString().slice(0, 7)) throw httpError(400, "Payroll can't be run for a future month.");

  const [staff, attendance, existing] = await Promise.all([
    Staff.find({ status: { $in: ["active", "on_leave"] } }),
    StaffAttendance.find({ date: { $gte: `${month}-01`, $lte: `${month}-31` }, status: { $in: ["absent", "half_day"] } }),
    Payslip.find({ month }),
  ]);
  if (!staff.length) throw httpError(400, "There are no active staff to pay.");
  const absent = new Map();
  attendance.forEach(a => absent.set(String(a.staff), (absent.get(String(a.staff)) || 0) + (a.status === "half_day" ? 0.5 : 1)));
  const slips = new Map(existing.map(p => [String(p.staff), p]));

  let created = 0, refreshed = 0, locked = 0, total = 0;
  for (const s of staff) {
    const prior = slips.get(String(s._id));
    if (prior?.status === "paid") { locked += 1; total += prior.net; continue; }
    const absentDays = absent.get(String(s._id)) || 0;
    const gross = round2(s.basicSalary + sum(s.allowances));
    const absenceDeduction = round2((s.basicSalary / 30) * absentDays);
    const net = round2(Math.max(0, gross - sum(s.deductions) - absenceDeduction));
    const data = { basic: s.basicSalary, allowances: s.allowances, deductions: s.deductions, absentDays, absenceDeduction, gross, net };
    if (prior) { prior.set(data); await prior.save(); refreshed += 1; }
    else { await Payslip.create({ staff: s._id, month, ...data }); created += 1; }
    total += net;
  }
  res.status(201).json({ month, created, refreshed, locked, total: round2(total) });
}));

router.get("/payroll", h(async (req, res) => {
  const filter = {};
  const month = scalar(req.query.month);
  if (month) filter.month = month;
  const staffId = scalar(req.query.staff);
  if (staffId) filter.staff = staffId;
  res.json(await Payslip.find(filter).populate({ path: "staff", select: "name employeeId designation department bankName bankAccount", populate: { path: "department", select: "name" } }).sort({ month: -1 }));
}));

// Marks slips paid and books the month's total as one "salaries" expense,
// so payroll shows up in the finance summary without double entry.
router.post("/payroll/pay", h(async (req, res) => {
  const month = scalar(req.body.month);
  if (!/^\d{4}-\d{2}$/.test(month || "")) throw httpError(400, "month (YYYY-MM) is required");
  const filter = { month, status: "generated" };
  if (Array.isArray(req.body.ids) && req.body.ids.length) filter._id = { $in: req.body.ids };
  const slips = await Payslip.find(filter);
  if (!slips.length) throw httpError(400, "No unpaid payslips for that month.");
  const total = round2(slips.reduce((s, p) => s + p.net, 0));
  await Payslip.updateMany({ _id: { $in: slips.map(s => s._id) } }, { status: "paid", paidOn: new Date(), method: req.body.method || "bank" });
  await Expense.create({ title: `Payroll ${month} (${slips.length} staff)`, category: "salaries", amount: total, method: req.body.method || "bank", reference: `PAYROLL-${month}`, recordedBy: req.user.email || "Admin" });
  res.json({ paid: slips.length, total });
}));

router.get("/summary", h(async (req, res) => {
  const [staff, departments, pendingLeaves] = await Promise.all([
    Staff.find().select("status category basicSalary allowances department"),
    Department.countDocuments({ status: "active" }),
    StaffLeave.countDocuments({ status: "pending" }),
  ]);
  const active = staff.filter(s => s.status === "active" || s.status === "on_leave");
  const byCategory = {};
  active.forEach(s => { byCategory[s.category] = (byCategory[s.category] || 0) + 1; });
  res.json({ total: staff.length, active: active.length, departments, pendingLeaves, byCategory, monthlyPayroll: round2(active.reduce((s, x) => s + x.basicSalary + sum(x.allowances), 0)) });
}));

router.patch("/leaves/:id/review", h(async (req, res) => {
  const { status } = req.body;
  if (!["approved", "rejected"].includes(status)) throw httpError(400, "status must be approved or rejected");
  const leave = await StaffLeave.findById(req.params.id);
  if (!leave) throw httpError(404, "Leave not found");
  if (leave.status !== "pending") throw httpError(400, "This request has already been reviewed.");
  leave.status = status;
  leave.reviewedBy = req.user.email || "Admin";
  await leave.save();
  res.json(await leave.populate("staff", "name employeeId"));
}));

router.use("/departments", crudRouter(Department, { filters: ["status", "kind"], search: ["name", "code"], sort: { name: 1 }, softDelete: { field: "status", value: "inactive" } }));
router.use("/staff", crudRouter(Staff, {
  fields: ["name", "email", "phone", "designation", "department", "category", "employmentType", "teacher", "joinDate", "qualification", "basicSalary", "allowances", "deductions", "bankName", "bankAccount", "status"],
  populate: [{ path: "department", select: "name code" }, { path: "teacher", select: "name email" }],
  filters: ["status", "category", "department", "employmentType"], search: ["name", "employeeId", "email", "designation"], sort: { name: 1 },
  beforeCreate: async (d) => ({ ...d, employeeId: await nextCode("EMP", "staff", 4) }),
  softDelete: { field: "status", value: "resigned" },
}));
router.use("/leaves", crudRouter(StaffLeave, {
  fields: ["staff", "type", "from", "to", "reason"],
  populate: [{ path: "staff", select: "name employeeId designation" }],
  filters: ["status", "staff", "type"],
  beforeCreate: (d) => { if (new Date(d.to) < new Date(d.from)) throw httpError(400, "The end date is before the start date."); },
}));

export default router;
