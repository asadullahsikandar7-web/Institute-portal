import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import Student from "../models/studentModel.js";
import Admin from "../models/adminModel.js";
import Teacher from "../models/Teacher.js";
import Parent from "../models/Parent.js";
import { authMiddleware, authAny } from "../middleware/auth.js";
import { checkAdminSecondFactor, createResetToken, consumeResetToken } from "../services/security.js";
import { tenantClaims, instituteInfo } from "../tenancy/middleware.js";

// Belt-and-suspenders: server.js also calls dotenv.config(), but ES module
// imports are hoisted above it, so any module whose top-level code reads
// process.env (like the SECRET line below) can't rely on that. dotenv's
// config() is idempotent, so calling it again here just guarantees this
// specific module sees real .env values regardless of import order.
dotenv.config();

const router = express.Router();

const SECRET = process.env.JWT_SECRET || "super_secret_key";

// ================= STUDENT LOGIN =================
router.post("/student-login", async (req, res) => {
  try {
    const { rollNo, password } = req.body;

    // include password explicitly (schema sets select: false)
    const student = await Student.findOne({ rollNo }).select('+password');

    if (!student) {
      return res.status(401).json({ error: "Student not found" });
    }

    // Ensure password field exists on student record
    if (!student.password) {
      return res.status(401).json({ error: "Student password not set. Contact admin." });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, student.password);

    if (!isMatch) {
      return res.status(401).json({ error: "Wrong password" });
    }

    // Create token
    const token = jwt.sign(
      {
        id: student._id,
        studentId: student._id.toString(),
        role: "student",
        ...tenantClaims(),
      },
      SECRET,
      { expiresIn: "1d" }
    );

    // Don't return password in response
    const safeStudent = student.toObject ? student.toObject() : { ...student };
    delete safeStudent.password;

    res.json({
      token,
      role: "student",
      student: safeStudent,
      institute: instituteInfo(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ================= ADMIN LOGIN =================
router.post("/admin-login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password required",
      });
    }

    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res.status(401).json({
        error: "Admin not found",
      });
    }

    // Ensure password field exists on admin record
    if (!admin.password) {
      return res.status(401).json({
        error: "Admin password not set. Contact superadmin.",
      });
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(401).json({
        error: "Invalid password",
      });
    }

    const secondFactor = await checkAdminSecondFactor(Admin, admin, req.body.otp);
    if (secondFactor) return res.status(secondFactor.status).json(secondFactor.body);

    // Create token
    const token = jwt.sign(
      {
        id: admin._id,
        email: admin.email,
        role: "admin",
        isSuperAdmin: admin.isSuperAdmin,
        adminRole: admin.adminRole || "admin",
        ...tenantClaims(),
      },
      SECRET,
      { expiresIn: "12h" }
    );

    res.json({
      token,
      role: "admin",
      isSuperAdmin: admin.isSuperAdmin,
      email: admin.email,
      adminRole: admin.adminRole || "admin",
      institute: instituteInfo(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Server error",
    });
  }
});

// ================= TEACHER LOGIN =================
router.post("/teacher-login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    // Teacher.password has select:false (see Teacher.js) — explicit select needed.
    const teacher = await Teacher.findOne({ email: email.trim().toLowerCase() }).select("+password");

    if (!teacher) {
      return res.status(401).json({ error: "Teacher not found" });
    }

    if (!teacher.isActive) {
      return res.status(403).json({ error: "This teacher account has been deactivated. Contact admin." });
    }

    const isMatch = await bcrypt.compare(password, teacher.password);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const token = jwt.sign(
      {
        id: teacher._id,
        teacherId: teacher._id.toString(),
        role: "teacher",
        ...tenantClaims(),
      },
      SECRET,
      { expiresIn: "12h" }
    );

    const safeTeacher = teacher.toObject();
    delete safeTeacher.password;

    res.json({
      token,
      role: "teacher",
      teacher: safeTeacher,
      institute: instituteInfo(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ================= SET STUDENT PASSWORD (ADMIN ONLY) =================
router.post("/set-student-password", authMiddleware, async (req, res) => {
  try {
    const { studentId, newPassword } = req.body;
    const adminId = req.user.id;
    const userRole = req.user.role;

    // Check if user is admin
    if (userRole !== "admin") {
      return res.status(403).json({ error: "Only admins can set student passwords" });
    }

    // Validate inputs
    if (!studentId || !newPassword) {
      return res.status(400).json({
        error: "Student ID and password required",
      });
    }

    // Find student
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update student password
    student.password = hashedPassword;
    await student.save();

    res.json({
      success: true,
      message: `Password set for student ${student.rollNo}`,
      studentId: student._id,
      rollNo: student.rollNo,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Server error while setting password",
    });
  }
});

// ================= PARENT LOGIN =================
// Only works once an admin has enabled portal access for the parent and
// set a password (PATCH /api/parents/:id/portal). One generic failure
// message for every case, so the endpoint can't be used to discover which
// emails belong to parents.
router.post("/parent-login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const parent = await Parent.findOne({ email: String(email).trim().toLowerCase(), status: "active", portalEnabled: true }).select("+password");
    const isMatch = parent?.password ? await bcrypt.compare(password, parent.password) : false;
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password, or portal access is not enabled." });
    }

    const token = jwt.sign({ id: parent._id, parentId: parent._id.toString(), role: "parent", ...tenantClaims() }, SECRET, { expiresIn: "12h" });
    const safeParent = parent.toObject();
    delete safeParent.password;
    res.json({ token, role: "parent", parent: safeParent, institute: instituteInfo() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ================= FORGOT / RESET PASSWORD =================
// Always answers the same way whether or not the account exists, so the
// form can't be used to discover who has an account. The emailed link is
// single-use and expires after 30 minutes (services/security.js).
const RESET_MODELS = { admin: Admin, teacher: Teacher, student: Student, parent: Parent };
router.post("/forgot-password", async (req, res) => {
  const generic = { message: "If an account matches, a reset link has been sent to its email address." };
  try {
    const { role, identifier } = req.body;
    const Model = RESET_MODELS[role];
    const id = String(identifier || "").trim();
    if (!Model || !id) return res.status(400).json({ error: "Choose your role and enter your email (or roll number for students)." });
    const account = role === "student"
      ? await Student.findOne({ $or: [{ rollNo: id }, { email: id.toLowerCase() }] }).select("name email")
      : await Model.findOne({ email: id.toLowerCase() }).select("name email");
    if (!account?.email) return res.json(generic);
    const token = await createResetToken(role, account._id);
    const base = (process.env.FRONTEND_URL || req.headers.origin || "").replace(/\/+$/, "");
    const code = tenantClaims().institute;
    const link = `${base}/reset-password?token=${token}${code ? `&i=${encodeURIComponent(code)}` : ""}`;
    try {
      const { sendMail } = await import("../utils/mailer.js");
      await sendMail({ to: account.email, subject: "Reset your ACADEXA password", text: `Hello ${account.name || ""},\n\nSomeone (hopefully you) asked to reset the password for your ${role} account. Open this link within 30 minutes to choose a new one:\n\n${link}\n\nIf you didn't ask for this, ignore this email — your password stays the same.` });
    } catch (e) { console.error("Reset email failed:", e.message); }
    res.json(generic);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const out = await consumeResetToken(req.body.token, req.body.password, RESET_MODELS);
    if (!out.ok) return res.status(400).json({ error: out.error });
    res.json({ success: true, role: out.role, message: "Password changed. You can sign in now." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ================= CHANGE OWN PASSWORD =================
// Self-service for students, teachers and parents — needed now that
// accounts created by admissions/bulk import start on a one-time password.
// (Admins already have /api/admin/admins/:id/change-password.)
router.post("/change-password", authAny("student", "teacher", "parent"), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password are required" });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters" });
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({ error: "New password must be different from the current one" });
    }

    const Model = { student: Student, teacher: Teacher, parent: Parent }[req.user.role];
    const account = await Model.findById(req.user.id).select("+password");
    if (!account?.password || !(await bcrypt.compare(currentPassword, account.password))) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // updateOne rather than save(): legacy student rows can fail unrelated
    // schema validation, which shouldn't block a password change.
    await Model.updateOne({ _id: account._id }, { password: await bcrypt.hash(newPassword, 10) });
    res.json({ success: true, message: "Password changed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;