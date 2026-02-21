// ═══════════════════════════════════════════════════════════════
//  server.js  —  Attendance System Backend
//  Stack: Node.js + Express + MongoDB (Mongoose) + JWT + bcrypt
//  Run:  node server.js
// ═══════════════════════════════════════════════════════════════

const express    = require("express");
const mongoose   = require("mongoose");
const bcrypt     = require("bcryptjs");
const jwt        = require("jsonwebtoken");
const cors       = require("cors");
require("dotenv").config();

const app  = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "attendance_super_secret_key_2026";
const MONGO_URI  = process.env.MONGO_URI  || "mongodb://localhost:27017/attendance";

// ── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

// ── MongoDB Connection ─────────────────────────────────────────
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅  MongoDB connected:", MONGO_URI))
  .catch(err => { console.error("❌  MongoDB error:", err.message); process.exit(1); });

// ══════════════════════════════════════════════════════════════
//  SCHEMAS & MODELS
// ══════════════════════════════════════════════════════════════

// ── Student ──
const studentSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  rollNo:    { type: String, required: true, unique: true, trim: true },
  password:  { type: String, required: true },   // hashed
  createdAt: { type: Date, default: Date.now },
});
// Never send password in API responses
studentSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};
const Student = mongoose.model("Student", studentSchema);

// ── Attendance ──
const attendanceSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  date:      { type: String, required: true },   // "YYYY-MM-DD"
  status:    { type: String, enum: ["present","absent","leave"], required: true },
  markedBy:  { type: String, default: "admin" }, // "admin" | "auto-leave"
  markedAt:  { type: Date,   default: Date.now },
});
// Compound unique index: one record per student per day
attendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });
const Attendance = mongoose.model("Attendance", attendanceSchema);

// ── Leave ──
const leaveSchema = new mongoose.Schema({
  studentId:  { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  from:       { type: String, required: true },   // "YYYY-MM-DD"
  to:         { type: String, required: true },
  type:       { type: String, enum: ["Medical","Family Emergency","Personal","Academic","Travel","Other"], default: "Personal" },
  reason:     { type: String, required: true, minlength: 20 },
  status:     { type: String, enum: ["pending","approved","rejected"], default: "pending" },
  appliedAt:  { type: String, default: () => new Date().toISOString().split("T")[0] },
  reviewedAt: { type: String, default: null },
});
const Leave = mongoose.model("Leave", leaveSchema);

// ── Admin (single fixed admin for simplicity) ──
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD || "admin123", 10);

// ══════════════════════════════════════════════════════════════
//  AUTH MIDDLEWARE
// ══════════════════════════════════════════════════════════════
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer "))
    return res.status(401).json({ error: "No token provided" });
  try {
    req.user = jwt.verify(header.split(" ")[1], JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
function adminOnly(req, res, next) {
  if (req.user?.role !== "admin")
    return res.status(403).json({ error: "Admin access required" });
  next();
}

// ══════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════
function dateRange(from, to) {
  const days = [], cur = new Date(from);
  while (cur <= new Date(to)) {
    days.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// ══════════════════════════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════════════════════════

// POST /api/auth/admin-login
app.post("/api/auth/admin-login", async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "Password required" });
  const ok = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  if (!ok) return res.status(401).json({ error: "Wrong password" });
  const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "12h" });
  res.json({ token, role: "admin" });
});

// POST /api/auth/student-login
app.post("/api/auth/student-login", async (req, res) => {
  const { rollNo, password } = req.body;
  if (!rollNo || !password) return res.status(400).json({ error: "rollNo and password required" });
  const student = await Student.findOne({ rollNo: rollNo.trim() });
  if (!student) return res.status(401).json({ error: "Roll number not found" });
  const ok = await bcrypt.compare(password, student.password);
  if (!ok) return res.status(401).json({ error: "Wrong password" });
  const token = jwt.sign({ role: "student", studentId: student._id.toString() }, JWT_SECRET, { expiresIn: "8h" });
  res.json({ token, role: "student", student: student.toSafeObject() });
});

