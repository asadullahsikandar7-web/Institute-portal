import mongoose from "mongoose";

// An institute on the platform. Not itself tenant-scoped (see
// tenancy/plugin.js PLATFORM_MODELS) — only the platform owner manages these.
export const OPTIONAL_MODULES = ["admissions", "exams", "finance", "payroll", "hr", "library", "campus", "engage", "lifecycle", "ai"];

const tenantSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true, match: [/^[A-Z0-9][A-Z0-9-]{1,29}$/, "Code: 2–30 letters, digits or dashes"] },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ["school", "college", "university"], default: "school" },
  status: { type: String, enum: ["active", "suspended"], default: "active" },
  plan: { type: String, enum: ["trial", "basic", "standard", "premium"], default: "standard" },
  modules: { type: [String], default: () => [...OPTIONAL_MODULES] }, // optional modules this institute has
  limits: {
    maxStudents: { type: Number, default: null }, // null = unlimited
    maxTeachers: { type: Number, default: null },
  },
  contactName: { type: String, default: "" },
  contactEmail: { type: String, default: "", lowercase: true, trim: true },
  contactPhone: { type: String, default: "" },
  subscriptionEnds: { type: Date, default: null },
  notes: { type: String, default: "" },
}, { timestamps: true });

export const Tenant = mongoose.models.Tenant || mongoose.model("Tenant", tenantSchema);

const ownerSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  name: { type: String, default: "Platform Owner" },
}, { timestamps: true });
export const PlatformOwner = mongoose.models.PlatformOwner || mongoose.model("PlatformOwner", ownerSchema);
