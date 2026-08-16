import express from "express";
import Fee from "../models/FeeModel.js";
import Student from "../models/studentModel.js";
import { auth, adminOnly } from "../middleware/auth.js";

const router = express.Router();

// GET all fees (admin) or fees for one student
router.get("/", auth(), async (req, res) => {
  try {
    const studentId = req.user.studentId || req.user.id;
    const query = req.user.role === "admin" ? {} : { studentId };
    const fees  = await Fee.find(query).populate("studentId", "name rollNo email").sort({ dueDate: 1 });
    res.json(fees);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET fees for specific student
router.get("/:studentId", auth(), async (req, res) => {
  try {
    const requestedId = req.params.studentId;

    if (req.user.role !== "admin" && req.user.studentId !== requestedId && req.user.id !== requestedId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const fees = await Fee.find({ studentId: requestedId }).sort({ dueDate: 1 });
    res.json(fees);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create fee
router.post("/", adminOnly, async (req, res) => {
  try {
    const { title, amount, category, due, studentId, applyToAll } = req.body;
    if (!title || !amount || !due) return res.status(400).json({ error: "title, amount, due required" });
    if (Number(amount) <= 0) return res.status(400).json({ error: "amount must be greater than 0" });

    // Bulk-create for every student is now an explicit opt-in (applyToAll)
    // rather than whatever happens when a caller simply omits studentId —
    // the admin Fees UI used to always omit it, silently billing the whole
    // student body on every "Add Fee" click with no way to target one
    // student. See src/asad.jsx's FeesPage for the paired frontend fix.
    if (applyToAll) {
      const students = await Student.find({});
      const fees = await Fee.insertMany(
        students.map(s => ({ studentId: s._id, title, amount, category, dueDate: new Date(due) }))
      );
      return res.status(201).json({ fees, count: fees.length });
    }

    if (!studentId) return res.status(400).json({ error: "studentId is required (or set applyToAll to bill every student)" });

    const fee = await new Fee({ studentId, title, amount, category, dueDate: new Date(due) }).save();
    res.status(201).json({ fee });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH mark paid — admin only. Fee status is a record of what the
// institution has actually received/verified, not something a student
// self-attests to, so students get read-only visibility (via the GET
// routes above) and never a write path here.
router.patch("/:id", adminOnly, async (req, res) => {
  try {
    const fee = await Fee.findById(req.params.id);
    if (!fee) return res.status(404).json({ error: "Fee not found" });

    const updated = await Fee.findByIdAndUpdate(
      req.params.id,
      { status: "paid", paidOn: new Date() },
      { new: true }
    );
    res.json({ fee: updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
export default router;