// models/Exam.js
import mongoose from "mongoose";

const examSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  subject:     { type: String, required: true },
  date:        { type: Date,   required: true },
  maxMarks:    { type: Number, default: 100 },
  venue:       { type: String, default: "" },
  status:      { type: String, enum: ["upcoming","completed"], default: "upcoming" },
  emailStatus: { type: String, enum: ["pending","sending","sent","failed","partial"], default: "pending" },
  emailCount:  { type: Number, default: 0 },
}, { timestamps: true });

// Auto-set completed for past exams
examSchema.pre(/^find/, function() {
  this.where({ status: "upcoming", date: { $lt: new Date() } })
      .updateMany({}, { $set: { status: "completed" } }).exec().catch(() => {});
});
const Exam = mongoose.models.Exam || mongoose.model("Exam", examSchema);
export default Exam;