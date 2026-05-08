// routes/fees.js
const router  = require("express").Router();
const Fee     = require("../models/Fee");
const Student = require("../models/Student");
const { authMiddleware, adminOnly } = require("../middleware/auth");

// GET all fees (admin) or fees for one student
router.get("/", authMiddleware, async (req, res) => {
  try {
    const query = req.user.role === "admin" ? {} : { studentId: req.user.studentId };
    const fees  = await Fee.find(query).populate("studentId", "name rollNo email").sort({ dueDate: 1 });
    res.json(fees);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET fees for specific student
router.get("/:studentId", authMiddleware, async (req, res) => {
  try {
    const fees = await Fee.find({ studentId: req.params.studentId }).sort({ dueDate: 1 });
    res.json(fees);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create fee
router.post("/", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { title, amount, category, due, studentId } = req.body;
    if (!title || !amount || !due) return res.status(400).json({ error: "title, amount, due required" });

    // If no studentId — create for ALL students
    if (!studentId) {
      const students = await Student.find({});
      const fees = await Fee.insertMany(
        students.map(s => ({ studentId: s._id, title, amount, category, dueDate: new Date(due) }))
      );
      return res.status(201).json({ fee: fees[0], count: fees.length });
    }

    const fee = await new Fee({ studentId, title, amount, category, dueDate: new Date(due) }).save();
    res.status(201).json({ fee });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH mark paid
router.patch("/:id", authMiddleware, async (req, res) => {
  try {
    const fee = await Fee.findByIdAndUpdate(
      req.params.id,
      { status: "paid", paidOn: new Date() },
      { new: true }
    );
    if (!fee) return res.status(404).json({ error: "Fee not found" });
    res.json({ fee });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;