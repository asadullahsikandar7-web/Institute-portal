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