// models/Grade.js
const mongoose = require("mongoose");

const gradeSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  subject:   { type: String, required: true },
  examName:  { type: String, required: true },
  marks:     { type: Number, required: true },
  maxMarks:  { type: Number, default: 100 },
  date:      { type: Date,   default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model("Grade", gradeSchema);