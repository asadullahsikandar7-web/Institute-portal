import express from "express";
import { auth } from "./middleware/auth.js";
import Student from "../models/studentModel.js";


const router = express.Router();

// Get all students (Admin only)
router.get("/", auth("admin"), async (req, res) => {
   const students = await Student.find();
   res.json(students);
});

// Add student (Admin only)
import bcrypt from "bcrypt";

router.post("/", async (req, res) => {
  try {
    const { name, email, rollNo, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const student = new Student({
      name,
      email,
      rollNo,
      password: hashedPassword,
    });

    await student.save();
    res.json(student);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error creating student" });
  }
});


// Delete student (Admin only)
router.delete("/:id", auth("admin"), async (req, res) => {
  await Student.findByIdAndDelete(req.params.id);
  res.json({ message: "Student deleted" });
});

export default router;