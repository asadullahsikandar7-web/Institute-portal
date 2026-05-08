// ═══════════════════════════════════════════════════════════════
//  server.js  —  EduTrack Pro Complete Backend
//  Stack: Node.js + Express + MongoDB + JWT + bcrypt + Nodemailer
//  npm install express mongoose bcryptjs jsonwebtoken cors dotenv nodemailer
//  Run:  node server.js
// ═══════════════════════════════════════════════════════════════

const express  = require("express");
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const cors     = require("cors");
const nodemailer = require("nodemailer");
const multer   = require("multer");
const path     = require("path");
const fs       = require("fs");
require("dotenv").config();

const app  = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "edutrack_secret_2026";
const MONGO_URI  = process.env.MONGO_URI  || "mongodb://localhost:27017/edutrack";

// ── Create uploads directory if missing ────────────────────────
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) { fs.mkdirSync(uploadsDir, { recursive: true }); }

// ── Multer Configuration for File Uploads ────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, uploadsDir); },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `student_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`;
    cb(null, name);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only images allowed"));
    cb(null, true);
  },
  limits: { fileSize: 2 * 1024 * 1024 } // 2 MB limit
});

// ── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());
app.use(express.static(uploadsDir)); // Serve uploaded files

// ── MongoDB ───────────────────────────────────────────────────
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅  MongoDB connected"))
  .catch(err => { console.error("❌  MongoDB:", err.message); process.exit(1); });

// ══════════════════════════════════════════════════════════════
//  EMAIL SERVICE (Nodemailer)
// ══════════════════════════════════════════════════════════════
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || "smtp.gmail.com",
  port:   parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "your_email@gmail.com",
    pass: process.env.SMTP_PASS || "your_app_password",
  },
});
const FROM = process.env.SMTP_FROM || '"EduTrack Pro" <no-reply@edutrack.edu>';

