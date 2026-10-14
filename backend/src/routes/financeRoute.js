import express from "express";
import { auth } from "../middleware/auth.js";
import { h, httpError, scalar, crudRouter } from "../utils/crudRouter.js";
import { recordPayment } from "../services/payments.js";
import { notifyStudents } from "../services/notify.js";
import { PaymentClaim } from "../models/Smart.js";
import { getSettings, nextCode } from "../models/Settings.js";
import { FeeStructure, Scholarship, Expense } from "../models/Erp.js";
import Fee from "../models/FeeModel.js";
import Student from "../models/studentModel.js";
import StudentEnrollment from "../models/StudentEnrollment.js";

// Finance on top of the existing Fee ledger: bill templates, scholarships,
// partial payments with receipts, late fees, expenses and reporting.
// /api/fees (FeeRoute.js) remains the read path the student portal uses.
const router = express.Router();
router.use(auth("admin"));

const round2 = (n) => Math.round(n * 100) / 100;

// Discount a student's active scholarships give on one fee line.
function scholarshipDiscount(scholarships, category, amount) {
  let discount = 0;
  const notes = [];
  for (const s of scholarships) {
    if (!s.appliesTo.includes(category)) continue;
    const cut = s.type === "percent" ? (amount * Math.min(s.value, 100)) / 100 : s.value;
    discount += cut;
    notes.push(s.title);
  }
  return { discount: round2(Math.min(discount, amount)), note: notes.join(", ") };
}

// ═══════════════════════════ BILL GENERATION ═══════════════════════════════
// Stamps a structure onto every targeted student. Idempotent per
// {student, structure, period, title}: re-running the same period only
// bills students who were missed (e.g. enrolled since), never double-bills.
router.post("/structures/:id/generate", h(async (req, res) => {
  const { dueDate, period, section, studentIds } = req.body;
  const structure = await FeeStructure.findById(req.params.id);
  if (!structure) throw httpError(404, "Fee structure not found");
  if (structure.status !== "active") throw httpError(400, "This fee structure is inactive.");
  if (!dueDate || Number.isNaN(new Date(dueDate).getTime())) throw httpError(400, "A valid due date is required.");
  if (!period || !String(period).trim()) throw httpError(400, "A billing period label is required (e.g. “Fall 2026”) — it is what prevents double billing.");

  let targets;
  if (Array.isArray(studentIds) && studentIds.length) {
    targets = studentIds.map(String);
  } else {
    const filter = { status: "active" };
    if (section) filter.section = section;
    else if (structure.program) filter.program = structure.program;
    targets = (await StudentEnrollment.find(filter).distinct("student")).map(String);
    // A structure with no program and no section means "everyone",
    // including students who have no enrolment record yet.
    if (!section && !structure.program) targets = (await Student.find({ isActive: { $ne: false } }).distinct("_id")).map(String);
  }
  if (!targets.length) throw httpError(400, "No students match this structure's program/section.");

  const [existing, scholarships] = await Promise.all([
    Fee.find({ structure: structure._id, period, studentId: { $in: targets } }).select("studentId title"),
    Scholarship.find({ student: { $in: targets }, status: "active", $or: [{ validUntil: null }, { validUntil: { $gte: new Date() } }] }),
  ]);
  const already = new Set(existing.map(f => `${f.studentId}|${f.title}`));
  const byStudent = new Map();
  scholarships.forEach(s => byStudent.set(String(s.student), [...(byStudent.get(String(s.student)) || []), s]));

  const rows = [];
  for (const studentId of targets) {
    for (const item of structure.items) {
      if (already.has(`${studentId}|${item.title}`)) continue;
      const { discount, note } = scholarshipDiscount(byStudent.get(studentId) || [], item.category, item.amount);
      rows.push({
        studentId, title: item.title, amount: item.amount, category: item.category,
        dueDate: new Date(dueDate), discount, discountNote: note,
        // A 100% scholarship leaves nothing to collect — born settled.
        status: discount >= item.amount ? "paid" : "unpaid",
        paidOn: discount >= item.amount ? new Date() : null,
        structure: structure._id, period: String(period).trim(),
      });
    }
  }
  if (rows.length) {
    await Fee.insertMany(rows);
    await notifyStudents(rows.filter(r => r.status !== "paid").map(r => r.studentId), { title: `New fee: ${structure.name}`, message: `${structure.name} (${String(period).trim()}) has been billed. Due ${new Date(dueDate).toDateString()}.`, type: "fee", actionUrl: "/student/fees" });
  }
  res.status(201).json({
    created: rows.length,
    students: new Set(rows.map(r => r.studentId)).size,
    skipped: targets.length * structure.items.length - rows.length,
    total: rows.reduce((s, r) => s + r.amount - r.discount, 0),
  });
}));

