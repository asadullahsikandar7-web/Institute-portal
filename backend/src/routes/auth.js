import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Student from "../models/studentModel.js";
import Admin from "../models/adminModel.js";

const router = express.Router();
export default router;
const SECRET = "super_secret_key";

router.post("/student-login", async (req, res) => {
  try {
    const { rollNo, password } = req.body;

    const student = await Student.findOne({ rollNo });

    if (!student) {
      return res.status(401).json({ error: "Student not found" });
    }

    // 🔥 compare hashed password
    const isMatch = await bcrypt.compare(password, student.password);

    if (!isMatch) {
      return res.status(401).json({ error: "Wrong password" });
    }

    const token = jwt.sign(
      { id: student._id, role: "student" },
      SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      role: "student",
      student,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/admin-login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ error: "Admin not found" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const token = jwt.sign(
      { role: "admin" },
      SECRET,
      { expiresIn: "1d" }
    );

    res.json({ token, role: "admin" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});