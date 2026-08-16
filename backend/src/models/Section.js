import mongoose from "mongoose";

const sectionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "A"
    code: { type: String, required: true, trim: true },
    program: { type: mongoose.Schema.Types.ObjectId, ref: "Program", required: true },
    academicSession: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicSession", required: true },
    capacity: { type: Number },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

// Prevents duplicate section codes within the same program+session.
sectionSchema.index({ program: 1, academicSession: 1, code: 1 }, { unique: true });

const Section = mongoose.models.Section || mongoose.model("Section", sectionSchema);
export default Section;
