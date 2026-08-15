// models/Fee.js
import mongoose from "mongoose";

const feeSchema = new mongoose.Schema({
  studentId:  { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  title:      { type: String, required: true },
  amount:     { type: Number, required: true },
  category:   { type: String, enum: ["tuition","lab","library","exam","other"], default: "tuition" },
  dueDate:    { type: Date, required: true },
  status:     { type: String, enum: ["paid","unpaid","overdue"], default: "unpaid" },
  paidOn:     { type: Date, default: null },
}, { timestamps: true });

// Auto-mark overdue before every find. Must run as an independent query via
// this.model — chaining .updateMany() directly onto `this` (the in-flight
// find query) mutates its op to "updateMany" and silently breaks the actual
// find (verified: it was returning [] for every Fee.find/findById call).
feeSchema.pre(/^find/, function(next) {
  this.model.updateMany(
    { status: "unpaid", dueDate: { $lt: new Date() } },
    { $set: { status: "overdue" } }
  ).exec().catch(() => {});
  next();
});
const Fee = mongoose.models.Fee || mongoose.model("Fee", feeSchema);
export default Fee;