// ══════════════════════════════════════════════════════════════
//  STUDENT ROUTES
// ══════════════════════════════════════════════════════════════

// GET /api/students  (admin only)
app.get("/api/students", authMiddleware, adminOnly, async (req, res) => {
  const students = await Student.find().sort({ rollNo: 1 }).select("-password");
  res.json(students);
});

// POST /api/students  (admin only)
app.post("/api/students", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, email, rollNo, password = "1234" } = req.body;
    if (!name || !email || !rollNo) return res.status(400).json({ error: "name, email, rollNo required" });
    const hashed = await bcrypt.hash(password, 10);
    const student = await Student.create({ name, email, rollNo, password: hashed });
    res.status(201).json(student.toSafeObject());
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "Email or Roll No already exists" });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/students/:id  (admin only)
app.delete("/api/students/:id", authMiddleware, adminOnly, async (req, res) => {
  await Student.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════
//  ATTENDANCE ROUTES
// ══════════════════════════════════════════════════════════════

// GET /api/attendance?date=YYYY-MM-DD
// Returns { studentId: "present"|"absent"|"leave", ... } for that date
// Auto-injects approved leaves
app.get("/api/attendance", authMiddleware, async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "date query param required" });

  // Real attendance records
  const records = await Attendance.find({ date });
  const map = {};
  records.forEach(r => { map[r.studentId.toString()] = r.status; });

  // Auto-inject approved leaves for students not yet recorded
  const approvedLeaves = await Leave.find({
    status: "approved",
    from: { $lte: date },
    to:   { $gte: date },
  });
  approvedLeaves.forEach(l => {
    const sid = l.studentId.toString();
    if (!map[sid]) map[sid] = "leave";  // don't override manual mark
  });

  res.json(map);
});

// GET /api/attendance/history/:studentId?days=30
// Returns last N days of attendance for a student (used in profile drawer)
app.get("/api/attendance/history/:studentId", authMiddleware, async (req, res) => {
  const { days = 30 } = req.query;
  const { studentId } = req.params;
  const start = new Date();
  start.setDate(start.getDate() - parseInt(days) + 1);
  const startStr = start.toISOString().split("T")[0];

  // Manual records
  const records = await Attendance.find({
    studentId,
    date: { $gte: startStr },
  });
  const attMap = {};
  records.forEach(r => { attMap[r.date] = r.status; });

  // Approved leaves in range
  const leaves = await Leave.find({
    studentId,
    status: "approved",
    from:   { $lte: new Date().toISOString().split("T")[0] },
    to:     { $gte: startStr },
  });

  // Build day-by-day array
  const history = [];
  for (let i = parseInt(days) - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    let status = attMap[dateStr] || "unmarked";
    if (status === "unmarked") {
      const onLeave = leaves.some(l => dateStr >= l.from && dateStr <= l.to);
      if (onLeave) status = "leave";
    }
    history.push({ date: dateStr, status });
  }
  res.json(history);
});

