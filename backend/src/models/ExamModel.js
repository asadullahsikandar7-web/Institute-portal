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

// Auto-set completed for past exams — fires as a genuinely separate
// updateMany against the model, NOT chained onto `this` (the query about to
// run). Calling .where()/.updateMany()/.exec() on `this` inside a pre-find
// hook mutates that same in-flight query's operation type mid-execution,
// which can turn a plain `Exam.find()` into something that resolves with an
// updateMany result shape instead of the requested documents. this.model
// gives the bound Exam model without an unsafe direct reference to the
// `Exam` const below (which doesn't exist yet at schema-definition time).
examSchema.pre(/^find/, function() {
  this.model.updateMany(
    { status: "upcoming", date: { $lt: new Date() } },
    { $set: { status: "completed" } }
  ).exec().catch(() => {});
});
const Exam = mongoose.models.Exam || mongoose.model("Exam", examSchema);
export default Exam;