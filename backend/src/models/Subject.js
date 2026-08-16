import mongoose from "mongoose";

// Global catalog — deliberately NOT tied to a Program/Section directly; a
// subject only becomes tied to a specific Program+Section+Session through a
// TeacherAssignment. Also deliberately not connected to the pre-existing
// free-text Grade.subject/Exam.subject fields — reconciling those is
// separate future work, not part of this change.
const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: "" },
    creditHours: { type: Number },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

const Subject = mongoose.models.Subject || mongoose.model("Subject", subjectSchema);
export default Subject;
