import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Student name is required"],
      trim: true,
      minlength: 2
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true
    },
    rollNo: {
      type: String,
      required: [true, "Roll number is required"],
      unique: true,
      trim: true
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false // Don't return password by default
    },
    parentName: String,
    parentEmail: {
      type: String,
      lowercase: true,
      sparse: true
    },
    phone: String,
    program: {
      type: String,
      default: "General"
    },
    semester: {
      type: Number,
      default: 1
    },
    photo: {
      type: String,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    // Additive only — parentName/parentEmail above stay exactly as they
    // are for every existing reader (AI tools, email templates,
    // StudentDrawer). parentId points at a first-class Parent record when
    // one exists; currentEnrollment is a denormalized convenience pointer
    // to whichever StudentEnrollment doc is currently active for this
    // student — StudentEnrollment itself remains the historical source of
    // truth, this is just a read-optimization, never authoritative.
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parent",
      default: null
    },
    currentEnrollment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudentEnrollment",
      default: null
    },
    // Distinct from rollNo (the login/lookup key) — an institute-issued
    // registration number, optional so legacy students without one don't break.
    registrationNo: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

// No explicit indexes here to avoid duplicate index warnings.

// Method to return safe object without password
studentSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};
const Student = mongoose.models.Student || mongoose.model("Student", studentSchema);
export default Student;