// ── Base email HTML wrapper ──
const emailBase = ({ title, accentColor = "#6c63ff", preheader = "", body }) => `
<!DOCTYPE html><html><head>
  <meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0a0b14;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0b14;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:linear-gradient(135deg,${accentColor}22,#101328);border:1px solid ${accentColor}33;border-radius:16px 16px 0 0;padding:28px 36px;text-align:center;">
          <div style="font-size:26px;margin-bottom:10px;">🎓</div>
          <div style="font-size:22px;font-weight:900;color:#e2e4f0;margin-bottom:4px;">EduTrack Pro</div>
          <div style="font-size:11px;color:${accentColor};font-weight:700;letter-spacing:1.5px;">STUDENT MANAGEMENT SYSTEM</div>
        </td></tr>
        <tr><td style="background:#101328;border:1px solid rgba(255,255,255,0.07);border-top:none;border-radius:0 0 16px 16px;padding:32px 36px;">
          ${body}
          <hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:28px 0;"/>
          <p style="font-size:11px;color:#5a5c72;text-align:center;margin:0;">Automated message from EduTrack Pro. Do not reply.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

// ── Email: Announcement ──
function announcementEmail({ studentName, title, body, category, priority, author, date }) {
  return emailBase({
    title: `Announcement: ${title}`,
    preheader: title,
    accentColor: priority === "high" ? "#f43f5e" : "#6c63ff",
    body: `
      <h2 style="font-size:20px;font-weight:800;color:#e2e4f0;margin:0 0 8px;">Hi ${studentName},</h2>
      <p style="font-size:14px;color:#9698b0;margin:0 0 22px;">A new announcement has been posted.</p>
      ${priority === "high" ? `<div style="background:rgba(244,63,94,0.1);border:1px solid rgba(244,63,94,0.25);border-radius:10px;padding:12px 16px;margin-bottom:16px;"><span style="color:#f43f5e;font-weight:700;font-size:13px;">🚨 URGENT NOTICE</span></div>` : ""}
      <div style="background:rgba(255,255,255,0.04);border-left:4px solid ${priority === "high" ? "#f43f5e" : "#6c63ff"};border-radius:0 12px 12px 0;padding:20px 22px;margin-bottom:20px;">
        <div style="font-size:10px;color:#6c63ff;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">${category || "general"}</div>
        <div style="font-size:17px;font-weight:800;color:#e2e4f0;margin-bottom:10px;">${title}</div>
        <div style="font-size:14px;color:#9698b0;line-height:1.7;">${body}</div>
      </div>
      <p style="font-size:12px;color:#5a5c72;margin:0;">Posted by <strong style="color:#9698b0;">${author}</strong> on ${date}</p>`,
  });
}

// ── Email: Exam Notification ──
function examEmail({ studentName, name, subject, date, maxMarks, venue }) {
  return emailBase({
    title: `New Exam: ${name}`,
    preheader: `${name} — ${subject} on ${date}`,
    accentColor: "#22d3ee",
    body: `
      <h2 style="font-size:20px;font-weight:800;color:#e2e4f0;margin:0 0 8px;">Hi ${studentName},</h2>
      <p style="font-size:14px;color:#9698b0;margin:0 0 22px;">A new exam has been scheduled. Please prepare accordingly.</p>
      <div style="background:rgba(34,211,238,0.06);border:1px solid rgba(34,211,238,0.2);border-radius:14px;padding:22px;margin-bottom:20px;text-align:center;">
        <div style="font-size:28px;margin-bottom:8px;">📝</div>
        <div style="font-size:20px;font-weight:900;color:#e2e4f0;margin-bottom:4px;">${name}</div>
        <div style="font-size:14px;color:#22d3ee;font-weight:700;">${subject}</div>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${[["📅 Date", date], ["📍 Venue", venue || "TBA"], ["📊 Max Marks", maxMarks]].map(([l,v]) =>
          `<tr><td style="padding:8px 0;"><div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:11px 15px;">
            <div style="font-size:10px;color:#5a5c72;font-weight:700;letter-spacing:0.8px;">${l}</div>
            <div style="font-size:14px;color:#e2e4f0;font-weight:700;margin-top:3px;">${v}</div>
          </div></td></tr>`).join("")}
      </table>
      <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:10px;padding:13px 16px;margin-top:16px;">
        <p style="font-size:13px;color:rgba(245,158,11,0.9);margin:0;">💡 Review your notes and past assignments. Contact your teacher for questions.</p>
      </div>`,
  });
}

// ── Email: Parent Message ──
function parentEmail({ parentName, studentName, rollNo, title, message, type, author, date }) {
  const accentColor = type === "complaint" || type === "warning" ? "#f97316" : type === "achievement" ? "#10b981" : "#6c63ff";
  const emoji = type === "complaint" ? "⚠️" : type === "achievement" ? "🏆" : type === "warning" ? "🚨" : "📢";
  return emailBase({
    title: `Message from School: ${title}`,
    preheader: `Regarding ${studentName} — ${title}`,
    accentColor,
    body: `
      <h2 style="font-size:20px;font-weight:800;color:#e2e4f0;margin:0 0 8px;">Dear ${parentName || "Parent/Guardian"},</h2>
      <p style="font-size:14px;color:#9698b0;margin:0 0 22px;">This message is regarding your child <strong style="color:#e2e4f0;">${studentName}</strong> (Roll #${rollNo}).</p>
      <div style="background:rgba(255,255,255,0.03);border-left:4px solid ${accentColor};border-radius:0 12px 12px 0;padding:20px 22px;margin-bottom:20px;">
        <div style="font-size:22px;margin-bottom:8px;">${emoji}</div>
        <div style="font-size:10px;color:${accentColor};font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">${type}</div>
        <div style="font-size:17px;font-weight:800;color:#e2e4f0;margin-bottom:10px;">${title}</div>
        <div style="font-size:14px;color:#9698b0;line-height:1.75;">${message}</div>
      </div>
      ${(type === "complaint" || type === "warning") ? `<div style="background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.2);border-radius:10px;padding:13px 16px;margin-bottom:16px;"><p style="font-size:13px;color:rgba(249,115,22,0.9);margin:0;">We kindly request you to speak with your child. Contact the school office to schedule a meeting.</p></div>` : ""}
      <p style="font-size:12px;color:#5a5c72;margin:0;">Sent by <strong style="color:#9698b0;">${author}</strong> on ${date}</p>`,
  });
}

// ── Email: Fee Reminder ──
function feeReminderEmail({ studentName, feeTitle, amount, dueDate, status }) {
  return emailBase({
    title: `Fee Reminder: ${feeTitle}`,
    preheader: `Fee payment reminder — ${feeTitle}`,
    accentColor: "#f59e0b",
    body: `
      <h2 style="font-size:20px;font-weight:800;color:#e2e4f0;margin:0 0 8px;">Hi ${studentName},</h2>
      <p style="font-size:14px;color:#9698b0;margin:0 0 22px;">This is a reminder about your pending fee payment.</p>
      <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:14px;padding:22px;margin-bottom:20px;text-align:center;">
        <div style="font-size:28px;margin-bottom:8px;">💳</div>
        <div style="font-size:20px;font-weight:900;color:#e2e4f0;margin-bottom:4px;">${feeTitle}</div>
        <div style="font-size:28px;font-weight:900;color:#f59e0b;margin:10px 0;">₨${Number(amount).toLocaleString()}</div>
        <div style="font-size:13px;color:#9698b0;">Due: <strong style="color:#f43f5e;">${dueDate}</strong></div>
      </div>
      <div style="background:rgba(244,63,94,0.08);border:1px solid rgba(244,63,94,0.2);border-radius:10px;padding:13px 16px;">
        <p style="font-size:13px;color:rgba(244,63,94,0.9);margin:0;">⚠️ Late payment charges will apply after the due date. Please pay promptly.</p>
      </div>`,
  });
}

// ── Email: Leave Status ──
function leaveStatusEmail({ studentName, status, from, to, type, reviewedBy }) {
  const approved = status === "approved";
  return emailBase({
    title: `Leave ${approved ? "Approved" : "Rejected"}`,
    preheader: `Your leave application has been ${status}`,
    accentColor: approved ? "#10b981" : "#f43f5e",
    body: `
      <h2 style="font-size:20px;font-weight:800;color:#e2e4f0;margin:0 0 8px;">Hi ${studentName},</h2>
      <p style="font-size:14px;color:#9698b0;margin:0 0 22px;">Your leave application has been <strong style="color:${approved ? "#10b981" : "#f43f5e"};">${status}</strong>.</p>
      <div style="background:rgba(${approved ? "16,185,129" : "244,63,94"},0.08);border:1px solid rgba(${approved ? "16,185,129" : "244,63,94"},0.25);border-radius:14px;padding:22px;margin-bottom:20px;text-align:center;">
        <div style="font-size:36px;margin-bottom:8px;">${approved ? "✅" : "❌"}</div>
        <div style="font-size:18px;font-weight:900;color:${approved ? "#10b981" : "#f43f5e"};">Leave ${approved ? "Approved" : "Rejected"}</div>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${[["Type", type], ["From", from], ["To", to], ["Reviewed by", reviewedBy || "Admin"]].map(([l,v]) =>
          `<tr><td style="padding:5px 0;"><div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px 14px;display:flex;justify-content:space-between;">
            <span style="font-size:12px;color:#5a5c72;">${l}</span>
            <span style="font-size:13px;color:#e2e4f0;font-weight:600;">${v}</span>
          </div></td></tr>`).join("")}
      </table>
      ${approved ? `<div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:13px 16px;margin-top:16px;"><p style="font-size:13px;color:rgba(16,185,129,0.9);margin:0;">✅ Your attendance for these dates has been automatically marked as "On Leave".</p></div>` : ""}`,
  });
}

// ── Helper: send email safely ──
async function sendMail(to, subject, html) {
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
    return { status: "sent" };
  } catch (err) {
    console.error("Email failed:", err.message);
    return { status: "failed", error: err.message };
  }
}

// ══════════════════════════════════════════════════════════════
//  MONGOOSE SCHEMAS
// ══════════════════════════════════════════════════════════════

// ── Student ──
const studentSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
  rollNo:      { type: String, required: true, unique: true, trim: true },
  password:    { type: String, required: true },
  photo:       { type: String, default: null },
  parentName:  { type: String, default: "" },
  parentEmail: { type: String, default: "" },
  phone:       { type: String, default: "" },
  address:     { type: String, default: "" },
  program:     { type: String, default: "BS Artificial Intelligence" },
  semester:    { type: Number, default: 1 },
  createdAt:   { type: Date, default: Date.now },
});
studentSchema.methods.toSafeObject = function () {
  const o = this.toObject(); delete o.password; return o;
};
const Student = mongoose.model("Student", studentSchema);

// ── Attendance ──
const attendanceSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  date:      { type: String, required: true },
  status:    { type: String, enum: ["present","absent","leave"], required: true },
  markedBy:  { type: String, default: "admin" },
  markedAt:  { type: Date, default: Date.now },
});
attendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });
const Attendance = mongoose.model("Attendance", attendanceSchema);

// ── Leave ──
const leaveSchema = new mongoose.Schema({
  studentId:  { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  from:       { type: String, required: true },
  to:         { type: String, required: true },
  type:       { type: String, enum: ["Medical","Family Emergency","Casual","Personal","Academic","Travel","Other"], default: "Personal" },
  reason:     { type: String, required: true, minlength: 20 },
  status:     { type: String, enum: ["pending","approved","rejected"], default: "pending" },
  appliedAt:  { type: String, default: () => new Date().toISOString().split("T")[0] },
  reviewedAt: { type: String, default: null },
  reviewedBy: { type: String, default: null },
});
const Leave = mongoose.model("Leave", leaveSchema);

// ── Exam ──
const examSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  subject:   { type: String, required: true },
  date:      { type: String, required: true },
  maxMarks:  { type: Number, default: 100 },
  venue:     { type: String, default: "" },
  status:    { type: String, enum: ["upcoming","completed","cancelled"], default: "upcoming" },
  createdAt: { type: Date, default: Date.now },
});
const Exam = mongoose.model("Exam", examSchema);

// ── Grade ──
const gradeSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  examId:    { type: mongoose.Schema.Types.ObjectId, ref: "Exam" },
  subject:   { type: String, required: true },
  examName:  { type: String, required: true },
  marks:     { type: Number, required: true },
  maxMarks:  { type: Number, required: true },
  date:      { type: String },
  remarks:   { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});
gradeSchema.index({ studentId: 1, examId: 1 }, { unique: true, sparse: true });
const Grade = mongoose.model("Grade", gradeSchema);

// ── Announcement ──
const announcementSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  body:        { type: String, required: true },
  category:    { type: String, enum: ["general","exam","fee","event"], default: "general" },
  priority:    { type: String, enum: ["low","normal","high"], default: "normal" },
  author:      { type: String, default: "Admin" },
  date:        { type: String, default: () => new Date().toISOString().split("T")[0] },
  emailStatus: { type: String, enum: ["pending","sent","partial","failed"], default: "pending" },
  emailCount:  { type: Number, default: 0 },
  createdAt:   { type: Date, default: Date.now },
});
const Announcement = mongoose.model("Announcement", announcementSchema);

// ── Fee ──
const feeSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student" }, // null = applies to all
  title:     { type: String, required: true },
  amount:    { type: Number, required: true },
  due:       { type: String, required: true },
  category:  { type: String, enum: ["tuition","lab","library","exam","transport","other"], default: "tuition" },
  status:    { type: String, enum: ["unpaid","paid","overdue"], default: "unpaid" },
  paidOn:    { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});
const Fee = mongoose.model("Fee", feeSchema);

// ── Timetable ──
const timetableSchema = new mongoose.Schema({
  day:      { type: String, required: true, enum: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"] },
  time:     { type: String, required: true },
  subject:  { type: String, required: true },
  teacher:  { type: String, required: true },
  room:     { type: String, required: true },
  program:  { type: String, default: "BS Artificial Intelligence" },
  semester: { type: Number, default: 1 },
});
const Timetable = mongoose.model("Timetable", timetableSchema);

// ── Parent Message ──
const parentMsgSchema = new mongoose.Schema({
  studentId:   { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  studentName: { type: String },
  rollNo:      { type: String },
  parentName:  { type: String, default: "" },
  parentEmail: { type: String, required: true },
  title:       { type: String, required: true },
  message:     { type: String, required: true },
  type:        { type: String, enum: ["announcement","complaint","achievement","warning"], default: "announcement" },
  author:      { type: String, default: "Admin" },
  date:        { type: String, default: () => new Date().toISOString().split("T")[0] },
  emailStatus: { type: String, enum: ["sent","failed","pending"], default: "pending" },
}, { timestamps: true });
const ParentMessage = mongoose.model("ParentMessage", parentMsgSchema);

// ── Class Management ──
const classSchema = new mongoose.Schema({
  classCode:         { type: String, required: true, unique: true },
  className:         { type: String, required: true },
  semester:          { type: Number, required: true },
  teacher:           { type: String, required: true },
  assistant:         { type: String, default: null },
  scheduleDay:       { type: String, required: true, enum: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"] },
  scheduleTime:      { type: String, required: true },
  room:              { type: String, required: true },
  tomorrowTopic:     { type: String, default: null },
  tomorrowMaterials: [{ type: String }],
  tomorrowAssignment:{ type: String, default: null },
  tomorrowDeadline:  { type: Date, default: null },
  students:          [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
  isActive:          { type: Boolean, default: true },
  createdAt:         { type: Date, default: Date.now },
  updatedAt:         { type: Date, default: Date.now },
});
const Class = mongoose.model("Class", classSchema);

// ── Notifications ──
const notificationSchema = new mongoose.Schema({
  recipientId:   { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
  recipientType: { type: String, enum: ["student","parent","admin"], default: "student" },
  title:         { type: String, required: true },
  message:       { type: String, required: true },
  type:          { type: String, enum: ["attendance","grade","fee","notice","assignment","exam","leave","announcement","alert"], default: "notice" },
  priority:      { type: String, enum: ["low","normal","high"], default: "normal" },
  icon:          { type: String, default: "bell" },
  actionUrl:     { type: String, default: null },
  relatedId:     { type: mongoose.Schema.Types.ObjectId, default: null },
  isRead:        { type: Boolean, default: false },
  readAt:        { type: Date, default: null },
  sentAt:        { type: Date, default: Date.now },
  channels:      {
    inApp:       { type: Boolean, default: true },
    email:       { type: Boolean, default: false },
    sms:         { type: Boolean, default: false },
  },
  sender:        { type: String, default: "System" },
  createdAt:     { type: Date, default: Date.now },
});
notificationSchema.index({ recipientId: 1, createdAt: -1 });
const Notification = mongoose.model("Notification", notificationSchema);

// ── Admin static credentials ──
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@edutrack.edu";
const ADMIN_PASS_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD || "admin123", 10);

// ══════════════════════════════════════════════════════════════
//  AUTH MIDDLEWARE
// ══════════════════════════════════════════════════════════════
function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return res.status(401).json({ error: "No token" });
  try { req.user = jwt.verify(h.split(" ")[1], JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: "Invalid token" }); }
}
function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
}

// ── Helpers ──
function dateRange(from, to) {
  const days = [], cur = new Date(from);
  while (cur <= new Date(to)) {
    days.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}
function todayStr() { return new Date().toISOString().split("T")[0]; }

// ══════════════════════════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════════════════════════

// POST /api/auth/admin-login
app.post("/api/auth/admin-login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "email and password required" });
    if (email !== ADMIN_EMAIL) return res.status(401).json({ error: "Admin email not found" });
    const ok = await bcrypt.compare(password, ADMIN_PASS_HASH);
    if (!ok) return res.status(401).json({ error: "Wrong password" });
    const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "12h" });
    res.json({ token, role: "admin" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/auth/student-login
app.post("/api/auth/student-login", async (req, res) => {
  try {
    const { rollNo, password } = req.body;
    if (!rollNo || !password) return res.status(400).json({ error: "rollNo and password required" });
    const student = await Student.findOne({ rollNo: rollNo.trim() });
    if (!student) return res.status(401).json({ error: "Roll number not found" });
    const ok = await bcrypt.compare(password, student.password);
    if (!ok) return res.status(401).json({ error: "Wrong password" });
    const token = jwt.sign({ role: "student", studentId: student._id.toString() }, JWT_SECRET, { expiresIn: "8h" });
    res.json({ token, role: "student", student: student.toSafeObject() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════
//  STUDENT ROUTES
// ══════════════════════════════════════════════════════════════

// GET /api/students
app.get("/api/students", auth, adminOnly, async (req, res) => {
  try {
    const students = await Student.find().sort({ rollNo: 1 }).select("-password");
    res.json(students);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/students
app.post("/api/students", auth, adminOnly, async (req, res) => {
  try {
    const { name, email, rollNo, password = "1234", parentName, parentEmail, phone, program, semester } = req.body;
    if (!name || !email || !rollNo) return res.status(400).json({ error: "name, email, rollNo required" });
    const hashed = await bcrypt.hash(password, 10);
    const student = await Student.create({ name, email, rollNo, password: hashed, parentName, parentEmail, phone, program, semester });
    res.status(201).json(student.toSafeObject());
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "Email or Roll No already exists" });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/students/:id  — update student info
app.patch("/api/students/:id", auth, adminOnly, async (req, res) => {
  try {
    const { password, ...fields } = req.body;
    if (password) fields.password = await bcrypt.hash(password, 10);
    const student = await Student.findByIdAndUpdate(req.params.id, fields, { new: true }).select("-password");
    if (!student) return res.status(404).json({ error: "Student not found" });
    res.json(student);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/students/:id
app.delete("/api/students/:id", auth, adminOnly, async (req, res) => {
  try {
    await Student.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/students/:id/photo — Upload student photo
app.patch("/api/students/:id/photo", auth, adminOnly, upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "photo file required" });
    // Store file path or URL
    const photoPath = `/uploads/${req.file.filename}`;
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { photo: photoPath },
      { new: true }
    ).select("-password");
    if (!student) return res.status(404).json({ error: "Student not found" });
    res.json({ success: true, student });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/students/:id/photo — Remove student photo
app.delete("/api/students/:id/photo", auth, adminOnly, async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { photo: null },
      { new: true }
    ).select("-password");
    if (!student) return res.status(404).json({ error: "Student not found" });
    res.json({ success: true, student });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════
//  ATTENDANCE ROUTES
// ══════════════════════════════════════════════════════════════

// GET /api/attendance?date=YYYY-MM-DD
app.get("/api/attendance", auth, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "date required" });
    const records = await Attendance.find({ date });
    const map = {};
    records.forEach(r => { map[r.studentId.toString()] = r.status; });
    // Auto-inject approved leaves
    const approvedLeaves = await Leave.find({
      status: "approved", from: { $lte: date }, to: { $gte: date },
    });
    approvedLeaves.forEach(l => {
      const sid = l.studentId.toString();
      if (!map[sid]) map[sid] = "leave";
    });
    res.json(map);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/attendance/history/:studentId?days=30
app.get("/api/attendance/history/:studentId", auth, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const { studentId } = req.params;
    const start = new Date();
    start.setDate(start.getDate() - parseInt(days) + 1);
    const startStr = start.toISOString().split("T")[0];
    const records = await Attendance.find({ studentId, date: { $gte: startStr } });
    const attMap = {};
    records.forEach(r => { attMap[r.date] = r.status; });
    const leaves = await Leave.find({
      studentId, status: "approved",
      from: { $lte: todayStr() }, to: { $gte: startStr },
    });
    const history = [];
    for (let i = parseInt(days) - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      let status = attMap[dateStr] || "unmarked";
      if (status === "unmarked" && leaves.some(l => dateStr >= l.from && dateStr <= l.to))
        status = "leave";
      history.push({ date: dateStr, status });
    }
    res.json(history);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/attendance
app.post("/api/attendance", auth, adminOnly, async (req, res) => {
  try {
    const { studentId, date, status } = req.body;
    if (!studentId || !date || !status) return res.status(400).json({ error: "studentId, date, status required" });
    if (!["present","absent","leave"].includes(status)) return res.status(400).json({ error: "invalid status" });
    const record = await Attendance.findOneAndUpdate(
      { studentId, date },
      { studentId, date, status, markedBy: "admin", markedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json(record);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/attendance/bulk
app.post("/api/attendance/bulk", auth, adminOnly, async (req, res) => {
  try {
    const { date, records } = req.body;
    const ops = records.map(r => ({
      updateOne: {
        filter: { studentId: r.studentId, date },
        update: { $set: { status: r.status, markedBy: "admin", markedAt: new Date() } },
        upsert: true,
      },
    }));
    await Attendance.bulkWrite(ops);
    res.json({ success: true, count: ops.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════
//  LEAVE ROUTES
// ══════════════════════════════════════════════════════════════

// GET /api/leaves
app.get("/api/leaves", auth, async (req, res) => {
  try {
    const filter = req.user.role === "admin" ? {} : { studentId: req.user.studentId };
    const leaves = await Leave.find(filter).populate("studentId", "-password").sort({ appliedAt: -1 });
    res.json(leaves);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/leaves
app.post("/api/leaves", auth, async (req, res) => {
  try {
    const studentId = req.user.role === "student" ? req.user.studentId : req.body.studentId;
    const { from, to, type, reason } = req.body;
    if (!from || !to || !reason) return res.status(400).json({ error: "from, to, reason required" });
    if (reason.trim().length < 20) return res.status(400).json({ error: "Reason must be at least 20 characters" });
    if (to < from) return res.status(400).json({ error: "to must be >= from" });
    const overlap = await Leave.findOne({
      studentId, status: { $ne: "rejected" },
      $or: [{ from: { $lte: to }, to: { $gte: from } }],
    });
    if (overlap) return res.status(409).json({ error: "Overlapping leave already exists" });
    const leave = await Leave.create({ studentId, from, to, type: type || "Personal", reason: reason.trim(), appliedAt: todayStr() });
    await leave.populate("studentId", "-password");
    res.status(201).json(leave);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/leaves/:id
app.patch("/api/leaves/:id", auth, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["approved","rejected"].includes(status)) return res.status(400).json({ error: "status must be approved or rejected" });
    const leave = await Leave.findByIdAndUpdate(
      req.params.id,
      { status, reviewedAt: todayStr(), reviewedBy: "Admin" },
      { new: true }
    ).populate("studentId", "-password");
    if (!leave) return res.status(404).json({ error: "Leave not found" });
    if (status === "approved") {
      const days = dateRange(leave.from, leave.to);
      const ops  = days.map(date => ({
        updateOne: {
          filter: { studentId: leave.studentId._id, date },
          update: { $set: { status: "leave", markedBy: "auto-leave", markedAt: new Date() } },
          upsert: true,
        },
      }));
      await Attendance.bulkWrite(ops);
    }
    // Email student about leave decision
    const student = await Student.findById(leave.studentId._id || leave.studentId);
    if (student?.email) {
      const html = leaveStatusEmail({
        studentName: student.name,
        status,
        from: leave.from,
        to: leave.to,
        type: leave.type,
        reviewedBy: "Admin",
      });
      await sendMail(
        student.email,
        `${status === "approved" ? "✅" : "❌"} Leave ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        html
      );
    }
    res.json(leave);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/leaves/:id
