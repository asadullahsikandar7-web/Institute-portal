import mongoose from "mongoose";

// The degree/qualification container (e.g. "BS Computer Science"). Named
// "Program" rather than reusing "Class" — the existing classModel.js is a
// timetable slot (one course + schedule + room), a different concept that
// this deliberately doesn't touch or migrate.
const programSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    academicSession: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicSession", default: null },
  },
  { timestamps: true }
);

const Program = mongoose.models.Program || mongoose.model("Program", programSchema);
export default Program;
