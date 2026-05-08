import mongoose from "mongoose";

const ParentMessageSchema = new mongoose.Schema({
  studentId:   { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  studentName: String,
  rollNo:      String,
  parentName:  String,
  parentEmail: { type: String, required: true },
  title:       { type: String, required: true },
  message:     { type: String, required: true },
  type:        { type: String, enum: ["announcement","complaint","achievement","warning"], default: "announcement" },
  author:      String,
  emailStatus: { type: String, enum: ["sent","failed","pending"], default: "pending" },
}, { timestamps: true });

export default mongoose.model("ParentMessage", ParentMessageSchema);