// POST /api/attendance  (admin only — mark single student)
app.post("/api/attendance", authMiddleware, adminOnly, async (req, res) => {
  const { studentId, date, status } = req.body;
  if (!studentId || !date || !status)
    return res.status(400).json({ error: "studentId, date, status required" });
  if (!["present","absent","leave"].includes(status))
    return res.status(400).json({ error: "status must be present|absent|leave" });
  try {
    const record = await Attendance.findOneAndUpdate(
      { studentId, date },
      { studentId, date, status, markedBy: "admin", markedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/attendance/bulk  (admin — mark multiple at once)
app.post("/api/attendance/bulk", authMiddleware, adminOnly, async (req, res) => {
  const { date, records } = req.body;
  // records = [{ studentId, status }, ...]
  const ops = records.map(r => ({
    updateOne: {
      filter: { studentId: r.studentId, date },
      update: { $set: { status: r.status, markedBy: "admin", markedAt: new Date() } },
      upsert: true,
    },
  }));
  await Attendance.bulkWrite(ops);
  res.json({ success: true, count: ops.length });
});

// ══════════════════════════════════════════════════════════════
//  LEAVE ROUTES
// ══════════════════════════════════════════════════════════════

// GET /api/leaves  (admin gets all; student gets own)
app.get("/api/leaves", authMiddleware, async (req, res) => {
  const filter = req.user.role === "admin" ? {} : { studentId: req.user.studentId };
  const leaves = await Leave.find(filter)
    .populate("studentId", "-password")
    .sort({ appliedAt: -1 });
  res.json(leaves);
});

// POST /api/leaves  (student applies leave)
app.post("/api/leaves", authMiddleware, async (req, res) => {
  // Students can only apply for themselves
  const studentId = req.user.role === "student"
    ? req.user.studentId
    : req.body.studentId;

  const { from, to, type, reason } = req.body;
  if (!from || !to || !reason)
    return res.status(400).json({ error: "from, to, reason required" });
  if (reason.trim().length < 20)
    return res.status(400).json({ error: "Reason must be at least 20 characters" });
  if (to < from)
    return res.status(400).json({ error: "to date must be >= from date" });

  // Check for overlapping leave
  const overlap = await Leave.findOne({
    studentId,
    status: { $ne: "rejected" },
    $or: [{ from: { $lte: to }, to: { $gte: from } }],
  });
  if (overlap)
    return res.status(409).json({ error: "Overlapping leave already exists for these dates" });

  const leave = await Leave.create({
    studentId,
    from, to, type: type || "Personal",
    reason: reason.trim(),
    appliedAt: new Date().toISOString().split("T")[0],
  });
  await leave.populate("studentId", "-password");
  res.status(201).json(leave);
});

// PATCH /api/leaves/:id  (admin approves / rejects)
app.patch("/api/leaves/:id", authMiddleware, adminOnly, async (req, res) => {
  const { status } = req.body;
  if (!["approved","rejected"].includes(status))
    return res.status(400).json({ error: "status must be approved or rejected" });

  const leave = await Leave.findByIdAndUpdate(
    req.params.id,
    { status, reviewedAt: new Date().toISOString().split("T")[0] },
    { new: true }
  ).populate("studentId", "-password");

  if (!leave) return res.status(404).json({ error: "Leave not found" });

  // If approved → auto-write attendance records for every day in range
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

  res.json(leave);
});

// DELETE /api/leaves/:id  (student can cancel pending; admin can delete any)
app.delete("/api/leaves/:id", authMiddleware, async (req, res) => {
  const leave = await Leave.findById(req.params.id);
  if (!leave) return res.status(404).json({ error: "Leave not found" });
  if (req.user.role === "student" && leave.studentId.toString() !== req.user.studentId)
    return res.status(403).json({ error: "Cannot delete another student's leave" });
  if (req.user.role === "student" && leave.status !== "pending")
    return res.status(400).json({ error: "Can only cancel pending leaves" });
  await leave.deleteOne();
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════
//  STATS ROUTE
// ══════════════════════════════════════════════════════════════

// GET /api/stats?date=YYYY-MM-DD  (admin dashboard numbers)
app.get("/api/stats", authMiddleware, adminOnly, async (req, res) => {
  const { date } = req.query;
  const totalStudents = await Student.countDocuments();
  const records = await Attendance.find({ date });
  const present = records.filter(r=>r.status==="present").length;
  const absent  = records.filter(r=>r.status==="absent").length;
  const leave   = records.filter(r=>r.status==="leave").length;
  res.json({ totalStudents, present, absent, leave, unmarked: totalStudents - present - absent - leave });
});

// ── Health check ──
app.get("/api/health", (_, res) => res.json({ status: "ok", time: new Date() }));

// ── Start ──
app.listen(PORT, () => console.log(`🚀  Server running on http://localhost:${PORT}`));