import mongoose from "mongoose";

// Coursework/homework given to a class — named "Assignment" per the spec's
// own terminology, distinct from TeacherAssignment.js (which assigns a
// TEACHER to a class/subject; this is what that teacher then assigns to
// STUDENTS). Always scoped through a single TeacherAssignment, so it never
// needs its own copy of session/program/section/subject/teacher — those are
// reached via populate("teacherAssignment").
const assignmentSchema = new mongoose.Schema(
  {
    teacherAssignment: { type: mongoose.Schema.Types.ObjectId, ref: "TeacherAssignment", required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    dueDate: { type: Date, required: true },
    totalMarks: { type: Number, default: null },
    attachments: [{ type: String }],
    status: { type: String, enum: ["active", "closed"], default: "active" },
  },
  { timestamps: true }
);

assignmentSchema.index({ teacherAssignment: 1, dueDate: -1 });

const Assignment = mongoose.models.Assignment || mongoose.model("Assignment", assignmentSchema);
export default Assignment;
