import express from "express";
import Parent from "../models/Parent.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// Admin-only throughout — parent contact info is sensitive (spec section
// 14: students/teachers must not see it via a generic endpoint).

router.get("/", auth("admin"), async (req, res) => {
  try {
    const parents = await Parent.find().sort({ name: 1 });
    res.json(parents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", auth("admin"), async (req, res) => {
  try {
    const parent = await Parent.findById(req.params.id);
    if (!parent) return res.status(404).json({ error: "Parent not found" });
    res.json(parent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", auth("admin"), async (req, res) => {
  try {
    const { name, phone, email, whatsappNumber } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "name is required" });
    if (!phone && !email) return res.status(400).json({ error: "At least one of phone or email is required" });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }
    const parent = await Parent.create({
      name: name.trim(),
      phone: (phone || "").trim(),
      email: (email || "").trim(),
      whatsappNumber: (whatsappNumber || "").trim(),
    });
    res.status(201).json(parent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id", auth("admin"), async (req, res) => {
  try {
    const { name, phone, email, whatsappNumber, status } = req.body;
    if (email !== undefined && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }
    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (phone !== undefined) update.phone = phone.trim();
    if (email !== undefined) update.email = email.trim();
    if (whatsappNumber !== undefined) update.whatsappNumber = whatsappNumber.trim();
    if (status !== undefined) update.status = status;

    const parent = await Parent.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!parent) return res.status(404).json({ error: "Parent not found" });
    res.json(parent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", auth("admin"), async (req, res) => {
  try {
    const parent = await Parent.findByIdAndUpdate(req.params.id, { status: "inactive" }, { new: true });
    if (!parent) return res.status(404).json({ error: "Parent not found" });
    res.json({ message: "Parent deactivated", parent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
