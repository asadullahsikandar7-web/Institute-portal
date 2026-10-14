import mongoose from "mongoose";
import { getSettings } from "../models/Settings.js";
import { forEachTenant } from "../tenancy/middleware.js";
import { notify, notifyStudents } from "./notify.js";
import { computeRisk } from "./risk.js";
import { BookIssue, Ticket } from "../models/Erp.js";
import Student from "../models/studentModel.js";
import Fee from "../models/FeeModel.js";
import SubjectAttendance from "../models/SubjectAttendance.js";
import StudentEnrollment from "../models/StudentEnrollment.js";
import TeacherAssignment from "../models/TeacherAssignment.js";

// ── Automations ─────────────────────────────────────────────────────────
// Scheduled rules that do the follow-up staff would otherwise have to
// remember: tell a parent the same day their child is absent, remind
// before a fee falls due, chase overdue library books, escalate students
// who become high-risk, close stale tickets.
//
// Every rule is OFF until an admin switches it on, because several of them
// email real parents. Each rule is idempotent: what it has already done is
// recorded in AutomationLog under a key (rule + subject + period), so
// running it twice — by the scheduler and by "Run now" — never sends
// anything twice.

const ruleSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  enabled: { type: Boolean, default: false },
  email: { type: Boolean, default: false }, // also email, not just in-app
  lastRunAt: { type: Date, default: null },
  lastResult: { type: String, default: "" },
}, { timestamps: true });
export const AutomationRule = mongoose.models.AutomationRule || mongoose.model("AutomationRule", ruleSchema);

const logSchema = new mongoose.Schema({
  rule: { type: String, required: true },
  key: { type: String, required: true, unique: true },
  at: { type: Date, default: Date.now },
});
logSchema.index({ at: 1 }, { expireAfterSeconds: 180 * 86400 });
export const AutomationLog = mongoose.models.AutomationLog || mongoose.model("AutomationLog", logSchema);

const DAY = 86400000;
const todayStr = () => new Date().toISOString().slice(0, 10);

// Claims a key; returns false if this exact action was already done.
async function once(rule, key) {
  try { await AutomationLog.create({ rule, key: `${rule}|${key}` }); return true; }
  catch (e) { if (e.code === 11000) return false; throw e; }
}

async function mail(to, subject, text) {
  const list = [...new Set(to.filter(Boolean))];
  if (!list.length) return false;
  const { sendMail } = await import("../utils/mailer.js");
  try { await sendMail({ to: list.join(","), subject, text }); return true; } catch { return false; }
}