// ═══════════════════════════ PAYMENTS ══════════════════════════════════════
router.post("/fees/:id/pay", h(async (req, res) => {
  const fee = await Fee.findById(req.params.id);
  if (!fee) throw httpError(404, "Fee not found");
  const receiptNo = await recordPayment(fee, { amount: req.body.amount, method: req.body.method, reference: req.body.reference, receivedBy: req.user.email || "Admin" });
  res.status(201).json({ fee: await fee.populate("studentId", "name rollNo email"), receiptNo });
}));

// ═══════════════════════════ PAYMENT CLAIMS ════════════════════════════════
// Students/parents report a bank deposit (routes/smartRoute.js); nothing
// is credited until someone here verifies it against the bank statement.
router.get("/claims", h(async (req, res) => {
  const filter = {};
  const status = scalar(req.query.status);
  if (status) filter.status = status;
  res.json(await PaymentClaim.find(filter).populate("student", "name rollNo").populate("fee", "title amount discount fine paidAmount status dueDate period").sort({ createdAt: -1 }).limit(500));
}));

router.post("/claims/:id/review", h(async (req, res) => {
  const { decision, note } = req.body;
  if (!["approve", "reject"].includes(decision)) throw httpError(400, "decision must be approve or reject");
  const claim = await PaymentClaim.findById(req.params.id);
  if (!claim) throw httpError(404, "Claim not found");
  if (claim.status !== "pending") throw httpError(400, "This claim has already been reviewed.");
  if (decision === "reject" && !String(note || "").trim()) throw httpError(400, "Give a reason so the student knows what to fix.");

  if (decision === "approve") {
    const fee = await Fee.findById(claim.fee);
    if (!fee) throw httpError(404, "The fee this claim was for no longer exists.");
    // Credits at most what is still owed — the balance may have changed
    // since the claim was submitted.
    const amount = Math.min(claim.amount, fee.balance);
    if (amount <= 0) throw httpError(400, "This fee has already been settled. Reject the claim with a note instead.");
    claim.receiptNo = await recordPayment(fee, { amount, method: claim.method, reference: claim.reference, receivedBy: req.user.email || "Admin" });
    claim.status = "approved";
  } else {
    claim.status = "rejected";
    await notifyStudents([claim.student], { title: "Payment claim not accepted", message: String(note).trim(), type: "fee", actionUrl: "/student/fees", priority: "high" });
  }
  claim.reviewedBy = req.user.email || "Admin";
  claim.reviewNote = String(note || "").trim();
  await claim.save();
  res.json(claim);
}));

// Emails every defaulter (and their parent, when on file) a statement of
// what is overdue. Sends are awaited — see the note in studentRoute.js on
// why fire-and-forget mail is unreliable on serverless.
router.post("/reminders/send", h(async (req, res) => {
  const overdue = await Fee.find({ status: { $ne: "paid" }, dueDate: { $lt: new Date() } }).populate("studentId", "name rollNo email parentEmail");
  const byStudent = new Map();
  for (const f of overdue) {
    if (!f.studentId || f.balance <= 0) continue;
    const k = String(f.studentId._id);
    const cur = byStudent.get(k) || { student: f.studentId, lines: [], total: 0 };
    cur.lines.push(f); cur.total += f.balance;
    byStudent.set(k, cur);
  }
  if (!byStudent.size) throw httpError(400, "There are no overdue balances to remind anyone about.");
  const settings = await getSettings();
  const { sendMail } = await import("../utils/mailer.js");
  let sent = 0, failed = 0, noEmail = 0;
  for (const d of byStudent.values()) {
    const to = [d.student.email, d.student.parentEmail].filter(Boolean);
    if (!to.length) { noEmail += 1; continue; }
    const lines = d.lines.map(f => `• ${f.title}${f.period ? ` (${f.period})` : ""} — ${settings.currency}${Math.round(f.balance).toLocaleString("en-US")}, due ${f.dueDate.toDateString()}`).join("\n");
    const text = `Dear ${d.student.name},\n\nThis is a reminder that the following fees are overdue at ${settings.instituteName}:\n\n${lines}\n\nTotal outstanding: ${settings.currency}${Math.round(d.total).toLocaleString("en-US")}\n\nPlease pay at the accounts office, or submit your bank deposit reference from the Fees page of the student portal. If you have already paid, kindly ignore this message.\n\nAccounts Office\n${settings.instituteName}`;
    try { await sendMail({ to: to.join(","), subject: `Fee reminder — ${settings.currency}${Math.round(d.total).toLocaleString("en-US")} overdue`, text }); sent += 1; }
    catch { failed += 1; }
  }
  await notifyStudents([...byStudent.keys()], { title: "Fee payment overdue", message: "You have overdue fees. Please pay or submit your payment reference from the Fees page.", type: "fee", actionUrl: "/student/fees", priority: "high" });
  res.json({ defaulters: byStudent.size, sent, failed, noEmail });
}));

