import mongoose from "mongoose";

const StudentSchema = new mongoose.Schema({
  name: String,
  email: String,
  rollNo: String,
  password: String,
  parentName: String,
  parentEmail: String,
  phone: String,
  program: String,
  semester: Number,
  photo: { type: String, default: null }, // Store photo as base64 data URL
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Student", StudentSchema);
