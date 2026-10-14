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
    // Online question bank (additive). A quiz with no questions is still
    // the original "scheduled on paper" record; with questions it becomes
    // attemptable in the student portal and is auto-graded on submit
    // (see models/Lms.js QuizAttempt and routes/lmsRoute.js). correctIndex
    // is never sent to students — the student-facing route strips it.
    questions: [{
      text: { type: String, required: true },
      options: { type: [String], validate: v => v.length >= 2 && v.length <= 6 },
      correctIndex: { type: Number, required: true, min: 0 },
      marks: { type: Number, default: 1, min: 0 },
    }],
    closesAt: { type: Date, default: null },
  },
  { timestamps: true }
);

quizSchema.index({ teacherAssignment: 1, scheduledAt: -1 });

const Quiz = mongoose.models.Quiz || mongoose.model("Quiz", quizSchema);
export default Quiz;
