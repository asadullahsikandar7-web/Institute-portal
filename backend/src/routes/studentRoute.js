import express from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import Student from "../models/studentModel.js";
import { auth } from "../middleware/auth.js";
import multer from "multer";
import path from "path";

const router = express.Router();

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || "institute_portal";
const isCloudinaryConfigured = CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET;

const photoUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image uploads are allowed"));
    }
    cb(null, true);
  },
  limits: { fileSize: 2 * 1024 * 1024 }
});

async function uploadToCloudinary(file) {
  if (!isCloudinaryConfigured) {
    throw new Error("Cloudinary configuration is missing");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHash("sha1")
    .update(`timestamp=${timestamp}${CLOUDINARY_API_SECRET}`)
    .digest("hex");

  const formData = new FormData();
  formData.append("file", `data:${file.mimetype};base64,${file.buffer.toString("base64")}`);
  formData.append("api_key", CLOUDINARY_API_KEY);
  formData.append("timestamp", timestamp.toString());
  formData.append("signature", signature);
  formData.append("folder", CLOUDINARY_FOLDER);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Cloudinary upload failed");
  }
  return data.secure_url || data.url;
}

// ── Get all students (Admin only) ──
router.get("/", auth("admin"), async (req, res) => {
  try {
    const students = await Student.find().select("-password").sort({ createdAt: -1 });
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Add student (Admin only) ──
router.post("/", auth("admin"), async (req, res) => {
  try {
    const { name, email, rollNo, password, parentName, parentEmail } = req.body;
    if (!name || !email || !rollNo || !password)
      return res.status(400).json({ error: "name, email, rollNo, password are required" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const student = new Student({
      name, email, rollNo,
      password: hashedPassword,
      parentName:  parentName  || "",
      parentEmail: parentEmail || "",
    });

    await student.save();
    const out = student.toObject();
    delete out.password;
    res.status(201).json(out);
    // send welcome email (non-blocking)
    try {
      const { sendMail } = await import("../utils/mailer.js");
      const { welcomeStudentTemplate } = await import("../utils/emailTemplates.js");
      if (sendMail) {
        const html = welcomeStudentTemplate(student, password);
        const text = `Hey ${student.name}! Your ACADEXA account is ready.\n\nRoll Number: ${student.rollNo}\nPassword: ${password}\n\nLog in here: ${process.env.FRONTEND_URL || "https://institute-portal-psi.vercel.app"}`;
        sendMail({ to: student.email, subject: `You're in, ${student.name}! 🎉 Your ACADEXA login is ready`, text, html }).catch(e => console.error("Welcome email failed:", e.message || e));
        if (student.parentEmail) {
          sendMail({ to: student.parentEmail, subject: `New Student Registered: ${student.name}`, text: `Your child ${student.name} has been registered.`, html }).catch(e => console.error("Parent welcome email failed:", e.message || e));
        }
      }
    } catch (e) {
      console.error("Non-fatal: welcome email error", e.message || e);
    }
  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ error: "Roll number already exists" });
    res.status(500).json({ error: err.message });
  }
});

// ── Upload / update student photo (Admin only) ──
// Accepts either multipart/form-data file upload or JSON base64 image payload.
router.patch("/:id/photo", auth("admin"), photoUpload.single("photo"), async (req, res) => {
  try {
    let photo = null;

    if (req.file) {
      if (!req.file.mimetype.startsWith("image/")) {
        return res.status(400).json({ error: "Only image uploads are allowed" });
      }

      if (isCloudinaryConfigured) {
        photo = await uploadToCloudinary(req.file);
      } else {
        photo = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      }
    } else {
      const { photo: photoBody } = req.body;
      if (!photoBody) return res.status(400).json({ error: "photo field is required" });
      if (!photoBody.startsWith("data:image/"))
        return res.status(400).json({ error: "photo must be a base64 image data URL" });
      if (photoBody.length > 2_800_000)
        return res.status(413).json({ error: "Photo too large. Max ~2 MB." });
      photo = photoBody;
    }

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { photo },
      { new: true }
    ).select("-password");

    if (!student) return res.status(404).json({ error: "Student not found" });
    res.json({ message: "Photo updated", student });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Remove photo (Admin only) ──
router.delete("/:id/photo", auth("admin"), async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { photo: null },
      { new: true }
    ).select("-password");
    if (!student) return res.status(404).json({ error: "Student not found" });
    res.json({ message: "Photo removed", student });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Delete student (Admin only) ──
router.delete("/:id", auth("admin"), async (req, res) => {
  try {
    await Student.findByIdAndDelete(req.params.id);
    res.json({ message: "Student deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
export default router;