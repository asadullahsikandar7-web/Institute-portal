import mongoose from "mongoose";

// THE authorization source of truth for everything a teacher can do — every
// subject-scoped teacher action (attendance, announcements, and later
// assignments/quizzes) is checked against an active row here, never trusted
// from client-supplied ids. See services/teacherAuth.js.
const teacherAssignmentSchema = new mongoose.Schema(
  {
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
    academicSession: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicSession", required: true },
    program: { type: mongoose.Schema.Types.ObjectId, ref: "Program", required: true },
    section: { type: mongoose.Schema.Types.ObjectId, ref: "Section", required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

teacherAssignmentSchema.index(
  { teacher: 1, academicSession: 1, program: 1, section: 1, subject: 1 },
  { unique: true }
);

const TeacherAssignment = mongoose.models.TeacherAssignment || mongoose.model("TeacherAssignment", teacherAssignmentSchema);
export default TeacherAssignment;
