import mongoose from "mongoose";

const leaveSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  type: { type: String, enum: ["Medical", "casual", "Family Emergency", "Personal","Academic","Travel","Other"], required: true },
  from: { type: Date, required: true },
  to: { type: Date, required: true },
  reason: { type: String },
  // Lowercase to match what the app actually reads/writes everywhere else
  // (leaveroutes.js's review endpoint, src/asad.jsx's LeavePanelPage tabs) —
  // the previous capitalized "Approved"/"Rejected" never matched either and
  // was silently never enforced, since that PATCH route updates via
  // findByIdAndUpdate without runValidators. This just makes the schema
  // describe what was already true in the database.
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  appliedAt: { type: Date, default: Date.now },
  reviewedAt: { type: Date },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" }
});
const Leave = mongoose.models.Leave || mongoose.model("Leave", leaveSchema);
export default Leave;