// Each rule: run({ email, settings }) → { acted, emailed, detail }
export const RULES = [
  {
    key: "absence-alert",
    title: "Same-day absence alert",
    description: "When a student is marked absent in any class today, their parent is told the same day — which subjects were missed.",
    audience: "Parents",
    async run({ email, settings }) {
      const date = todayStr();
      const rows = await SubjectAttendance.find({ date, status: "absent" }).populate("subject", "name");
      const by = new Map();
      rows.forEach(r => by.set(String(r.student), [...(by.get(String(r.student)) || []), r.subject?.name].filter(Boolean)));
      let acted = 0, emailed = 0;
      const students = await Student.find({ _id: { $in: [...by.keys()] } }).select("name parentId parentEmail");
      for (const s of students) {
        if (!(await once("absence-alert", `${s._id}|${date}`))) continue;
        const subjects = by.get(String(s._id)).join(", ");
        const message = `${s.name} was marked absent today in: ${subjects}. If this is unexpected, please contact the institute.`;
        if (s.parentId) await notify("parent", s.parentId, { title: `${s.name} absent today`, message, type: "attendance", actionUrl: "/parent/dashboard", priority: "high" });
        await notify("student", s._id, { title: "Marked absent today", message: `You were marked absent in: ${subjects}.`, type: "attendance", actionUrl: "/student/attendance" });
        if (email && (await mail([s.parentEmail], `${s.name} was absent today — ${settings.instituteName}`, `Dear Parent,\n\n${message}\n\n${settings.instituteName}`))) emailed += 1;
        acted += 1;
      }
      return { acted, emailed, detail: `${acted} student(s) absent today, families notified` };
    },
  },
  {
    key: "fee-due-soon",
    title: "Fee due in 3 days",
    description: "Reminds the student (and parent) three days before an unpaid fee falls due, once per fee.",
    audience: "Students & parents",
    async run({ email, settings }) {
      const now = new Date();
      const fees = await Fee.find({ status: { $in: ["unpaid", "partial"] }, dueDate: { $gte: now, $lte: new Date(now.getTime() + 3 * DAY) } }).populate("studentId", "name email parentEmail");
      let acted = 0, emailed = 0;
      for (const f of fees) {
        if (!f.studentId || f.balance <= 0 || !(await once("fee-due-soon", String(f._id)))) continue;
        const text = `“${f.title}” — ${settings.currency}${Math.round(f.balance).toLocaleString("en-US")} is due on ${f.dueDate.toDateString()}.`;
        await notifyStudents([f.studentId._id], { title: "Fee due soon", message: text, type: "fee", actionUrl: "/student/fees" });
        if (email && (await mail([f.studentId.email, f.studentId.parentEmail], `Fee due soon — ${settings.instituteName}`, `Dear ${f.studentId.name},\n\n${text}\n\nPay at the accounts office, or report a bank payment from the Fees page of the portal.\n\n${settings.instituteName}`))) emailed += 1;
        acted += 1;
      }
      return { acted, emailed, detail: `${acted} upcoming fee reminder(s)` };
    },
  },
  {
    key: "fee-overdue",
    title: "Fee became overdue",
    description: "The day a fee passes its due date unpaid, the student and parent are told — once per fee — and the late-fee rule is mentioned if one is set.",
    audience: "Students & parents",
    async run({ email, settings }) {
      const fees = await Fee.find({ status: { $ne: "paid" }, dueDate: { $lt: new Date(), $gte: new Date(Date.now() - 30 * DAY) } }).populate("studentId", "name email parentEmail");
      let acted = 0, emailed = 0;
      const lateRule = settings.lateFeeType === "flat" ? ` A late fee of ${settings.currency}${settings.lateFeeValue} may be added.` : settings.lateFeeType === "percent" ? ` A late fee of ${settings.lateFeeValue}% may be added.` : "";
      for (const f of fees) {
        if (!f.studentId || f.balance <= 0 || !(await once("fee-overdue", String(f._id)))) continue;
        const text = `“${f.title}” (${settings.currency}${Math.round(f.balance).toLocaleString("en-US")}) was due on ${f.dueDate.toDateString()} and is now overdue.${lateRule}`;
        await notifyStudents([f.studentId._id], { title: "Fee overdue", message: text, type: "fee", actionUrl: "/student/fees", priority: "high" });
        if (email && (await mail([f.studentId.email, f.studentId.parentEmail], `Fee overdue — ${settings.instituteName}`, `Dear ${f.studentId.name},\n\n${text}\n\n${settings.instituteName}`))) emailed += 1;
        acted += 1;
      }
      return { acted, emailed, detail: `${acted} newly overdue fee(s)` };
    },
  },
  {
    key: "library-due",
    title: "Library book due / overdue",
    description: "Reminds a student the day before a book is due, and again the day it becomes overdue (with the fine per day).",
    audience: "Students",
    async run({ email, settings }) {
      const now = new Date();
      const loans = await BookIssue.find({ status: "issued", dueOn: { $lte: new Date(now.getTime() + DAY) } }).populate("book", "title").populate("student", "name email");
      let acted = 0, emailed = 0;
      for (const l of loans) {
        if (!l.student) continue;
        const overdue = l.dueOn < now;
        if (!(await once("library-due", `${l._id}|${overdue ? "overdue" : "due"}`))) continue;
        const text = overdue
          ? `“${l.book?.title}” was due on ${l.dueOn.toDateString()}. A fine of ${settings.currency}${settings.libraryFinePerDay} per day applies until it is returned.`
          : `“${l.book?.title}” is due back on ${l.dueOn.toDateString()}.`;
        await notify("student", l.student._id, { title: overdue ? "Library book overdue" : "Library book due tomorrow", message: text, type: "library", actionUrl: "/student/library", priority: overdue ? "high" : "normal" });
        if (email && (await mail([l.student.email], `${overdue ? "Overdue" : "Due"}: ${l.book?.title}`, `Dear ${l.student.name},\n\n${text}\n\nLibrary — ${settings.instituteName}`))) emailed += 1;
        acted += 1;
      }
      return { acted, emailed, detail: `${acted} library reminder(s)` };
    },
  },
  {
    key: "risk-escalation",
    title: "Student became high-risk",
    description: "When the early-warning score of a student crosses into high risk, their teachers are alerted with the reasons — at most once a fortnight per student.",
    audience: "Teachers",
    async run() {
      const ids = await StudentEnrollment.find({ status: "active" }).distinct("student");
      const risk = await computeRisk(ids);
      const high = [...risk.entries()].filter(([, r]) => r.level === "high");
      const fortnight = Math.floor(Date.now() / (14 * DAY));
      let acted = 0;
      for (const [id, r] of high) {
        if (!(await once("risk-escalation", `${id}|${fortnight}`))) continue;
        const [student, enrollment] = await Promise.all([Student.findById(id).select("name rollNo"), StudentEnrollment.findOne({ student: id, status: "active" })]);
        const teachers = enrollment ? await TeacherAssignment.find({ section: enrollment.section, status: "active" }).distinct("teacher") : [];
        for (const t of teachers) await notify("teacher", t, { title: `${student.name} is at high risk`, message: r.reasons.slice(0, 3).map(x => x.text).join(" · "), type: "alert", actionUrl: "/teacher/success", priority: "high" });
        acted += 1;
      }
      return { acted, emailed: 0, detail: `${high.length} high-risk student(s), ${acted} newly escalated` };
    },
  },
  {
    key: "ticket-autoclose",
    title: "Close resolved tickets after 7 days",
    description: "Helpdesk tickets left in “resolved” for a week with no reply are closed, keeping the queue clean.",
    audience: "Helpdesk",
    async run() {
      const r = await Ticket.updateMany({ status: "resolved", resolvedAt: { $lt: new Date(Date.now() - 7 * DAY) } }, { status: "closed" });
      return { acted: r.modifiedCount, emailed: 0, detail: `${r.modifiedCount} ticket(s) closed` };
    },
  },
];