// Splits one unpaid fee line into instalments with their own due dates —
// e.g. a family that can't pay a semester's tuition at once. Discount and
// fine are split in proportion, rounding left on the final instalment so
// the parts always add up to the original exactly.
router.post("/fees/:id/installments", h(async (req, res) => {
  const fee = await Fee.findById(req.params.id);
  if (!fee) throw httpError(404, "Fee not found");
  if (fee.payments.length || fee.paidAmount > 0 || fee.status === "paid") throw httpError(400, "Only a fee with nothing paid yet can be split. Record payments against it instead.");
  if (/\(\d+\/\d+\)$/.test(fee.title)) throw httpError(400, "This line is already an instalment.");
  const count = Number(req.body.count);
  const interval = Math.max(7, Math.min(120, Number(req.body.intervalDays) || 30));
  const first = req.body.firstDue ? new Date(req.body.firstDue) : fee.dueDate;
  if (!Number.isInteger(count) || count < 2 || count > 12) throw httpError(400, "Choose between 2 and 12 instalments.");
  if (Number.isNaN(first.getTime())) throw httpError(400, "Give a valid first due date.");
  const split = (total) => { const part = Math.floor((total / count) * 100) / 100; return Array.from({ length: count }, (_, i) => (i < count - 1 ? part : Math.round((total - part * (count - 1)) * 100) / 100)); };
  const amounts = split(fee.amount), discounts = split(fee.discount || 0), fines = split(fee.fine || 0);
  const rows = amounts.map((amount, i) => ({
    studentId: fee.studentId, title: `${fee.title} (${i + 1}/${count})`, amount, category: fee.category,
    dueDate: new Date(first.getTime() + i * interval * 86400000), discount: discounts[i], discountNote: fee.discountNote, fine: fines[i],
    structure: fee.structure, period: fee.period, status: "unpaid",
  }));
  const created = await Fee.insertMany(rows);
  await PaymentClaim.deleteMany({ fee: fee._id, status: "pending" });
  await fee.deleteOne();
  await notifyStudents([fee.studentId], { title: "Instalment plan set up", message: `“${fee.title}” is now payable in ${count} instalments, the first due ${rows[0].dueDate.toDateString()}.`, type: "fee", actionUrl: "/student/fees" });
  res.status(201).json({ created: created.length, installments: created });
}));

// Waiver / manual fine / due-date extension on a single line.
router.patch("/fees/:id/adjust", h(async (req, res) => {
  const fee = await Fee.findById(req.params.id);
  if (!fee) throw httpError(404, "Fee not found");
  if (fee.status === "paid") throw httpError(400, "A fully paid fee can no longer be adjusted.");
  const { discount, discountNote, fine, dueDate } = req.body;
  if (discount !== undefined) {
    const d = Number(discount);
    if (!Number.isFinite(d) || d < 0 || d > fee.amount) throw httpError(400, "Discount must be between 0 and the fee amount.");
    fee.discount = d;
  }
  if (fine !== undefined) {
    const f = Number(fine);
    if (!Number.isFinite(f) || f < 0) throw httpError(400, "Fine cannot be negative.");
    fee.fine = f;
  }
  if (discountNote !== undefined) fee.discountNote = String(discountNote);
  if (dueDate) {
    fee.dueDate = new Date(dueDate);
    if (fee.status === "overdue" && fee.dueDate > new Date()) fee.status = fee.paidAmount > 0 ? "partial" : "unpaid";
  }
  if (fee.netAmount < fee.paidAmount) throw httpError(400, "That would reduce the fee below what has already been paid.");
  if (fee.paidAmount >= fee.netAmount - 0.001) { fee.status = "paid"; fee.paidOn = new Date(); }
  await fee.save();
  res.json({ fee });
}));

router.delete("/fees/:id", h(async (req, res) => {
  const fee = await Fee.findById(req.params.id);
  if (!fee) throw httpError(404, "Fee not found");
  if (fee.payments.length || fee.paidAmount > 0) throw httpError(400, "Money has been received against this fee — it can't be deleted. Adjust it instead.");
  await fee.deleteOne();
  res.json({ message: "Fee removed" });
}));

// Applies the configured late-fee rule once to every overdue line that has
// no fine yet. Safe to re-run: lines already fined are left alone.
router.post("/late-fees/apply", h(async (req, res) => {
  const settings = await getSettings();
  if (settings.lateFeeType === "none" || !settings.lateFeeValue) throw httpError(400, "No late-fee rule is configured. Set one under Settings → Finance.");
  const overdue = await Fee.find({ status: { $in: ["overdue", "partial", "unpaid"] }, dueDate: { $lt: new Date() }, fine: 0 });
  let total = 0;
  for (const fee of overdue) {
    fee.fine = settings.lateFeeType === "flat" ? settings.lateFeeValue : round2((fee.amount * settings.lateFeeValue) / 100);
    total += fee.fine;
    await fee.save();
  }
  res.json({ applied: overdue.length, total });
}));

