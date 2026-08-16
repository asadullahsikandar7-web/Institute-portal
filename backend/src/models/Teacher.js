import mongoose from "mongoose";

// Mirrors studentModel.js's password handling: hashed in the route (not a
// pre-save hook), select:false by default, explicit .select("+password")
// needed at login.
const teacherSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    phone: { type: String, default: "" },
    photo: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Teacher = mongoose.models.Teacher || mongoose.model("Teacher", teacherSchema);
export default Teacher;
