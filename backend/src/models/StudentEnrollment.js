import mongoose from "mongoose";

// Append-only/historical — a placement record is never overwritten when a
// student moves sessions/sections; a new document is created instead, so
// past academic history stays intact. Student.currentEnrollment (see
// studentModel.js) is a denormalized convenience pointer to whichever of
// these is currently active — this collection remains the source of truth.
const studentEnrollmentSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    academicSession: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicSession", required: true },
    program: { type: mongoose.Schema.Types.ObjectId, ref: "Program", required: true },
    section: { type: mongoose.Schema.Types.ObjectId, ref: "Section", required: true },
    status: { type: String, enum: ["active", "transferred", "completed", "withdrawn"], default: "active" },
    enrolledAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

studentEnrollmentSchema.index({ student: 1, academicSession: 1 });

const StudentEnrollment = mongoose.models.StudentEnrollment || mongoose.model("StudentEnrollment", studentEnrollmentSchema);
export default StudentEnrollment;
