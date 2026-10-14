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
    // Parent-portal login (additive). Null until an admin enables portal
    // access for this parent; same handling as Student/Teacher passwords —
    // hashed in the route, select:false, explicit .select("+password") at login.
    password: { type: String, select: false, default: null },
    portalEnabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Parent = mongoose.models.Parent || mongoose.model("Parent", parentSchema);
export default Parent;