export async function ruleStates() {
  const docs = await AutomationRule.find();
  const by = new Map(docs.map(d => [d.key, d]));
  return RULES.map(r => ({ key: r.key, title: r.title, description: r.description, audience: r.audience, enabled: by.get(r.key)?.enabled || false, email: by.get(r.key)?.email || false, lastRunAt: by.get(r.key)?.lastRunAt || null, lastResult: by.get(r.key)?.lastResult || "" }));
}

// force: run even if disabled (the admin's "Run now" button).
export async function runRule(key, { force = false } = {}) {
  const rule = RULES.find(r => r.key === key);
  if (!rule) throw Object.assign(new Error("Unknown automation"), { status: 404 });
  const state = await AutomationRule.findOneAndUpdate({ key }, {}, { new: true, upsert: true, setDefaultsOnInsert: true });
  if (!state.enabled && !force) return { key, skipped: true };
  const result = await rule.run({ email: state.email, settings: await getSettings() });
  state.lastRunAt = new Date();
  state.lastResult = result.detail + (result.emailed ? ` · ${result.emailed} email(s)` : "");
  await state.save();
  return { key, ...result };
}

export async function runEnabled() {
  const out = [];
  for (const r of RULES) {
    try { out.push(await runRule(r.key)); }
    catch (e) { out.push({ key: r.key, error: e.message }); }
  }
  return out;
}

// Long-running server only (not serverless): runs enabled rules every hour.
// Serverless deployments use the cron endpoint instead (see vercel.json).
// Every active institute's enabled rules, each inside its own institute.
export const runAllInstitutes = () => forEachTenant(async (t) => ({ institute: t?.code || null, ran: await runEnabled() }));

export function startScheduler() {
  const tick = () => { if (mongoose.connection.readyState === 1) runAllInstitutes().catch(e => console.error("Automations:", e.message)); };
  setTimeout(tick, 60 * 1000);
  return setInterval(tick, 60 * 60 * 1000);
}
