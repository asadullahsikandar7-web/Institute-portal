import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const AdminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
  },
  isSuperAdmin: {
    type: Boolean,
    default: false,
    description: "Super admins can create/delete/manage other admins"
  },
  // Staff sub-role — scopes which modules a non-super admin account may
  // write to (see services/permissions.js). "admin" is full access, which
  // keeps every pre-existing admin account behaving exactly as before.
  adminRole: {
    type: String,
    enum: ["admin", "registrar", "accountant", "librarian", "hr", "warden", "frontdesk"],
    default: "admin"
  },
  name: { type: String, default: "" },
  // Two-factor sign-in (authenticator app). The secret is never returned
  // by default; totpLastWindow stops a code being replayed.
  totpSecret: { type: String, default: null, select: false },
  totpEnabled: { type: Boolean, default: false },
  totpLastWindow: { type: Number, default: null },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving (only if modified)
AdminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    this.password = await bcrypt.hash(this.password, 10);
    next();
  } catch (err) {
    next(err);
  }
});

// Prevent password from being returned in queries
AdminSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};
const Admin = mongoose.models.Admin || mongoose.model("Admin", AdminSchema);
export default Admin;