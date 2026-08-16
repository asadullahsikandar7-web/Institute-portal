import mongoose from "mongoose";

// First-class Parent/Guardian entity — additive alongside (not replacing)
// Student.parentName/parentEmail, which stay as denormalized snapshot
// fields for backward compatibility. whatsappNumber is a field only, no
// WhatsApp integration logic — groundwork for a later phase.
const parentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "" },
    email: { type: String, lowercase: true, trim: true, default: "" },
    whatsappNumber: { type: String, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

const Parent = mongoose.models.Parent || mongoose.model("Parent", parentSchema);
export default Parent;