app.delete("/api/leaves/:id", auth, async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ error: "Leave not found" });
    if (req.user.role === "student") {
      if (leave.studentId.toString() !== req.user.studentId)
        return res.status(403).json({ error: "Not your leave" });
      if (leave.status !== "pending")
        return res.status(400).json({ error: "Can only cancel pending leaves" });
    }
    await leave.deleteOne();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════
//  EXAM ROUTES
// ══════════════════════════════════════════════════════════════

// GET /api/exams
app.get("/api/exams", auth, async (req, res) => {
  try {
    const exams = await Exam.find().sort({ date: 1 });
    res.json(exams);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/exams  — creates exam + emails all students
app.post("/api/exams", auth, adminOnly, async (req, res) => {
  try {
    const { name, subject, date, maxMarks, venue, status } = req.body;
    if (!name || !subject || !date) return res.status(400).json({ error: "name, subject, date required" });
    const exam = await Exam.create({ name, subject, date, maxMarks: maxMarks || 100, venue, status: status || "upcoming" });
    // Email all students
    const students = await Student.find({}, "name email");
    let sentCount = 0;
    for (const s of students) {
      if (!s.email) continue;
      const r = await sendMail(
        s.email,
        `📝 New Exam Scheduled: ${name} — ${subject}`,
        examEmail({ studentName: s.name, name, subject, date, maxMarks: maxMarks || 100, venue })
      );
      if (r.status === "sent") sentCount++;
    }
    await Exam.findByIdAndUpdate(exam._id, { emailStatus: "sent", emailCount: sentCount });
    res.status(201).json({ ...exam.toObject(), emailCount: sentCount, emailStatus: sentCount > 0 ? "sent" : "failed" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/exams/:id  — update exam status
app.patch("/api/exams/:id", auth, adminOnly, async (req, res) => {
  try {
    const exam = await Exam.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!exam) return res.status(404).json({ error: "Exam not found" });
    res.json(exam);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/exams/:id
app.delete("/api/exams/:id", auth, adminOnly, async (req, res) => {
  try {
    await Exam.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════
//  GRADE ROUTES
// ══════════════════════════════════════════════════════════════

// GET /api/grades/:studentId
app.get("/api/grades/:studentId", auth, async (req, res) => {
  try {
    // Students can only see their own grades
    if (req.user.role === "student" && req.user.studentId !== req.params.studentId)
      return res.status(403).json({ error: "Access denied" });
    const grades = await Grade.find({ studentId: req.params.studentId }).sort({ date: -1 });
    res.json(grades);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/grades  (admin — all grades with optional filter)
app.get("/api/grades", auth, adminOnly, async (req, res) => {
  try {
    const { studentId, subject } = req.query;
    const filter = {};
    if (studentId) filter.studentId = studentId;
    if (subject)   filter.subject   = subject;
    const grades = await Grade.find(filter).populate("studentId", "name rollNo").sort({ createdAt: -1 });
    res.json(grades);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/grades
app.post("/api/grades", auth, adminOnly, async (req, res) => {
  try {
    const { studentId, subject, examName, marks, maxMarks, examId, date, remarks } = req.body;
    if (!studentId || !subject || !examName || marks === undefined || !maxMarks)
      return res.status(400).json({ error: "studentId, subject, examName, marks, maxMarks required" });
    const grade = await Grade.create({ studentId, subject, examName, marks, maxMarks, examId, date: date || todayStr(), remarks });
    res.status(201).json(grade);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/grades/:id
app.patch("/api/grades/:id", auth, adminOnly, async (req, res) => {
  try {
    const grade = await Grade.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!grade) return res.status(404).json({ error: "Grade not found" });
    res.json(grade);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/grades/:id
app.delete("/api/grades/:id", auth, adminOnly, async (req, res) => {
  try {
    await Grade.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════
//  ANNOUNCEMENT ROUTES
// ══════════════════════════════════════════════════════════════

// GET /api/announcements
app.get("/api/announcements", auth, async (req, res) => {
  try {
    const announcements = await Announcement.find().sort({ createdAt: -1 });
    res.json(announcements);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/announcements  — creates + emails all students
app.post("/api/announcements", auth, adminOnly, async (req, res) => {
  try {
    const { title, body, category, priority, author } = req.body;
    if (!title || !body) return res.status(400).json({ error: "title and body required" });
    const date = todayStr();
    const ann = await Announcement.create({ title, body, category, priority, author: author || "Admin", date, emailStatus: "pending" });
    // Email all students
    const students = await Student.find({}, "name email");
    let sentCount = 0, failCount = 0;
    for (const s of students) {
      if (!s.email) continue;
      const r = await sendMail(
        s.email,
        `${priority === "high" ? "🚨 URGENT: " : "📢 "}${title}`,
        announcementEmail({ studentName: s.name, title, body, category, priority, author: author || "Admin", date })
      );
      if (r.status === "sent") sentCount++; else failCount++;
    }
    const emailStatus = failCount === 0 ? "sent" : sentCount === 0 ? "failed" : "partial";
    await Announcement.findByIdAndUpdate(ann._id, { emailStatus, emailCount: sentCount });
    res.status(201).json({ ...ann.toObject(), emailStatus, emailCount: sentCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/announcements/:id
app.delete("/api/announcements/:id", auth, adminOnly, async (req, res) => {
  try {
    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════
//  FEE ROUTES
// ══════════════════════════════════════════════════════════════

// GET /api/fees/:studentId  (or "all" for admin)
app.get("/api/fees/:studentId", auth, async (req, res) => {
  try {
    const { studentId } = req.params;
    if (req.user.role === "student" && req.user.studentId !== studentId)
      return res.status(403).json({ error: "Access denied" });
    const filter = studentId === "all" ? {} : {
      $or: [{ studentId }, { studentId: null }, { studentId: { $exists: false } }]
    };
    const fees = await Fee.find(filter).sort({ due: 1 });
    res.json(fees);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/fees  — create fee record
app.post("/api/fees", auth, adminOnly, async (req, res) => {
  try {
    const { studentId, title, amount, due, category } = req.body;
    if (!title || !amount || !due) return res.status(400).json({ error: "title, amount, due required" });
    const fee = await Fee.create({ studentId: studentId || null, title, amount, due, category });
    // If studentId provided, email that student; else email all
    const students = studentId
      ? await Student.find({ _id: studentId }, "name email")
      : await Student.find({}, "name email");
    for (const s of students) {
      if (!s.email) continue;
      await sendMail(
        s.email,
        `💳 Fee Reminder: ${title}`,
        feeReminderEmail({ studentName: s.name, feeTitle: title, amount, dueDate: due, status: "unpaid" })
      );
    }
    res.status(201).json(fee);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/fees/:id  — mark paid or update
app.patch("/api/fees/:id", auth, async (req, res) => {
  try {
    const update = { ...req.body };
    if (req.body.paid === true) { update.status = "paid"; update.paidOn = todayStr(); delete update.paid; }
    const fee = await Fee.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!fee) return res.status(404).json({ error: "Fee not found" });
    res.json(fee);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/fees/:id
app.delete("/api/fees/:id", auth, adminOnly, async (req, res) => {
  try {
    await Fee.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════
//  TIMETABLE ROUTES
// ══════════════════════════════════════════════════════════════

// GET /api/timetable
app.get("/api/timetable", auth, async (req, res) => {
  try {
    const { program, semester } = req.query;
    const filter = {};
    if (program)  filter.program  = program;
    if (semester) filter.semester = parseInt(semester);
    const entries = await Timetable.find(filter).sort({ day: 1, time: 1 });
    // Return grouped by day
    const grouped = {};
    const days = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    days.forEach(d => { grouped[d] = []; });
    entries.forEach(e => { if (grouped[e.day]) grouped[e.day].push(e); });
    res.json(grouped);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/timetable
app.post("/api/timetable", auth, adminOnly, async (req, res) => {
  try {
    const entry = await Timetable.create(req.body);
    res.status(201).json(entry);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/timetable/:id
app.patch("/api/timetable/:id", auth, adminOnly, async (req, res) => {
  try {
    const entry = await Timetable.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(entry);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/timetable/:id
app.delete("/api/timetable/:id", auth, adminOnly, async (req, res) => {
  try {
    await Timetable.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════
//  PARENT COMMUNICATION ROUTES
// ══════════════════════════════════════════════════════════════

// GET /api/parents/messages
app.get("/api/parents/messages", auth, adminOnly, async (req, res) => {
  try {
    const msgs = await ParentMessage.find().populate("studentId", "name rollNo").sort({ createdAt: -1 });
    res.json(msgs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/parents/messages/:studentId
app.get("/api/parents/messages/:studentId", auth, async (req, res) => {
  try {
    if (req.user.role === "student" && req.user.studentId !== req.params.studentId)
      return res.status(403).json({ error: "Access denied" });
    const msgs = await ParentMessage.find({ studentId: req.params.studentId }).sort({ createdAt: -1 });
    res.json(msgs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/parents/message  — send message + email parent
app.post("/api/parents/message", auth, adminOnly, async (req, res) => {
  try {
    const { studentId, parentName, parentEmail, title, message, type, author } = req.body;
    if (!studentId || !parentEmail || !title || !message)
      return res.status(400).json({ error: "studentId, parentEmail, title, message required" });
    const student = await Student.findById(studentId);
    const studentName = student?.name || req.body.studentName || "Student";
    const rollNo      = student?.rollNo || req.body.rollNo || "";
    const date        = todayStr();
    const msg = await ParentMessage.create({
      studentId, studentName, rollNo,
      parentName, parentEmail, title, message,
      type: type || "announcement",
      author: author || "Admin",
      date,
      emailStatus: "pending",
    });
    const emailResult = await sendMail(
      parentEmail,
      `${type === "complaint" || type === "warning" ? "⚠️ Important: " : type === "achievement" ? "🏆 " : "📢 "}${title} — Re: ${studentName}`,
      parentEmail({ parentName, studentName, rollNo, title, message, type: type || "announcement", author: author || "Admin", date })
    );
    await ParentMessage.findByIdAndUpdate(msg._id, { emailStatus: emailResult.status });
    res.status(201).json({ ...msg.toObject(), emailStatus: emailResult.status });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/parents/message/:id/resend  — retry failed email
app.post("/api/parents/message/:id/resend", auth, adminOnly, async (req, res) => {
  try {
    const msg = await ParentMessage.findById(req.params.id);
    if (!msg) return res.status(404).json({ error: "Message not found" });
    const result = await sendMail(
      msg.parentEmail,
      `Re-sent: ${msg.title} — Re: ${msg.studentName}`,
      parentEmail({ ...msg.toObject(), message: msg.message })
    );
    await ParentMessage.findByIdAndUpdate(msg._id, { emailStatus: result.status });
    res.json({ success: true, emailStatus: result.status });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/parents/message/:id
app.delete("/api/parents/message/:id", auth, adminOnly, async (req, res) => {
  try {
    await ParentMessage.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════
//  ANALYTICS ROUTE
// ══════════════════════════════════════════════════════════════

// GET /api/analytics
app.get("/api/analytics", auth, adminOnly, async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments();

    // Attendance stats (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startStr = thirtyDaysAgo.toISOString().split("T")[0];
    const attRecords = await Attendance.find({ date: { $gte: startStr } });
    const totalAtt  = attRecords.length;
    const presentAtt = attRecords.filter(r => r.status === "present").length;
    const avgAttRate = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0;

    // Today's attendance
    const todayRecords = await Attendance.find({ date: todayStr() });
    const todayPresent = todayRecords.filter(r => r.status === "present").length;
    const todayAtt     = Math.round((todayPresent / Math.max(totalStudents, 1)) * 100);

    // Leaves
    const totalLeaves   = await Leave.countDocuments();
    const pendingLeaves = await Leave.countDocuments({ status: "pending" });

    // Grades stats
    const allGrades = await Grade.find({});
    const avgScore  = allGrades.length
      ? Math.round(allGrades.reduce((s, g) => s + (g.marks / g.maxMarks) * 100, 0) / allGrades.length)
      : 0;

    // Fees
    const allFees   = await Fee.find({});
    const paidFees  = allFees.filter(f => f.status === "paid").reduce((s, f) => s + f.amount, 0);
    const totalFees = allFees.reduce((s, f) => s + f.amount, 0);

    // Weekly attendance trend (last 7 days)
    const weeklyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayRecords = attRecords.filter(r => r.date === dateStr);
      const dayPresent = dayRecords.filter(r => r.status === "present").length;
      weeklyTrend.push({
        date: dateStr,
        rate: dayRecords.length > 0 ? Math.round((dayPresent / Math.max(totalStudents, 1)) * 100) : 0,
      });
    }

    res.json({
      totalStudents,
      avgAttRate,
      todayAtt,
      todayPresent,
      pendingLeaves,
      totalLeaves,
      avgScore,
      paidFees,
      totalFees,
      feeCollectionRate: totalFees > 0 ? Math.round((paidFees / totalFees) * 100) : 0,
      weeklyTrend,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════
//  CLASS MANAGEMENT ROUTES
// ══════════════════════════════════════════════════════════════

// GET /api/classes — List all classes
app.get("/api/classes", auth, adminOnly, async (req, res) => {
  try {
    const classes = await Class.find({ isActive: true }).populate("students", "name rollNo email").sort({ semester: 1, scheduleDay: 1 });
    res.json(classes);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/classes/tomorrow — Get tomorrow's classes
app.get("/api/classes/tomorrow", auth, adminOnly, async (req, res) => {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayName = tomorrow.toLocaleDateString("en-US", { weekday: "long" });
    const classes = await Class.find({ isActive: true, scheduleDay: dayName }).populate("students", "name rollNo");
    res.json({ day: dayName, date: tomorrow.toISOString().split("T")[0], classes });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/classes — Create class
app.post("/api/classes", auth, adminOnly, async (req, res) => {
  try {
    const cls = new Class(req.body);
    await cls.save();
    res.status(201).json(cls);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// PUT /api/classes/:id — Update class
app.put("/api/classes/:id", auth, adminOnly, async (req, res) => {
  try {
    const cls = await Class.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date() }, { new: true });
    res.json(cls);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// PUT /api/classes/:id/tomorrow — Set tomorrow's class details
app.put("/api/classes/:id/tomorrow", auth, adminOnly, async (req, res) => {
  try {
    const { topic, materials, assignment, deadline } = req.body;
    const cls = await Class.findByIdAndUpdate(req.params.id, {
      tomorrowTopic: topic,
      tomorrowMaterials: materials || [],
      tomorrowAssignment: assignment,
      tomorrowDeadline: deadline,
      updatedAt: new Date(),
    }, { new: true });
    
    // Send notifications to all enrolled students
    if (cls.students.length > 0) {
      const notifs = cls.students.map(sid => ({
        recipientId: sid,
        recipientType: "student",
        title: `Tomorrow in ${cls.className}`,
        message: `Topic: ${topic}. Assignment: ${assignment || "None"}`,
        type: "assignment",
        priority: "normal",
        actionUrl: `/classes/${cls._id}`,
        sender: "System",
      }));
      await Notification.insertMany(notifs);
    }
    
    res.json(cls);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// DELETE /api/classes/:id — Delete class
app.delete("/api/classes/:id", auth, adminOnly, async (req, res) => {
  try {
    await Class.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════
//  NOTIFICATION ROUTES
// ══════════════════════════════════════════════════════════════

// GET /api/notifications — Get notifications for current user
app.get("/api/notifications", auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipientId: req.user.studentId }).sort({ createdAt: -1 }).limit(50);
    res.json(notifications);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/notifications/unread — Count unread notifications
app.get("/api/notifications/unread", auth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ recipientId: req.user.studentId, isRead: false });
    res.json({ unread: count });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/notifications/:id/read — Mark notification as read
app.put("/api/notifications/:id/read", auth, async (req, res) => {
  try {
    const notif = await Notification.findByIdAndUpdate(req.params.id, { isRead: true, readAt: new Date() }, { new: true });
    res.json(notif);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/notifications — Create notification (admin only)
app.post("/api/notifications", auth, adminOnly, async (req, res) => {
  try {
    const { recipientId, title, message, type, priority, actionUrl, sender } = req.body;
    const notif = new Notification({
      recipientId: recipientId || null,
      title,
      message,
      type: type || "notice",
      priority: priority || "normal",
      actionUrl: actionUrl || null,
      sender: sender || "Admin",
    });
    await notif.save();
    res.status(201).json(notif);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// POST /api/notifications/broadcast — Send to all students
app.post("/api/notifications/broadcast", auth, adminOnly, async (req, res) => {
  try {
    const { title, message, type, priority } = req.body;
    const students = await Student.find().select("_id");
    const notifs = students.map(s => ({
      recipientId: s._id,
      title,
      message,
      type: type || "notice",
      priority: priority || "normal",
      sender: "System",
    }));
    const result = await Notification.insertMany(notifs);
    res.json({ success: true, count: result.length });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// DELETE /api/notifications/:id — Delete notification
app.delete("/api/notifications/:id", auth, async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════
//  SEED ROUTE (development only — creates admin + sample data)
// ══════════════════════════════════════════════════════════════
app.post("/api/seed", async (req, res) => {
  if (process.env.NODE_ENV === "production")
    return res.status(403).json({ error: "Not allowed in production" });
  try {
    // Seed timetable if empty
    const ttCount = await Timetable.countDocuments();
    if (ttCount === 0) {
      const defaultTT = [
        { day:"Monday",    time:"08:00-09:30", subject:"Mathematics",     teacher:"Dr. Ahmed",  room:"LH-101",  program:"BS Artificial Intelligence", semester:1 },
        { day:"Monday",    time:"10:00-11:30", subject:"Physics",          teacher:"Prof. Khan", room:"Lab-2",   program:"BS Artificial Intelligence", semester:1 },
        { day:"Monday",    time:"01:00-02:30", subject:"English",          teacher:"Ms. Sara",   room:"LH-204",  program:"BS Artificial Intelligence", semester:1 },
        { day:"Tuesday",   time:"08:00-09:30", subject:"Computer Science", teacher:"Dr. Bilal",  room:"CS-Lab",  program:"BS Artificial Intelligence", semester:1 },
        { day:"Tuesday",   time:"10:00-11:30", subject:"Chemistry",        teacher:"Dr. Nadia",  room:"Chem-Lab",program:"BS Artificial Intelligence", semester:1 },
        { day:"Wednesday", time:"08:00-09:30", subject:"Mathematics",     teacher:"Dr. Ahmed",  room:"LH-101",  program:"BS Artificial Intelligence", semester:1 },
        { day:"Wednesday", time:"11:00-12:30", subject:"Physics",          teacher:"Prof. Khan", room:"LH-305",  program:"BS Artificial Intelligence", semester:1 },
        { day:"Thursday",  time:"09:00-10:30", subject:"English",          teacher:"Ms. Sara",   room:"LH-204",  program:"BS Artificial Intelligence", semester:1 },
        { day:"Thursday",  time:"11:00-12:30", subject:"Chemistry",        teacher:"Dr. Nadia",  room:"LH-103",  program:"BS Artificial Intelligence", semester:1 },
        { day:"Friday",    time:"08:00-09:00", subject:"Mathematics",     teacher:"Dr. Ahmed",  room:"LH-101",  program:"BS Artificial Intelligence", semester:1 },
        { day:"Friday",    time:"09:30-10:30", subject:"Computer Science", teacher:"Dr. Bilal",  room:"CS-Lab",  program:"BS Artificial Intelligence", semester:1 },
      ];
      await Timetable.insertMany(defaultTT);
    }
    res.json({ success: true, message: "Seed complete" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Health check ──
app.get("/api/health", (_, res) => res.json({
  status: "ok",
  time: new Date(),
  version: "EduTrack Pro v3.0",
}));

// ── 404 handler ──
app.use((req, res) => res.status(404).json({ error: `Route ${req.method} ${req.path} not found` }));

// ── Start server ──
app.listen(PORT, () => {
  console.log(`\n🚀  EduTrack Pro server running on http://localhost:${PORT}`);
  console.log(`📧  Email: ${process.env.SMTP_USER || "(not configured)"}`);
  console.log(`🗄️   MongoDB: ${MONGO_URI}`);
  console.log(`\n👤  Admin login:`);
  console.log(`    Email:    ${ADMIN_EMAIL}`);
  console.log(`    Password: ${process.env.ADMIN_PASSWORD || "admin123"}\n`);
});