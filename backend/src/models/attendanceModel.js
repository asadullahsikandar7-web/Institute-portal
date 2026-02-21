import mongoose from "mongoose";

const AttendanceSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
  date: String,
  status: String, // present | absent | leave
});

export default mongoose.model("Attendance", AttendanceSchema);
