import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Admin from "../models/adminModel.js";

const router = express.Router();
const SECRET = process.env.JWT_SECRET || "super_secret_key";

// ════════════════════════════════════════════════════════════
//  ADMIN LOGIN
// ════════════════════════════════════════════════════════════
router.post("/admin-login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ error: "Admin not found" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const token = jwt.sign(
      { 
        id: admin._id,
        email: admin.email,
        role: "admin",
        isSuperAdmin: admin.isSuperAdmin 
      },
      SECRET,
      { expiresIn: "12h" }
    );

    res.json({ 
      token, 
      role: "admin",
      isSuperAdmin: admin.isSuperAdmin,
      email: admin.email
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ════════════════════════════════════════════════════════════
//  ADMIN MIDDLEWARE - Verify Admin Access
// ════════════════════════════════════════════════════════════
const adminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.replace("Bearer ", "");
  try {
    const decoded = jwt.verify(token, SECRET);
    if (decoded.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// ════════════════════════════════════════════════════════════
//  SUPER ADMIN MIDDLEWARE - Only Super Admin Can Manage Admins
// ════════════════════════════════════════════════════════════
const superAdminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.replace("Bearer ", "");
  try {
    const decoded = jwt.verify(token, SECRET);
    if (decoded.role !== "admin" || !decoded.isSuperAdmin) {
      return res.status(403).json({ error: "Super Admin access required" });
    }
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// ════════════════════════════════════════════════════════════
//  GET ALL ADMINS (Super Admin only)
// ════════════════════════════════════════════════════════════
router.get("/admins", superAdminAuth, async (req, res) => {
  try {
    const admins = await Admin.find({}, "-password");
    res.json(admins);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  CREATE NEW ADMIN (Super Admin only)
// ════════════════════════════════════════════════════════════
router.post("/admins", superAdminAuth, async (req, res) => {
  try {
    const { email, password, isSuperAdmin } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(409).json({ error: "Admin already exists" });
    }

    const newAdmin = new Admin({
      email,
      password,
      isSuperAdmin: isSuperAdmin || false
    });

    await newAdmin.save();

    res.status(201).json({
      message: "Admin created successfully",
      admin: {
        id: newAdmin._id,
        email: newAdmin.email,
        isSuperAdmin: newAdmin.isSuperAdmin
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  UPDATE ADMIN (Super Admin only)
// ════════════════════════════════════════════════════════════
router.put("/admins/:id", superAdminAuth, async (req, res) => {
  try {
    const { email, isSuperAdmin } = req.body;

    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    if (email) admin.email = email;
    if (typeof isSuperAdmin === "boolean") admin.isSuperAdmin = isSuperAdmin;

    await admin.save();

    res.json({
      message: "Admin updated successfully",
      admin: {
        id: admin._id,
        email: admin.email,
        isSuperAdmin: admin.isSuperAdmin
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  CHANGE ADMIN PASSWORD (Any admin can change their own)
// ════════════════════════════════════════════════════════════
router.post("/admins/:id/change-password", adminAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Admin can only change their own password
    if (req.user.id !== req.params.id && !req.user.isSuperAdmin) {
      return res.status(403).json({ error: "Cannot change other admin's password" });
    }

    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    admin.password = newPassword;
    await admin.save();

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  DELETE ADMIN (Super Admin only)
// ════════════════════════════════════════════════════════════
router.delete("/admins/:id", superAdminAuth, async (req, res) => {
  try {
    // Prevent deleting the last super admin
    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ error: "Admin not found" });
    }

    if (admin.isSuperAdmin) {
      const superAdminCount = await Admin.countDocuments({ isSuperAdmin: true });
      if (superAdminCount <= 1) {
        return res.status(400).json({ error: "Cannot delete the last super admin" });
      }
    }

    await Admin.findByIdAndDelete(req.params.id);

    res.json({ message: "Admin deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
export default router;