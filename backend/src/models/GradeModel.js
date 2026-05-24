// models/Grade.js
import mongoose from "mongoose";

const gradeSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  subject:   { type: String, required: true },
  examName:  { type: String, required: true },
  marks:     { type: Number, required: true },
  maxMarks:  { type: Number, default: 100 },
  date:      { type: Date,   default: Date.now },
}, { timestamps: true });
const Grade = mongoose.models.Grade || mongoose.model("Grade", gradeSchema);
export default Grade;