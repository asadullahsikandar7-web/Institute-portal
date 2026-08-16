import mongoose from "mongoose";

// Minimal quiz record — scheduling/marks metadata only, no question bank or
// auto-grading (no such infrastructure exists yet in this codebase; per the
// spec, this is not to be invented here). Same scoping pattern as
// Assignment.js: reached only through a TeacherAssignment.
const quizSchema = new mongoose.Schema(
  {
    teacherAssignment: { type: mongoose.Schema.Types.ObjectId, ref: "TeacherAssignment", required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    scheduledAt: { type: Date, required: true },
    durationMinutes: { type: Number, default: null },
    totalMarks: { type: Number, default: null },
    status: { type: String, enum: ["active", "closed"], default: "active" },
  },
  { timestamps: true }
);

quizSchema.index({ teacherAssignment: 1, scheduledAt: -1 });

const Quiz = mongoose.models.Quiz || mongoose.model("Quiz", quizSchema);
export default Quiz;