// ═══════════════════════════ REPORTING ═════════════════════════════════════
router.get("/summary", h(async (req, res) => {
  const [fees, expenses] = await Promise.all([
    Fee.find().populate("studentId", "name rollNo"),
    Expense.find().select("amount category date"),
  ]);

  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString("en-US", { month: "short" }), income: 0, expense: 0 });
  }
  const monthIndex = new Map(months.map((m, i) => [m.key, i]));
  const keyOf = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`; };

  let billed = 0, collected = 0, outstanding = 0, discounts = 0, fines = 0, overdueAmount = 0;
  const byCategory = {}, byMethod = {};
  const defaulters = new Map();
  for (const f of fees) {
    billed += f.netAmount;
    discounts += f.discount || 0;
    fines += f.fine || 0;
    outstanding += f.balance;
    const cat = (byCategory[f.category] ||= { billed: 0, collected: 0 });
    cat.billed += f.netAmount;

    // Rows settled through the legacy "mark paid" button before payment
    // lines existed have status paid but no payments — count them as one
    // payment on their paidOn date so historical income isn't dropped.
    const lines = f.payments.length ? f.payments : (f.status === "paid" && f.netAmount > 0 ? [{ amount: f.netAmount, paidOn: f.paidOn || f.updatedAt, method: "cash" }] : []);
    for (const p of lines) {
      collected += p.amount;
      cat.collected += p.amount;
      byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
      const i = monthIndex.get(keyOf(p.paidOn));
      if (i !== undefined) months[i].income += p.amount;
    }

    if (f.balance > 0 && f.dueDate < now && f.studentId) {
      overdueAmount += f.balance;
      const id = String(f.studentId._id);
      const d = defaulters.get(id) || { student: f.studentId, amount: 0, items: 0, oldestDue: f.dueDate };
      d.amount += f.balance;
      d.items += 1;
      if (f.dueDate < d.oldestDue) d.oldestDue = f.dueDate;
      defaulters.set(id, d);
    }
  }

  let totalExpenses = 0;
  const expenseByCategory = {};
  for (const e of expenses) {
    totalExpenses += e.amount;
    expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + e.amount;
    const i = monthIndex.get(keyOf(e.date));
    if (i !== undefined) months[i].expense += e.amount;
  }

  res.json({
    totals: { billed, collected, outstanding, discounts, fines, overdueAmount, expenses: totalExpenses, net: collected - totalExpenses, collectionRate: billed ? Math.round((collected / billed) * 100) : 0 },
    months, byCategory, byMethod, expenseByCategory,
    defaulters: [...defaulters.values()].sort((a, b) => b.amount - a.amount).slice(0, 50),
  });
}));

// Full statement for one student — every line, payment and balance.
router.get("/statement/:studentId", h(async (req, res) => {
  const [student, fees, scholarships] = await Promise.all([
    Student.findById(req.params.studentId).select("name rollNo email"),
    Fee.find({ studentId: req.params.studentId }).sort({ dueDate: 1 }),
    Scholarship.find({ student: req.params.studentId }),
  ]);
  if (!student) throw httpError(404, "Student not found");
  res.json({
    student, fees, scholarships,
    totals: {
      billed: fees.reduce((s, f) => s + f.netAmount, 0),
      paid: fees.reduce((s, f) => s + (f.status === "paid" ? f.netAmount : f.paidAmount), 0),
      balance: fees.reduce((s, f) => s + f.balance, 0),
    },
  });
}));

router.use("/structures", crudRouter(FeeStructure, {
  populate: [{ path: "program", select: "name code" }],
  filters: ["status", "program"], search: ["name"], sort: { name: 1 },
  softDelete: { field: "status", value: "inactive" },
}));
router.use("/scholarships", crudRouter(Scholarship, {
  populate: [{ path: "student", select: "name rollNo" }],
  filters: ["status", "student", "kind"], search: ["title"],
  beforeCreate: (d) => { if (d.type === "percent" && d.value > 100) throw httpError(400, "A percentage scholarship cannot exceed 100%."); },
  beforeUpdate: (d, req, doc) => { if ((d.type || doc.type) === "percent" && (d.value ?? doc.value) > 100) throw httpError(400, "A percentage scholarship cannot exceed 100%."); },
}));
router.use("/expenses", crudRouter(Expense, {
  filters: ["category", "method"], search: ["title", "paidTo", "reference"], sort: { date: -1 },
  beforeCreate: (d, req) => ({ ...d, recordedBy: req.user.email || "Admin" }),
}));

export default router;
