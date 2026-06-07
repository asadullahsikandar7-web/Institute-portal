import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Student from "../models/studentModel.js";
import Admin from "../models/adminModel.js";
import { authMiddleware } from "../middleware/auth.js";

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
        role: "student",
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

    // Create token
    const token = jwt.sign(
      {
        id: admin._id,
        email: admin.email,
        role: "admin",
        isSuperAdmin: admin.isSuperAdmin,
      },
      SECRET,
      { expiresIn: "12h" }
    );

    res.json({
      token,
      role: "admin",
      isSuperAdmin: admin.isSuperAdmin,
      email: admin.email,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Server error",
    });
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

export default router;