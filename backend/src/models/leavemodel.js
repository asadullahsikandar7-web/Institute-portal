import mongoose from "mongoose";

const leaveSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  type: { type: String, enum: ["Medical", "casual", "Family Emergency", "Personal","Academic","Travel","Other"], required: true },
  from: { type: Date, required: true },
  to: { type: Date, required: true },
  reason: { type: String },
  status: { type: String, enum: ["pending", "Approved", "Rejected"], default: "pending" },
  appliedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" }
});
const Leave = mongoose.models.Leave || mongoose.model("Leave", leaveSchema);
export default Leave;