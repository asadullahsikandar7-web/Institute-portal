import mongoose from "mongoose";

const academicSessionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "2026-27"
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ["active", "inactive", "archived"], default: "active" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

const AcademicSession = mongoose.models.AcademicSession || mongoose.model("AcademicSession", academicSessionSchema);
export default AcademicSession;
